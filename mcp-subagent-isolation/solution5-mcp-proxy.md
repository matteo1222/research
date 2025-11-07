# Solution 5: MCP Proxy Server (BEST SOLUTION FOR CLI USE)

## Overview

**This solution works with your daily Claude Code CLI driver!** No SDK needed, no custom code.

Instead of connecting Claude Code to multiple MCP servers directly, connect it to ONE proxy server that aggregates and filters tools from multiple backends.

```
Claude Code CLI (your daily driver)
      ↓
  [MCP Proxy Server] ← Single MCP connection
      ↓ ↓ ↓ ↓
   [Playwright] [Filesystem] [Database] [Other MCPs]
```

## Why This is Perfect for Your Use Case

✅ **Works with interactive CLI/REPL** - Use Claude Code normally
✅ **Reduce context pollution** - Enable/disable individual tools
✅ **Single configuration** - One entry in `.mcp.json`
✅ **Web UI for management** - Toggle tools on/off easily
✅ **No custom code needed** - Just install and configure
✅ **Dynamic control** - Change tool availability without restart

## Recommended Implementation: ptbsare/mcp-proxy-server

**GitHub:** https://github.com/ptbsare/mcp-proxy-server

### Key Features

1. **Aggregates multiple MCP backends** (Stdio, SSE, HTTP)
2. **Tool-level enable/disable** via `tool_config.json`
3. **Web Admin UI** for managing tools
4. **Live reload** - changes apply without restart
5. **Tool overrides** - customize names/descriptions
6. **Authentication** - API key or Bearer token

## Installation & Setup

### Step 1: Install the Proxy

```bash
# Clone the repository
git clone https://github.com/ptbsare/mcp-proxy-server.git
cd mcp-proxy-server

# Install dependencies
npm install

# Build
npm run build
```

### Step 2: Configure Backend MCP Servers

Create `config/mcp_server.json`:

```json
{
  "playwright": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-playwright"],
    "disabled": false
  },
  "filesystem": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"],
    "env": {
      "ALLOWED_PATHS": "/home/user/projects"
    },
    "disabled": false
  },
  "database": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "DATABASE_URL": "postgresql://localhost/mydb"
    },
    "disabled": false
  }
}
```

### Step 3: Configure Tool Filtering

Create `config/tool_config.json` to enable/disable individual tools:

```json
{
  "playwright__playwright_navigate": {
    "disabled": false,
    "displayName": "Navigate Browser",
    "description": "Navigate to a URL in the browser"
  },
  "playwright__playwright_screenshot": {
    "disabled": false
  },
  "filesystem__read_file": {
    "disabled": false
  },
  "filesystem__list_directory": {
    "disabled": false
  },
  "database__execute_query": {
    "disabled": true,  // Disabled by default
    "description": "Execute SQL query (use with caution)"
  }
}
```

**Tool naming format:** `{server-key}__{tool-name}`

### Step 4: Configure the Proxy Server

Create `.env` file:

```bash
# Server mode (stdio, sse, or http)
SERVER_MODE=stdio

# Enable web admin UI for tool management
ENABLE_ADMIN_UI=true
ADMIN_UI_PORT=3000

# API key for securing endpoints (if using SSE/HTTP mode)
ALLOWED_KEYS=your-secret-key-here

# Tool name separator (default: __)
SERVER_TOOLNAME_SEPERATOR=__

# Retry configurations
SSE_TOOL_CALL_MAX_RETRIES=3
HTTP_TOOL_CALL_MAX_RETRIES=3
```

### Step 5: Start the Proxy

```bash
npm start
```

If `ENABLE_ADMIN_UI=true`, open http://localhost:3000 to manage tools via web UI.

### Step 6: Configure Claude Code CLI

Update your `.mcp.json` to connect to the proxy instead of individual servers:

```json
{
  "mcpServers": {
    "proxy": {
      "command": "node",
      "args": ["/path/to/mcp-proxy-server/build/index.js"],
      "env": {
        "SERVER_MODE": "stdio"
      }
    }
  }
}
```

## Usage Patterns

### Pattern 1: Minimal Initial Tools

Start with most tools disabled in `tool_config.json`. Enable only when needed:

```json
{
  // Most tools disabled by default
  "playwright__playwright_navigate": { "disabled": true },
  "filesystem__read_file": { "disabled": false },  // Keep basics
  "filesystem__write_file": { "disabled": true }
}
```

