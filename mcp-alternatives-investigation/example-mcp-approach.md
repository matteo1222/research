# Example: MCP Approach

## Scenario
You want to scrape article titles from a news website.

## MCP Server Approach

### Step 1: Load MCP Server (Context Cost)
When you connect a Playwright MCP server, you load:
- 21 tools with descriptions: ~13,700 tokens
- Tool schemas, parameters, examples

Example tools loaded:
- `playwright_navigate(url, timeout)`
- `playwright_screenshot(selector, path)`
- `playwright_click(selector)`
- `playwright_fill(selector, value)`
- `playwright_evaluate(expression)`
- `playwright_wait_for_selector(selector, timeout)`
- `playwright_get_attribute(selector, attribute)`
- ... 14 more tools

### Step 2: Use Tools
```
Agent: I'll use the playwright tools to scrape the website.

1. Call: playwright_navigate("https://news-site.com")
2. Call: playwright_wait_for_selector("article h2")
3. Call: playwright_evaluate("Array.from(document.querySelectorAll('article h2')).map(el => el.textContent)")
4. Receive result through agent context
5. Call: playwright_close()
```

### Context Flow
```
[Agent Context] ← Tool Definitions (13.7k tokens)
      ↓
[Agent Context] → Tool Call 1 → [MCP Server] → Result → [Agent Context]
      ↓
[Agent Context] → Tool Call 2 → [MCP Server] → Result → [Agent Context]
      ↓
[Agent Context] → Tool Call 3 → [MCP Server] → Result → [Agent Context]
```

### Limitations
1. **Upfront cost**: 13.7k tokens loaded even if you only use 2-3 tools
2. **Fixed interface**: Can only use the predefined tools
3. **No composition**: Can't easily combine with other tools (e.g., jq, grep)
4. **Indirect results**: All data flows through agent context
5. **Extension**: If you need a custom feature, you must modify the MCP server

## Total Context Usage
- Initial: 13,700 tokens (tool definitions)
- Per interaction: Tool calls + results through agent context
- **Minimum**: 13,700 tokens even for simplest task
