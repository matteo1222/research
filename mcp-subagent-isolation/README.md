# Claude Code SDK: MCP Subagent Isolation Investigation

## Quick Start: Simple Solutions

**Problem:** MCP servers are visible to all agents (main + subagents), causing context pollution (~40k tokens wasted).

**Best Solution:** Use separate `query()` calls instead of SDK subagents for true isolation.

```typescript
// ✅ ISOLATED: Each query gets different MCP servers
async function routeTask(task: string) {
  if (task.includes("browser")) {
    return query({
      prompt: task,
      options: { mcpServers: { playwright: playwrightConfig } }
    });
  } else if (task.includes("files")) {
    return query({
      prompt: task,
      options: { mcpServers: { filesystem: fsConfig } }
    });
  }
}

// ❌ NOT ISOLATED: All subagents see all MCP servers
query({
  prompt: task,
  options: {
    mcpServers: { playwright: config1, filesystem: config2 },
    agents: { 'browser-agent': {...}, 'file-agent': {...} }
  }
});
```

### 4 Simple Solutions

| Solution | True Isolation? | SDK Features? | Best For |
|----------|----------------|---------------|----------|
| **1. Query-Level Isolation** | ✅ Yes | ❌ No Task delegation | Production use, context critical |
| **2. Tool Allowlisting** | ❌ No | ✅ Full SDK | Can tolerate context pollution |
| **3. In-Process MCP Servers** | ❌ No | ✅ Full SDK | Custom tools, better performance |
| **4. External Orchestrator** | ✅ Yes | ⚠️ Custom routing | Complex multi-agent systems |

**See [`solution-examples.ts`](./solution-examples.ts) and [`solution-examples.py`](./solution-examples.py) for complete working code.**

---

## Executive Summary

The Claude Agent SDK (formerly Claude Code SDK) provides robust programmatic control over agent configurations, including custom tools, MCP servers, and subagents. However, **true MCP server isolation for subagents is not currently supported**. MCP servers configured at the parent level are visible and enumerable by all subagents, though access can be restricted through tool allowlisting.

## Key Findings

### 1. Claude Agent SDK Overview

**Official Packages:**
- **TypeScript**: `@anthropic-ai/claude-agent-sdk` (npm)
- **Python**: `claude-agent-sdk` (pip)

**Documentation:**
- Main: https://docs.claude.com/en/api/agent-sdk/overview
- TypeScript API: https://docs.claude.com/en/api/agent-sdk/typescript
- Custom Tools: https://docs.claude.com/en/api/agent-sdk/custom-tools
- MCP in SDK: https://docs.claude.com/en/api/agent-sdk/mcp
- Subagents: https://docs.claude.com/en/api/agent-sdk/subagents

### 2. Programmatic Agent Configuration

The SDK provides comprehensive configuration through the Options object:

#### TypeScript Configuration

```typescript
const options = {
  // Inline subagent definitions
  agents: {
    'agent-name': {
      description: 'When to use this agent',
      prompt: 'System instructions',
      tools: ['Read', 'Grep'],      // Optional, inherits all if omitted
      model: 'sonnet' | 'opus' | 'haiku' | 'inherit'
    }
  },
  
  // MCP server configuration
  mcpServers: {
    'server-name': {
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem'],
      env: { ALLOWED_PATHS: '/path' }
    },
    'sdk-server': createSdkMcpServer({
      name: 'custom',
      version: '1.0.0',
      tools: [customTool]
    })
  },
  
  // Tool access control
  allowedTools: ['Read', 'Write', 'mcp__server__tool'],
  disallowedTools: ['Bash'],
  
  // Other options
  systemPrompt: 'Custom system prompt',
  model: 'claude-3-5-sonnet-20241022',
  permissionMode: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan',
  settingSources: ['project']  // Load .claude/ configuration
}
```

#### Python Configuration