When you need browser automation:
1. Open admin UI (http://localhost:3000)
2. Enable Playwright tools
3. Changes apply immediately (live reload)

### Pattern 2: Context-Based Profiles

Create different `tool_config.json` profiles:

**`tool_config.minimal.json`** - General work
```json
{
  "filesystem__read_file": { "disabled": false },
  "filesystem__list_directory": { "disabled": false }
  // Only basic file operations
}
```

**`tool_config.webdev.json`** - Web development
```json
{
  "filesystem__read_file": { "disabled": false },
  "playwright__playwright_navigate": { "disabled": false },
  "playwright__playwright_screenshot": { "disabled": false }
  // File + browser tools
}
```

**`tool_config.data.json`** - Data analysis
```json
{
  "filesystem__read_file": { "disabled": false },
  "database__execute_query": { "disabled": false }
  // File + database tools
}
```

Switch profiles by copying:
```bash
cp tool_config.webdev.json config/tool_config.json
# Proxy auto-reloads
```

### Pattern 3: Subagent-Specific Exposure

While you can't isolate tools to ONLY subagents, you can:
1. Keep heavyweight tools (Playwright) disabled by default
2. Tell Claude "enable Playwright tools before delegating to browser agent"
3. Claude can use admin UI or you manually enable via UI
4. After task completes, disable again

## Advanced Features

### Web Admin UI

Access at http://localhost:3000 (if `ENABLE_ADMIN_UI=true`):

- **Server Management**: Add/edit/delete backend servers
- **Tool Toggle**: Enable/disable individual tools with checkboxes
- **Tool Customization**: Override display names and descriptions
- **Live Preview**: See changes immediately
- **Installation Monitor**: Watch Stdio server installation output

### Authentication (SSE/HTTP Mode)

For remote access or SSE mode:

```bash
# In .env
ALLOWED_KEYS=key1,key2,key3
# or
ALLOWED_TOKENS=token1,token2

# Claude Code connects via HTTP
{
  "mcpServers": {
    "proxy": {
      "transport": "sse",
      "url": "http://localhost:3000/sse",
      "headers": {
        "X-Api-Key": "key1"
      }
    }
  }
}
```

### Custom Tool Separator

If backend tools have `__` in names, change separator:

```bash
SERVER_TOOLNAME_SEPERATOR=::
```

Tools become: `playwright::navigate`, `filesystem::read_file`

## Alternative: FastMCP Proxy

**GitHub:** https://www.jlowin.dev/blog/fastmcp-proxy

Another option using FastMCP framework:

```python
from fastmcp import FastMCP

# Create proxy that aggregates multiple MCP servers
proxy = FastMCP.as_proxy([
    {"name": "playwright", "config": playwright_config},
    {"name": "filesystem", "config": filesystem_config}
])

# Tools are prefixed: playwright_navigate, filesystem_read_file
```

**Pros:**
- Simple Python API
- Good for programmatic proxy creation

**Cons:**
- No built-in web UI for tool management
- Less mature than ptbsare/mcp-proxy-server

## Comparison with Other Solutions

| Feature | Proxy (this) | SDK Query-Level | Tool Allowlist | External Orchestrator |
|---------|-------------|----------------|----------------|----------------------|
| Works with CLI | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| REPL/Interactive | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| True isolation | ⚠️ Partial* | ✅ Yes | ❌ No | ✅ Yes |
| Reduces context | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| Easy to use | ✅ Yes | ❌ Complex | ✅ Simple | ❌ Complex |
| Dynamic control | ✅ Yes | ❌ Static | ❌ Static | ⚠️ Custom |
| Web UI | ✅ Yes | ❌ No | ❌ No | ❌ No |

\* Tools can be hidden from main agent, but all subagents still share the same proxy

## Limitations

1. **Not true per-subagent isolation** - All agents (main + subagents) see the same proxy tools
2. **Manual management** - Need to enable/disable tools yourself (unless automated)
3. **Extra process** - Proxy runs as separate service
4. **Latency** - Additional hop for tool calls

## Future Enhancement Ideas

### Idea 1: Tool Discovery Meta-Tool

Expose a "search_tools" function that agents can call:

```json
// Add to tool_config.json
{
  "_meta__search_tools": {
    "disabled": false,
    "description": "Search for available tools by keyword"
  }
}
```

The proxy could implement this tool to:
1. Search across all backend servers
2. Return matching tool names
3. Optionally auto-enable them

### Idea 2: Session-Based Tool Sets

Track which tools each conversation session uses:
- Main thread uses minimal tools
- Subagent sessions get specialized tool sets
- Auto-cleanup after session ends

This would require proxy modifications to track session context.

### Idea 3: AI-Powered Tool Selection

Proxy uses a small LLM to analyze task descriptions and auto-enable relevant tools:

```
User: "Scrape pricing from competitor websites"
Proxy LLM: Detects "scrape" + "websites" → Enables Playwright tools
Claude: Sees Playwright tools, uses them
```

## Conclusion

**This is the best practical solution for your daily driver use case.**

✅ Works with Claude Code CLI (your REPL)
✅ Reduces context pollution (enable/disable tools)
✅ Production-ready (existing implementations)
✅ Easy to set up and use
✅ Web UI for management

While it doesn't provide **true per-subagent isolation** (all agents share the same proxy), it significantly reduces context waste by letting you control exactly which tools are exposed.

## Resources

- **ptbsare/mcp-proxy-server**: https://github.com/ptbsare/mcp-proxy-server
- **adamwattis/mcp-proxy-server**: https://github.com/adamwattis/mcp-proxy-server
- **FastMCP Proxy Guide**: https://www.jlowin.dev/blog/fastmcp-proxy
- **MCP Dynamic Tools**: https://github.com/scitara-cto/dynamic-mcp-server
- **MCP Specification**: https://modelcontextprotocol.io/docs/concepts/tools

## Next Steps

1. **Try it now**: Install ptbsare/mcp-proxy-server
2. **Configure backends**: Add your existing MCP servers
3. **Filter tools**: Disable non-essential tools
4. **Test with Claude Code**: Connect CLI to proxy
5. **Tune as needed**: Adjust tool availability based on usage

This gives you immediate reduction in context pollution while waiting for official per-subagent MCP isolation (GitHub issue #4476).
