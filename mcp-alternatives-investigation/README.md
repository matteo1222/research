# Understanding "What if you don't need MCP at all?"

## Overview

Mario Zechner's article presents a compelling alternative to Model Context Protocol (MCP) servers: **instead of loading comprehensive MCP servers with dozens of tools, agents can simply write code and execute bash commands on-demand**. This investigation explores how this approach works and why it can be more efficient than traditional MCP servers.

**Article**: [What if you don't need MCP at all?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)
**Author**: Mario Zechner
**Date**: November 2, 2025

---

## The Core Argument

### The Problem with MCP Servers

MCP servers need to cover all possible use cases, which leads to:

1. **High context consumption**
   - Playwright MCP: 21 tools, **13,700 tokens** (6.8% of Claude's 200k context)
   - Chrome DevTools MCP: 26 tools, **18,000 tokens** (9.0% of Claude's context)
   - GitHub MCP: **23,000 tokens** (was ~50k before optimization)

2. **Lack of composability**
   - Results must flow through the agent's context
   - Can't easily pipe outputs to files or other tools
   - Difficult to chain operations

3. **Hard to extend**
   - Requires understanding the MCP server codebase
   - Modifying existing servers is complex
   - Can't quickly add custom functionality

4. **Tool confusion**
   - Dozens of tools can confuse the agent
   - Many tools are irrelevant for specific tasks
   - Increases chance of wrong tool selection

### The Solution: Embrace Bash and Code

**Key insight**: Modern AI agents are excellent at two things:
1. Writing code (JavaScript, Python, etc.)
2. Executing bash commands

These capabilities are:
- **Composable**: Can be chained with pipes, redirects, etc.
- **Flexible**: Write exactly what you need, when you need it
- **Efficient**: No upfront context cost
- **Extensible**: Add new capabilities in minutes

---

## Mario's Minimal Browser Tools

Instead of a 20+ tool MCP server, Mario created 4 simple Node.js scripts using Puppeteer Core:

### Tool 1: Start Chrome (`start.js`)
```bash
./start.js              # Fresh profile
./start.js --profile    # Copy your profile (cookies, logins)
```

**What it does:**
- Kills existing Chrome instances
- Optionally copies user's Chrome profile to temp directory (for logged-in sessions)
- Starts Chrome with remote debugging on port 9222
- Waits for Chrome to be ready

**Key benefit**: Can scrape as a logged-in user by using `--profile`

### Tool 2: Navigate (`nav.js`)
```bash
./nav.js https://example.com       # Navigate current tab
./nav.js https://example.com --new # Open new tab
```

**What it does:**
- Connects to Chrome via CDP (Chrome DevTools Protocol)
- Either navigates current tab or opens new tab
- Waits for DOM content to load

### Tool 3: Execute JavaScript (`eval.js`)
```bash
./eval.js 'document.title'
./eval.js 'document.querySelectorAll("a").length'
```

**What it does:**
- Runs JavaScript in the active page context
- Agent writes standard DOM manipulation code
- Returns results to stdout
- Supports async operations

**Key benefit**: Agent doesn't need to know Puppeteer API, just standard DOM APIs

### Tool 4: Screenshot (`screenshot.js`)
```bash
./screenshot.js
```

**What it does:**
- Takes screenshot of current viewport
- Saves to temporary directory
- Returns file path
- Agent can then use vision to analyze the image

### Total Context Cost: **225 tokens**

Compare to:
- Playwright MCP: **13,700 tokens** (60x more)
- Chrome DevTools MCP: **18,000 tokens** (80x more)

---

## Extension Examples

### The Pick Tool (`pick.js`)

For building scrapers faster, Mario added an interactive element picker:

```bash
./pick.js "Click the submit button"
```

**How it works:**
1. Injects a `pick()` function into the page
2. Creates visual overlay with hover highlighting
3. User clicks elements to select them
4. Returns element information (tag, id, class, text, HTML, parent hierarchy)
5. Supports multi-select with Cmd/Ctrl+click

**Development time**: Built and integrated in minutes
**Use case**: Instead of having agent analyze DOM structure, you just click elements

### The Cookies Tool

When Mario needed HTTP-only cookies for authenticated scraping:

**What he did:**
1. Asked Claude to create the tool
2. Claude wrote the script in < 1 minute
3. Added to README
4. Immediately usable

**Key point**: This would require modifying an MCP server's codebase if using traditional approach

---

## How It Works in Practice

### Example: Building a Hacker News Scraper

**Traditional MCP approach:**
1. Load Playwright MCP (13.7k tokens)
2. Use predefined tools
3. Results flow through agent context
4. Limited customization

**Mario's approach:**
1. Load README (225 tokens)
2. Start browser: `./start.js`
3. Navigate: `./nav.js https://news.ycombinator.com`
4. Pick elements: `./pick.js "Click on a story title"`
5. Agent writes custom scraper based on element info
6. Execute scraper: `node scraper.js > stories.json`
7. Process with standard tools: `jq '.[] | select(.score > 100)' stories.json`

**Token savings**: ~13,475 tokens (98.4% reduction)

### Real-World Setup

Mario's development environment:

1. **Directory structure:**
   ```
   ~/agent-tools/
     ├── browser-tools/
     │   ├── README.md
     │   ├── start.js
     │   ├── nav.js
     │   ├── eval.js
     │   ├── screenshot.js
     │   ├── pick.js
     │   └── ...
     └── other-tools/
   ```

2. **PATH setup:**
   ```bash
   alias cl="PATH=$PATH:/Users/badlogic/agent-tools/browser-tools claude --dangerously-skip-permissions"
   ```

3. **Naming convention:**
   - Prefix scripts with tool name: `browser-tools-start.js`
   - Avoids name collisions
   - Makes tools globally available

4. **Claude Code integration:**
   - Add agent-tools as working directory: `/add-dir ~/agent-tools`
   - Reference tools: `@browser-tools/README.md`
   - Progressive disclosure: only load docs when needed

---

## Key Benefits

### 1. **Massive Context Savings**

| Approach | Token Cost | Percentage of 200k Context |
|----------|-----------|---------------------------|
| Chrome DevTools MCP | 18,000 | 9.0% |
| Playwright MCP | 13,700 | 6.8% |
| Mario's Tools | 225 | 0.1% |

**Savings: 98.4% to 98.8% reduction in context usage**

### 2. **Composability**

**MCP servers:**
```
[Agent] → MCP Tool → [Agent Context] → MCP Tool → [Agent Context] → Save to file
```

**Bash/Code approach:**
```bash
./nav.js https://example.com && \
./eval.js 'Array.from(document.querySelectorAll("h2")).map(el => el.textContent)' | \
jq -r '.[]' | \
sort | \
uniq > titles.txt
```

Results flow directly between tools, no agent context required!

### 3. **Flexibility**

**Need a custom feature?**
- MCP: Modify server codebase, rebuild, redeploy
- Bash/Code: Write a 20-line script, done

**Example from article**: Cookies tool created in < 1 minute

### 4. **Simplicity**

Agent needs to know:
- MCP approach: MCP protocol + 20+ tool interfaces + parameters + error handling
- Bash/Code approach: How to write JavaScript/Python + how to use bash

**The agent already knows the latter!**

### 5. **Progressive Disclosure**

- Only load tool docs when needed
- No upfront context commitment
- Pay only for what you use

---

## When to Use Each Approach

### Use MCP Servers When:

1. **Non-technical users**: MCP provides standardized, safe interfaces
2. **No code execution**: Environment doesn't allow running arbitrary code
3. **Strict sandboxing**: Need security boundaries between agent and tools
4. **Cross-platform consistency**: Same tools across different environments
5. **Pre-built integrations**: Comprehensive APIs like GitHub, Slack, etc.

### Use Bash/Code Approach When:

1. **Technical users**: Comfortable with code execution
2. **Custom workflows**: Need specific functionality not in existing MCPs
3. **Rapid iteration**: Building and testing frequently
4. **Context constraints**: Working with limited context windows
5. **Composability matters**: Need to chain operations efficiently
6. **Dynamic requirements**: Use cases change frequently

---

## The Bigger Picture

Mario's approach isn't about replacing MCP entirely. It's about:

1. **Questioning defaults**: Do you really need that comprehensive MCP server?
2. **Understanding trade-offs**: Context cost vs. convenience
3. **Leveraging strengths**: Use what agents already do well
4. **Staying flexible**: Build tools as needed, not in advance

### The Philosophy

> "Agents can run Bash and write code well. Bash and code are composable. So what's simpler than having your agent just invoke CLI tools and write code?"
>
> — Mario Zechner

This applies beyond browser automation:
- File operations: Write custom scripts instead of file system MCPs
- API interactions: Use curl + jq instead of API-specific MCPs
- Data processing: Write Python/Node scripts instead of data tool MCPs
- Git operations: Use git CLI instead of git MCP

---

## Practical Examples

### Example 1: Web Scraping with Data Transformation

**MCP approach** (Playwright MCP + Data Processing MCP):
```
Load 13.7k tokens (Playwright) + 8k tokens (Data tools) = 21.7k tokens
Use playwright_navigate()
Use playwright_evaluate()
Results → Agent context
Use data_transform()
Results → Agent context
Use file_write()
```

**Bash/Code approach** (225 tokens):
```bash
./nav.js https://example.com
./eval.js 'Array.from(document.querySelectorAll(".item")).map(el => ({
  title: el.querySelector("h2").textContent,
  price: el.querySelector(".price").textContent,
  link: el.querySelector("a").href
}))' | jq 'map(select(.price | tonumber > 100))' > expensive-items.json
```

**Savings**: 21,475 tokens (99% reduction)

### Example 2: Multi-Site Data Aggregation

**Task**: Scrape product info from 5 competitor sites, combine, and analyze

**Bash/Code approach**:
```bash
# Scrape all sites in parallel
for site in site1 site2 site3 site4 site5; do
  (./nav.js "https://$site.com/products" && \
   ./eval.js 'scrapeProducts()' > "$site.json") &
done
wait

# Combine and analyze
jq -s 'add | group_by(.name) | map({name: .[0].name, prices: map(.price)})' *.json | \
jq 'map(. + {avg: (.prices | add / length)})' | \
jq 'sort_by(.avg)' > price-comparison.json

# Visualize
python3 plot_prices.py price-comparison.json
```

**Benefits**:
- Parallel execution
- Standard tools (jq, python)
- Direct file output
- Easy to modify and extend

---

## Code Examples

See the investigation folder for detailed examples:

- `example-mcp-approach.md`: How traditional MCP servers work
- `example-cli-approach.md`: How the bash/code approach works
- Side-by-side comparison with token costs

---

## Conclusion

Mario Zechner's article demonstrates that **MCP servers aren't always the answer**. For technical users with code execution capabilities, a bash/code approach offers:

- **98%+ context savings**
- **Infinite flexibility**
- **Natural composability**
- **Rapid extensibility**
- **Simpler mental model**

The key insight: **Modern agents are excellent at writing code and using bash. Why not leverage these capabilities instead of loading massive tool definitions?**

This doesn't mean MCP is bad—it's excellent for standardization, safety, and non-technical users. But when you have:
- Code execution environment
- Technical users
- Custom needs
- Context constraints

...then thinking "outside the MCP box" might be the better choice.

---

## Additional Resources

- **Article**: https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/
- **Mario's Browser Tools**: https://github.com/badlogic/browser-tools
- **Related reading**:
  - [Prompts are Code](https://mariozechner.at/posts/2025-06-02-prompts-are-code/)
  - [MCP vs CLI Benchmarks](https://mariozechner.at/posts/2025-08-15-mcp-vs-cli/)
  - [Armin's thoughts on Code vs MCPs](https://lucumr.pocoo.org/2025/8/18/code-mcps/)

---

*This investigation was conducted on November 7, 2025, analyzing Mario Zechner's article on alternatives to MCP servers.*