```python
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient

options = ClaudeAgentOptions(
    system_prompt="Custom prompt",
    allowed_tools=["Read", "Write"],
    mcp_servers={"server": sdk_server},
    max_turns=10
)

async with ClaudeSDKClient(options=options) as client:
    await client.query("Your prompt")
    async for msg in client.receive_response():
        print(msg)
```

### 3. MCP Server Configuration

#### Transport Types

1. **stdio**: Local subprocess communication
2. **sse**: Server-Sent Events (deprecated)
3. **http**: HTTP-based connection (recommended for remote)
4. **sdk**: In-process MCP servers via `createSdkMcpServer()`

#### Configuration Scopes

- **Local**: Private to user, project-specific (default)
- **Project**: Stored in `.mcp.json` for team sharing
- **User**: Available across all projects

#### MCP Tool Naming Convention

```
mcp__{server_name}__{tool_name}
```

Example: `mcp__filesystem__list_files`

### 4. Custom Tools (In-Process MCP Servers)

#### TypeScript Example

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

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
```

#### Python Example

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

**Benefits:**
- No subprocess management overhead
- Better performance (no IPC delays)
- Simplified debugging (single process)
- Type-safe function calls

### 5. Subagent Capabilities

#### Definition Methods

**1. Programmatic (Inline) - Recommended**
```typescript
const result = query({
  prompt: "Optimize database queries",
  options: {
    agents: {
      'performance-optimizer': {
        description: 'Use for optimization tasks',
        prompt: 'You are a performance specialist...',
        tools: ['Read', 'Edit', 'Grep'],
        model: 'sonnet'
      }
    }
  }
});
```

**2. File-Based**
Create `.claude/agents/agent-name.md`:
```markdown
---
name: agent-name
description: When to use this agent
tools: Read, Grep, Glob
model: sonnet
---
System prompt defining role and expertise
```

#### Subagent Features

- **Isolated Context**: Separate context windows prevent main thread pollution
- **Parallelization**: Multiple subagents can run concurrently
- **Specialized Prompts**: Each subagent has custom system instructions
- **Tool Restrictions**: Limit access to specific tools
- **Model Selection**: Each subagent can use different Claude models

#### Tool Inheritance

- **Omit `tools` field**: Inherits ALL tools from parent (including MCP tools)
- **Specify `tools` array**: Gets only listed tools (granular control)

### 6. MCP Isolation Limitation

#### Current Architecture

**Problem**: Any MCP server configured at the parent level is enumerable and callable from ALL agents, including subagents.

**GitHub Issue**: [#4476 - Implement Agent-Scoped MCP Configuration with Strict Isolation](https://github.com/anthropics/claude-code/issues/4476)
- 122 positive reactions
- 22 comments
- High community interest

#### What IS Possible

✅ **Per-query MCP configuration**: Different `query()` calls can have different `mcpServers`

```typescript
// Query 1 - with filesystem access
const result1 = query({
  prompt: "List files",
  options: {
    mcpServers: { filesystem: fsConfig }
  }
});

