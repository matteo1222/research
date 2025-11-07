# Investigation Notes: MCP Subagent Isolation

## Objective
Understand how Claude Code SDK works and how it could be used to implement MCP server isolation for subagents.

## Investigation Started
Date: 2025-11-07

## Tasks
1. Find Claude Code SDK documentation/examples
2. Understand programmatic control of agent configurations
3. Understand how MCP servers are configured and passed to agents
4. Determine if SDK supports different MCP configurations per agent invocation

---


## Key Findings

### 1. Claude Agent SDK Location
- **Official Package (TS)**: @anthropic-ai/claude-agent-sdk (npm)
- **Official Package (Python)**: claude-agent-sdk (pip)
- **GitHub**: anthropics/claude-agent-sdk-typescript & anthropics/claude-agent-sdk-python
- **Documentation**: https://docs.claude.com/en/api/agent-sdk/overview

### 2. Agent Configuration Options

The SDK provides several configuration mechanisms:

**ClaudeAgentOptions:**
- `systemPrompt` - Custom system prompts
- `allowedTools` - Explicitly allow specific tools
- `disallowedTools` - Block specific tools
- `permissionMode` - Overall permission strategy
- `mcpServers` - Dictionary of MCP servers (NOT an array)
- `settingSources` - Must explicitly set to ['project'] to load CLAUDE.md, settings.json, etc.

**File System Configuration:**
- `./.claude/agents/` - Subagent markdown files
- `./.claude/skills/` - Custom capabilities
- `./.claude/settings.json` - Hook configurations
- `./.claude/commands/` - Custom commands
- `.mcp.json` - MCP server configurations (project-scoped)

### 3. MCP Server Configuration

**Transport Types:**
1. HTTP (recommended for remote)
2. SSE (deprecated)
3. Stdio (local processes)

**Configuration Scopes:**
- **Local**: Private to user, only accessible in current project
- **Project**: Stored in .mcp.json for team sharing
- **User**: Available across all projects, private to user

**MCP Tool Naming:** `mcp__{server_name}__{tool_name}`

### 4. Custom Tools (In-Process MCP Servers)

Both TypeScript and Python support defining custom tools that run in-process:

**TypeScript:**
- `createSdkMcpServer()` with `tool()` helper
- Zod schemas for validation

**Python:**
- `@tool` decorator
- Type-safe function definitions

### 5. Subagents

**Capabilities:**
- Separate context windows (isolated from main thread)
- Custom system prompts
- Tool permission inheritance or selective tool specification
- Defined in markdown files in `./.claude/agents/`

**Current Limitations:**
- Can specify individual tools as comma-separated list
- Can omit tools field to inherit ALL tools from main thread (default)
- Each subagent gets own context but shares MCP server access

### 6. CRITICAL LIMITATION: MCP Isolation Issue

**GitHub Issue #4476**: "Implement Agent-Scoped MCP Configuration with Strict Isolation"

**Problem:**
- ANY MCP server configured globally is enumerable and callable from ALL agents
- No way to restrict MCP servers to specific subagents only
- Tool descriptions consume ~40k tokens even if unused by main agent
- Context bloat contradicts subagent design goals

**Desired Behavior:**
1. Subagents should have dedicated MCP servers NOT visible to main thread
2. Main agent cannot invoke tools from agent-scoped servers
3. Only the designated subagent materializes/uses its MCP servers

**Community Interest:**
- 122 reactions, 22 comments
- Multiple proposed solutions in discussion

**Current Workaround:**
- None - this is a fundamental architecture limitation
- Can control which tools are ALLOWED but can't prevent enumeration
- All MCP servers share global scope across all agents


## Deep Dive: SDK API Details

### TypeScript API - `query()` Function

```typescript
function query({
  prompt,
  options
}: {
  prompt: string | AsyncIterable<SDKUserMessage>;
  options?: Options;
}): Query
```

### TypeScript Options Object

