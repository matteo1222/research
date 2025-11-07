# Investigation Notes: MCP Alternatives

## Objective
Explain how Mario Zechner's article "What if you don't need MCP at all?" works and understand the alternatives to MCP servers.

## Initial Research

### Article Information
- **Title**: What if you don't need MCP at all?
- **Author**: Mario Zechner
- **Date**: November 2, 2025
- **URL**: https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/
- **Note**: Direct fetch failed with 403, using search results to gather information

### Key Points from Search Results

#### Problems with MCP Servers (per Mario's article):
1. **Context consumption**: Large numbers of tools with lengthy descriptions consume significant context
   - Playwright MCP: 21 tools using 13.7k tokens (6.8% of Claude's context)
   - Chrome DevTools MCP: 26 tools using 18.0k tokens (9.0%)
2. **Extensibility**: Hard to extend existing MCP servers
3. **Composability**: MCP servers aren't composable
4. **Data flow**: Results must go through the agent's context to be persisted or combined

#### MCP Background Research:
- **Model Context Protocol (MCP)**: Open-source standard for connecting LLMs to external tools and data sources
- **Chrome DevTools MCP**: 26 tools in six categories for browser automation
- **Playwright MCP**: Browser automation using accessibility tree (structured data, no vision models)
- **Token optimization**: Some servers offer options like `includeSnapshot: false` for 70-80% token reduction

#### Context Tax Comparison:
- GitHub MCP: 23k tokens (was almost 50k initially)
- gh CLI: Same features, zero context tax

### Mario's Proposed Alternative:
Instead of MCP servers, use:
- **Bash commands**: Agents can run bash well
- **Code**: Agents can write code well
- **CLI tools**: Direct invocation of command-line tools
- **Composability**: Bash and code are naturally composable

The argument: This approach is simpler and more powerful than the rigid structure of MCP.

## Additional Research Findings

### CLI Tools for Web Scraping
**Puppeteer as CLI Alternative:**
- Installation: `npm install puppeteer` (bundles Chromium automatically)
- Can be used in bash scripts: `node scraper.js`
- Simple workflow: launch browser → navigate → extract → close
- Command-line arguments via `process.argv`
- Headless browser automation without GUI
- **Key advantage**: Write custom scripts as needed, no fixed tool interface

**Direct CLI Tools:**
- gh CLI for GitHub operations (vs GitHub MCP at 23k tokens)
- Standard command-line tools (curl, jq, etc.) with zero context tax
- Custom Node.js/Python scripts for specific tasks

### MCP Server Examples and Token Costs

**Popular MCP Servers:**
1. **Playwright MCP**: 21 tools, 13.7k tokens (6.8% of Claude's 200k context)
2. **Chrome DevTools MCP**: 26 tools, 18.0k tokens (9.0%)
3. **GitHub MCP**: 23k tokens (originally ~50k before optimization)

**Token Optimization in MCP:**
- `includeSnapshot: false` option: 70-80% token reduction
- Response filtering and batch execution features
- Still requires upfront context commitment for tool definitions

### Composability Advantage

**Bash/Code Benefits:**
1. **Natural composition**: Pipe operators, redirects, script chaining
2. **Dynamic tool creation**: Agent can write custom scripts on-the-fly
3. **No context overhead**: Tools don't need to be loaded upfront
4. **Flexibility**: Not limited to predefined tool interfaces
5. **Direct output handling**: Results can be piped, saved, transformed without going through agent context

**MCP Limitations:**
1. **Fixed interfaces**: Tools defined with specific parameters
2. **Context overhead**: All tool descriptions loaded upfront
3. **Extension difficulty**: Hard to modify existing servers
4. **Not composable**: Can't easily chain MCP tools together
5. **Indirect results**: Output must flow through agent context

## Key Insight

Mario's argument: Instead of loading 20+ browser automation tools (18k tokens), an agent could:
1. Write a simple Puppeteer/Playwright script on demand
2. Execute it via bash
3. Get results directly
4. Modify/extend the script as needed

This is more flexible, uses less context upfront, and leverages the agent's existing code-writing capabilities.

## Full Article Details (Received)

### Mario's Actual Tools
He built 4 minimal browser tools using Puppeteer Core:

1. **start.js**: Start Chrome with remote debugging on port 9222
   - Optional `--profile` flag to copy user's Chrome profile
   - Allows being logged in everywhere for scraping

2. **nav.js**: Navigate to URL
   - `nav.js <url>` - navigate current tab
   - `nav.js <url> --new` - open new tab

3. **eval.js**: Execute JavaScript in page context
   - Runs code using DOM API in the active tab
   - Agent doesn't need to know Puppeteer, just DOM manipulation

4. **screenshot.js**: Capture viewport screenshot
   - Saves to temp directory, returns path
   - Agent can then use vision to analyze

**Total tokens: 225** (vs 13,700 for Playwright MCP or 18,000 for Chrome DevTools MCP)

### Extension Examples from Article

**Pick Tool (pick.js)**: Interactive element picker
- Click to select DOM elements
- Cmd/Ctrl+click for multi-select
- Returns element info (tag, id, class, text, html, parents)
- Used for quickly building scrapers by pointing at elements

**Cookies Tool**: Extract HTTP-only cookies
- Created in < 1 minute by asking Claude
- Not possible with page context JavaScript
- Example of easy extensibility

### Real-World Setup

Mario's workflow:
1. Has `~/agent-tools/browser-tools` directory
2. Sets up PATH alias: `PATH=$PATH:/Users/badlogic/agent-tools/browser-tools`
3. Prefixes scripts: `browser-tools-start.js` to avoid collisions
4. Uses `@README.md` in Claude Code to inject tool docs as needed
5. Tools available globally but don't pollute normal environment

### Key Quote
"This general principle can apply to any kind of harness that has some kind of code execution environment. Think outside the MCP box and you'll find that this is much more powerful than the more rigid structure you have to follow with MCP."

## Completed
- ✓ Researched MCP background and token costs
- ✓ Found alternatives and CLI approaches
- ✓ Received full article content
- ✓ Created comparison examples
- Ready to write comprehensive README