// Query 2 - with database access
const result2 = query({
  prompt: "Query database",
  options: {
    mcpServers: { database: dbConfig }
  }
});
```

✅ **Tool allowlisting**: Restrict which tools subagents can use

```typescript
agents: {
  'restricted-agent': {
    description: 'Security reviewer',
    tools: ['Read', 'Grep'],  // No Write or Bash
    prompt: '...'
  }
}
```

✅ **In-process SDK MCP servers**: Create custom tools without subprocess overhead

#### What IS NOT Possible

❌ **Agent-scoped MCP servers**: Cannot configure MCP servers visible ONLY to specific subagents

❌ **Prevent enumeration**: Main thread can list all MCP servers even if not allowed to use them

❌ **Context isolation for MCP tools**: Tool descriptions consume ~40k tokens globally

#### Workaround Strategy

Instead of using SDK subagents with Task tool delegation, you can achieve MCP isolation through:

**1. Separate Query Invocations**
```typescript
// Parent orchestrator (outside SDK)
async function orchestrateTask(task) {
  if (task.needsDatabase) {
    return await query({
      prompt: task.prompt,
      options: { mcpServers: { database: dbConfig } }
    });
  } else if (task.needsFilesystem) {
    return await query({
      prompt: task.prompt,
      options: { mcpServers: { filesystem: fsConfig } }
    });
  }
}
```

**2. External Task Router**
- Analyze task requirements outside SDK
- Route to appropriate query with isolated MCP configuration
- Combine results programmatically

**Trade-offs:**
- ✅ True MCP isolation
- ✅ No tool enumeration leakage
- ❌ Not using SDK subagent Task delegation
- ❌ Manual orchestration required
- ❌ No automatic parallel execution

## Capability Matrix

| Feature | Supported | Level | Notes |
|---------|-----------|-------|-------|
| Programmatic agent creation | ✅ Yes | SDK | Via `query()` function |
| Custom tool configuration | ✅ Yes | Per-agent | `allowedTools` / `disallowedTools` |
| MCP server configuration | ✅ Yes | Per-query | Via `mcpServers` option |
| In-process MCP servers | ✅ Yes | SDK | Via `createSdkMcpServer()` |
| Inline subagent definition | ✅ Yes | SDK | Via `agents` option |
| File-based subagents | ✅ Yes | CLI | Markdown in `.claude/agents/` |
| Tool inheritance control | ⚠️ Partial | Subagent | All or specific list |
| Different models per subagent | ✅ Yes | Subagent | Model field in AgentDefinition |
| Isolated context per subagent | ✅ Yes | Subagent | Automatic isolation |
| Parallel subagent execution | ✅ Yes | SDK | Automatic parallelization |
| Per-subagent MCP isolation | ❌ No | N/A | Issue #4476 - not implemented |
| Subagent MCP enumeration control | ❌ No | N/A | All servers visible globally |

## Complete Examples

### TypeScript: Multi-Agent System with Custom Tools

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// Create custom tools
const databaseTool = tool(
  "query_db",
  "Execute SQL queries",
  { sql: z.string() },
  async ({ sql }) => {
    // Database logic here
    return { content: [{ type: "text", text: "Results..." }] };
  }
);

const apiTool = tool(
  "call_api",
  "Make API requests",
  { endpoint: z.string(), method: z.string() },
  async ({ endpoint, method }) => {
    // API logic here
    return { content: [{ type: "text", text: "Response..." }] };
  }
);

// Create SDK MCP servers
const dbServer = createSdkMcpServer({
  name: "database",
  version: "1.0.0",
  tools: [databaseTool]
});

const apiServer = createSdkMcpServer({
  name: "api",
  version: "1.0.0",
  tools: [apiTool]
});

// Configure agents with different capabilities
const result = query({
  prompt: "Analyze user data and update external systems",
  options: {
    mcpServers: {
      database: dbServer,
      api: apiServer,
      filesystem: {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        env: { ALLOWED_PATHS: "/app/data" }
      }
    },
    agents: {
      'data-analyst': {
        description: 'Analyze data from database',
        prompt: 'You are a data analyst expert...',
        tools: ['Read', 'mcp__database__query_db'],
        model: 'sonnet'
      },
      'api-integrator': {
        description: 'Integrate with external APIs',
        prompt: 'You are an API integration specialist...',
        tools: ['Read', 'mcp__api__call_api'],
        model: 'sonnet'
      },
      'security-reviewer': {
        description: 'Review code for security issues',
        prompt: 'You are a security expert...',
        tools: ['Read', 'Grep'],  // No write access
        model: 'opus'
      }
    },
    allowedTools: [
      'Read', 'Write', 'Grep', 'Glob',
      'mcp__database__query_db',
      'mcp__api__call_api',
      'mcp__filesystem__list_files'
    ]
  }
});

for await (const message of result) {
  if (message.type === "assistant") {
    console.log("Assistant:", message.content);
  } else if (message.type === "result") {
    console.log("Result:", message.result);
  }
}
```