| Parameter | Type | Default | Purpose |
|-----------|------|---------|---------|
| `agents` | `Record<string, AgentDefinition>` | `undefined` | Define subagents programmatically |
| `allowedTools` | `string[]` | All tools | Restrict available tools by name |
| `disallowedTools` | `string[]` | `[]` | Explicitly block specific tools |
| `mcpServers` | `Record<string, McpServerConfig>` | `{}` | Configure MCP server connections |
| `model` | `string` | CLI default | Specify Claude model |
| `permissionMode` | `PermissionMode` | `'default'` | Control permission handling |
| `systemPrompt` | `string \| PresetConfig` | `undefined` | Custom or preset system instructions |
| `settingSources` | `SettingSource[]` | `[]` | Load filesystem settings |

### AgentDefinition Type

```typescript
type AgentDefinition = {
  description: string;      // When to use this agent
  tools?: string[];         // Allowed tool names (optional)
  prompt: string;           // System prompt
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
}
```

**Key Points:**
- `description`: Guides when Claude delegates tasks to this subagent
- `tools`: If omitted, inherits ALL tools from parent
- `model`: Defaults to main configuration if not specified

### MCP Server Configuration Types

1. **stdio**: Local subprocess communication
2. **sse**: Server-Sent Events protocol (deprecated)
3. **http**: HTTP-based connection
4. **sdk**: In-process MCP instances via `createSdkMcpServer()`

### Python API - ClaudeAgentOptions

```python
ClaudeAgentOptions(
    system_prompt="...",
    allowed_tools=["Read", "Write"],
    mcp_servers={"tools": server},
    max_turns=10
)
```

### Python API - Custom Tools

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool("greet", "Greet a user", {"name": str})
async def greet_user(args):
    return {
        "content": [
            {"type": "text", "text": f"Hello, {args['name']}!"}
        ]
    }

server = create_sdk_mcp_server(
    name="my-tools",
    version="1.0.0",
    tools=[greet_user]
)
```

## Key Findings on MCP Isolation

### What IS Possible:

1. **Per-query MCP configuration**: Each `query()` call can have different `mcpServers`
2. **Tool allowlisting**: Each agent can specify `allowedTools` to restrict access
3. **Inline subagent definition**: Use `agents` parameter to define subagents programmatically
4. **In-process MCP servers**: SDK type allows custom tools without subprocess overhead

### What IS NOT Possible (Current Limitation):

1. **True MCP server isolation for subagents**: All MCP servers configured at parent level are visible to all subagents
2. **Agent-scoped MCP servers**: Cannot configure MCP servers that ONLY a specific subagent can see/use
3. **Preventing enumeration**: Main thread can always list all MCP servers, even if not allowed to use them

### Critical Insight:

The SDK allows **different MCP configurations per top-level `query()` call**, but NOT per subagent within the same query context.

**Workaround Possibility:**
You could potentially isolate MCP servers by:
1. Creating separate `query()` invocations with different `mcpServers` configurations
2. Using the parent agent to orchestrate which query to invoke based on the task
3. Each query would be isolated with its own MCP configuration

This would NOT be "subagents" in the traditional sense (no Task tool delegation), but rather separate agent invocations orchestrated programmatically.


## Code Examples Found

### TypeScript: Multiple MCP Servers with Different Configurations

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create in-process SDK MCP server
const greetTool = tool(
  "greet",
  "Greet a user by name",
  { name: z.string() },
  async ({ name }) => ({
    content: [{ type: "text", text: `Hello, ${name}!` }]
  })
);

const sdkServer = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [greetTool]
});

// Configure multiple MCP servers
const options = {
  mcpServers: {
    "internal": sdkServer,  // In-process
    "filesystem": {         // External
      command: "npx",
      args: ["@modelcontextprotocol/server-filesystem"],
      env: { ALLOWED_PATHS: "/Users/me/projects" }
    }
  },
  allowedTools: [
    "mcp__internal__greet",
    "mcp__filesystem__list_files"
  ]
};

for await (const message of query({
  prompt: "List files and greet John",
  options
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

### TypeScript: Inline Subagent Definition

```typescript
const result = query({
  prompt: "Optimize the database queries",
  options: {
    agents: {
      'performance-optimizer': {
        description: 'Use for optimization tasks',
        prompt: 'You are a performance specialist...',
        tools: ['Read', 'Edit', 'Bash', 'Grep'],
        model: 'sonnet'
      },
      'security-reviewer': {
        description: 'Use for security reviews',
        prompt: 'You are a security expert...',
        tools: ['Read', 'Grep'],  // Limited tools
        model: 'opus'
      }
    }
  }
});
```

### Python: Custom Tools with MCP

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

@tool("greet", "Greet a user", {"name": str})
async def greet_user(args):
    return {
        "content": [
            {"type": "text", "text": f"Hello, {args['name']}!"}
        ]
    }

server = create_sdk_mcp_server(
    name="my-tools",
    version="1.0.0",
    tools=[greet_user]
)

options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__greet"],
    system_prompt="You are a helpful assistant"
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Greet Alice")
    async for msg in client.receive_response():
        print(msg)
```