### Python: Custom Tools with Client

```python
import anyio
from claude_agent_sdk import (
    tool,
    create_sdk_mcp_server,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    AssistantMessage,
    TextBlock
)

# Define custom tools
@tool("calculate", "Perform calculations", {"expression": str})
async def calculate(args):
    result = eval(args["expression"])  # Use safely in production!
    return {
        "content": [
            {"type": "text", "text": f"Result: {result}"}
        ]
    }

@tool("search_docs", "Search documentation", {"query": str})
async def search_docs(args):
    # Search logic here
    return {
        "content": [
            {"type": "text", "text": f"Found docs for: {args['query']}"}
        ]
    }

# Create MCP servers
calc_server = create_sdk_mcp_server(
    name="calculator",
    version="1.0.0",
    tools=[calculate]
)

docs_server = create_sdk_mcp_server(
    name="docs",
    version="1.0.0",
    tools=[search_docs]
)

async def main():
    options = ClaudeAgentOptions(
        mcp_servers={
            "calculator": calc_server,
            "docs": docs_server
        },
        allowed_tools=[
            "Read",
            "mcp__calculator__calculate",
            "mcp__docs__search_docs"
        ],
        system_prompt="You are a helpful assistant with access to calculations and documentation."
    )
    
    async with ClaudeSDKClient(options=options) as client:
        await client.query("Calculate 15 * 23 and search for Python documentation")
        
        async for message in client.receive_response():
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")

if __name__ == "__main__":
    anyio.run(main)
```

## Recommendations

### For True MCP Isolation

1. **Use separate query invocations** instead of subagents if MCP isolation is critical
2. **Implement external orchestration** to route tasks to appropriate queries
3. **Monitor GitHub Issue #4476** for official support of agent-scoped MCP servers

### For Current SDK Usage

1. **Use tool allowlisting** to restrict subagent capabilities
2. **Leverage in-process SDK servers** for better performance
3. **Define agents programmatically** for dynamic configuration
4. **Use clear agent descriptions** for automatic task delegation

### Best Practices

1. **Minimize MCP servers** to reduce context consumption
2. **Use specific tool lists** for subagents rather than inheriting all
3. **Separate read-only and write-capable agents** for safety
4. **Test MCP tool naming** (remember `mcp__{server}__{tool}` format)
5. **Consider security implications** of shared MCP server access

## References

### Official Documentation
- Agent SDK Overview: https://docs.claude.com/en/api/agent-sdk/overview
- TypeScript Reference: https://docs.claude.com/en/api/agent-sdk/typescript
- Custom Tools: https://docs.claude.com/en/api/agent-sdk/custom-tools
- MCP in SDK: https://docs.claude.com/en/api/agent-sdk/mcp
- Subagents: https://docs.claude.com/en/api/agent-sdk/subagents
- MCP Configuration: https://code.claude.com/docs/en/mcp

### GitHub Repositories
- TypeScript SDK: https://github.com/anthropics/claude-agent-sdk-typescript
- Python SDK: https://github.com/anthropics/claude-agent-sdk-python
- SDK Demos: https://github.com/anthropics/claude-agent-sdk-demos

### NPM Packages
- TypeScript: `@anthropic-ai/claude-agent-sdk`
- Python: `claude-agent-sdk` (PyPI)

### Key Issues
- Issue #4476: Agent-Scoped MCP Configuration with Strict Isolation
  https://github.com/anthropics/claude-code/issues/4476

## Conclusion

The Claude Agent SDK provides powerful programmatic control over agent configurations, custom tools, and MCP servers. While it supports sophisticated multi-agent systems with tool restrictions and isolated contexts, **true MCP server isolation for subagents is not currently available**. 

Developers requiring strict MCP isolation should consider using separate query invocations with different MCP configurations, orchestrated externally, rather than relying on the SDK's subagent Task delegation mechanism.