## Summary of Investigation

### Capability Matrix

| Feature | Supported | Level | Notes |
|---------|-----------|-------|-------|
| **Programmatic agent creation** | ✅ Yes | SDK | Via `query()` function |
| **Custom tool configuration** | ✅ Yes | Per-agent | `allowedTools` / `disallowedTools` |
| **MCP server configuration** | ✅ Yes | Per-query | Via `mcpServers` option |
| **In-process MCP servers** | ✅ Yes | SDK | Via `createSdkMcpServer()` |
| **Inline subagent definition** | ✅ Yes | SDK | Via `agents` option |
| **File-based subagents** | ✅ Yes | CLI | Markdown files in `.claude/agents/` |
| **Tool inheritance control** | ⚠️ Partial | Subagent | All or specific list |
| **Per-subagent MCP isolation** | ❌ No | N/A | Issue #4476 - not implemented |
| **Subagent MCP enumeration control** | ❌ No | N/A | All servers visible to all agents |

### Architecture Findings

**Query-Level Isolation:**
- Each `query()` call can have completely different `mcpServers` configuration
- This enables isolation at the query invocation level
- Different queries can have different MCP servers

**Subagent-Level Sharing:**
- Within a single query context, all subagents share the same MCP servers
- Subagents can have different `allowedTools` to restrict access
- But cannot prevent enumeration of MCP servers

**Workaround for MCP Isolation:**
Instead of using the Task tool for subagent delegation, you could:
1. Create separate `query()` invocations with different MCP configurations
2. Use a parent orchestrator (outside SDK) to route tasks to appropriate queries
3. Each query gets isolated MCP servers

This is NOT the same as SDK subagents, but achieves MCP isolation.


## Investigation Complete

### Final Conclusion

The Claude Agent SDK provides excellent support for:
- Programmatic agent configuration
- Custom tool creation via in-process MCP servers
- Tool access control per agent
- Per-query MCP server configuration
- Inline subagent definition
- Parallel subagent execution

However, it does NOT support:
- Per-subagent MCP server isolation
- Preventing MCP server enumeration from subagents
- Agent-scoped MCP configurations

### Main Insight

**MCP isolation is possible at the query level, not the subagent level.**

Each `query()` call can have completely different MCP servers, but within a single query context, all subagents share the same MCP configuration. Subagents can have restricted tool access via `allowedTools`, but they cannot have isolated MCP servers.

### Workaround

To achieve MCP isolation:
1. Use separate `query()` invocations with different `mcpServers` configs
2. Implement external orchestration to route tasks
3. Don't rely on SDK's Task tool for subagent delegation in this case

This achieves true isolation but loses SDK subagent benefits like automatic parallelization.

### Documentation Quality

The official documentation is comprehensive and well-organized:
- Clear API references
- Good code examples
- Multiple SDK languages (TypeScript, Python)
- Active GitHub repositories with demos

The limitation regarding MCP isolation is documented through GitHub issues and community discussions.

