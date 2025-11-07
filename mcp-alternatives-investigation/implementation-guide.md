# Implementation Guide: Building Your Own Minimal Tool Set

This guide shows how to create your own minimal tool set following Mario Zechner's approach.

## Philosophy

1. **Start minimal**: Only build what you need
2. **Leverage agent knowledge**: Use APIs agents already understand (DOM, Node.js, Python stdlib)
3. **Keep interfaces simple**: CLI arguments and stdout/stderr
4. **Make it composable**: Work with pipes and redirects
5. **Extend on-demand**: Add tools as needs arise

## Example: Minimal Web Scraping Tools

### Step 1: Create Tool Directory

```bash
mkdir -p ~/agent-tools/simple-scraper
cd ~/agent-tools/simple-scraper
npm init -y
npm install puppeteer-core
```

### Step 2: Write README.md (Agent Documentation)

```markdown
# Simple Scraper Tools

Minimal web scraping tools using Puppeteer.

## Start Browser
\`\`\`bash
./start.js
\`\`\`
Starts Chrome with debugging on :9222

## Navigate
\`\`\`bash
./goto.js <url>
\`\`\`
Navigate to URL

## Get Text
\`\`\`bash
./text.js <selector>
\`\`\`
Extract text from elements matching selector

## Get Attribute
\`\`\`bash
./attr.js <selector> <attribute>
\`\`\`
Get attribute from element
```

**Token count**: ~150 tokens

### Step 3: Implement Tools

#### start.js (Browser Starter)
```javascript
#!/usr/bin/env node
import { spawn, execSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';

// Kill existing Chrome
try { execSync("killall 'Google Chrome'", { stdio: 'ignore' }); } catch {}
await new Promise(r => setTimeout(r, 1000));

// Start Chrome
spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--remote-debugging-port=9222', '--user-data-dir=/tmp/scraper-profile'],
  { detached: true, stdio: 'ignore' }
).unref();

// Wait for ready
for (let i = 0; i < 30; i++) {
  try {
    const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
    await browser.disconnect();
    console.log('✓ Browser ready on :9222');
    process.exit(0);
  } catch {
    await new Promise(r => setTimeout(r, 500));
  }
}
console.error('✗ Failed to start browser');
process.exit(1);
```

#### goto.js (Navigation)
```javascript
#!/usr/bin/env node
import puppeteer from 'puppeteer-core';

const url = process.argv[2];
if (!url) {
  console.error('Usage: goto.js <url>');
  process.exit(1);
}

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const pages = await browser.pages();
const page = pages[pages.length - 1];

await page.goto(url, { waitUntil: 'domcontentloaded' });
console.log('✓', url);

await browser.disconnect();
```

#### text.js (Text Extraction)
```javascript
#!/usr/bin/env node
import puppeteer from 'puppeteer-core';

const selector = process.argv[2];
if (!selector) {
  console.error('Usage: text.js <selector>');
  process.exit(1);
}

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const pages = await browser.pages();
const page = pages[pages.length - 1];

const texts = await page.$$eval(selector, els => els.map(el => el.textContent.trim()));
console.log(JSON.stringify(texts, null, 2));

await browser.disconnect();
```

#### attr.js (Attribute Extraction)
```javascript
#!/usr/bin/env node
import puppeteer from 'puppeteer-core';

const selector = process.argv[2];
const attribute = process.argv[3];

if (!selector || !attribute) {
  console.error('Usage: attr.js <selector> <attribute>');
  process.exit(1);
}

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const pages = await browser.pages();
const page = pages[pages.length - 1];

const attrs = await page.$$eval(
  selector,
  (els, attr) => els.map(el => el.getAttribute(attr)),
  attribute
);
console.log(JSON.stringify(attrs, null, 2));

await browser.disconnect();
```

### Step 4: Make Scripts Executable

```bash
chmod +x *.js
```

### Step 5: Test

```bash
./start.js
./goto.js https://news.ycombinator.com
./text.js '.titleline > a' | jq -r '.[]' | head -5
./attr.js '.titleline > a' href | jq -r '.[]' | head -5
```

### Step 6: Use with Agent

Tell your agent:
```
Please read ~/agent-tools/simple-scraper/README.md and use these tools to scrape the
top 10 articles from Hacker News. Save the titles and URLs to hn-articles.json
```

The agent will:
1. Read the README (150 tokens)
2. Execute commands:
   ```bash
   ./start.js
   ./goto.js https://news.ycombinator.com
   ./text.js '.titleline > a' > titles.json
   ./attr.js '.titleline > a' href > urls.json
   ```
3. Write code to combine:
   ```javascript
   // combine.js
   const titles = JSON.parse(fs.readFileSync('titles.json'));
   const urls = JSON.parse(fs.readFileSync('urls.json'));
   const articles = titles.slice(0, 10).map((title, i) => ({
     title,
     url: urls[i]
   }));
   fs.writeFileSync('hn-articles.json', JSON.stringify(articles, null, 2));
   ```
4. Execute: `node combine.js`

**Total context cost**: ~150 tokens (README) + ~200 tokens (combine.js) = **350 tokens**

Compare to Playwright MCP: **13,700 tokens** (39x more!)

## Adding New Tools On-Demand

### Example: Adding a Wait Tool

User: "I need to wait for an element before extracting text"

Agent can write:

```javascript
#!/usr/bin/env node
// wait.js
import puppeteer from 'puppeteer-core';

const selector = process.argv[2];
const timeout = parseInt(process.argv[3] || '30000');

const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
const pages = await browser.pages();
const page = pages[pages.length - 1];

await page.waitForSelector(selector, { timeout });
console.log('✓ Element ready:', selector);

await browser.disconnect();
```

Update README:
```markdown
## Wait for Element
\`\`\`bash
./wait.js <selector> [timeout_ms]
\`\`\`
Wait for element to appear (default 30s timeout)
```

**Time to implement**: < 2 minutes
**Additional context cost**: ~30 tokens (README update)

## Template for Other Use Cases

### File Processing Tools

```markdown
# File Tools

## Convert CSV to JSON
\`\`\`bash
./csv2json.js <input.csv> [output.json]
\`\`\`

## Filter JSON
\`\`\`bash
./filter-json.js <file.json> <jq-expression>
\`\`\`
```

### API Client Tools

```markdown
# API Tools

## GET Request
\`\`\`bash
./get.js <url> [auth-token]
\`\`\`

## POST Request
\`\`\`bash
./post.js <url> <data.json> [auth-token]
\`\`\`
```

### Database Tools

```markdown
# DB Tools

## Query
\`\`\`bash
./query.js <sql-file>
\`\`\`

## Export
\`\`\`bash
./export.js <table-name> [format]
\`\`\`
```

## Best Practices

### 1. Tool Design

**DO:**
- Accept input via CLI arguments
- Output results to stdout (data) and stderr (logs)
- Use JSON for structured data
- Return non-zero exit codes on errors
- Include usage message when called incorrectly

**DON'T:**
- Require configuration files for basic usage
- Mix logs and data in stdout
- Use custom formats (prefer JSON)
- Silently fail

### 2. README Documentation

**Include:**
- One-line description of what tool does
- Usage syntax with examples
- Common use cases
- Example composition with other tools

**Keep it minimal:**
- No long explanations (agent will figure it out)
- No implementation details
- No error handling docs
- Just: what it does, how to call it, examples

### 3. Error Handling

```javascript
// Good: Simple, clear error messages
if (!requiredArg) {
  console.error('Usage: tool.js <required-arg>');
  process.exit(1);
}

// Good: Propagate errors
try {
  await riskyOperation();
} catch (err) {
  console.error('✗ Operation failed:', err.message);
  process.exit(1);
}
```

### 4. Composability

Design tools to work together:

```bash
# Each tool does one thing
./goto.js https://example.com
./text.js '.price' | jq 'map(tonumber) | add / length'

# Pipe-friendly output
./get-data.js | jq '.items[]' | while read item; do
  ./process-item.js "$item"
done

# File-based composition
./scrape.js > raw.json
./transform.js raw.json > clean.json
./analyze.js clean.json > report.txt
```

## Comparison: MCP vs. Minimal Tools

| Aspect | MCP Server | Minimal Tools |
|--------|-----------|---------------|
| Initial setup | Install MCP server | Write 4-5 simple scripts |
| Context cost | 13k-23k tokens | 150-300 tokens |
| Extensibility | Modify server code | Write new script |
| Composability | Through agent context | Native (pipes, files) |
| Learning curve | Learn MCP protocol | Know bash + Node/Python |
| Flexibility | Fixed tool set | Infinite customization |
| Best for | Non-technical users | Technical users |

## When This Approach Shines

1. **Custom workflows**: Unique needs not covered by existing MCPs
2. **Rapid prototyping**: Building and testing quickly
3. **Context-constrained**: Limited context window
4. **Technical users**: Comfortable with scripts and CLI
5. **Evolving requirements**: Needs change frequently

## When to Use MCP Instead

1. **Non-technical users**: Need safe, standardized interfaces
2. **No code execution**: Sandboxed environments
3. **Cross-platform**: Same tools everywhere
4. **Stable requirements**: Well-defined, unchanging needs
5. **Pre-built solutions**: Existing MCP does exactly what you need

## Getting Started

1. **Identify a use case**: What do you do repeatedly?
2. **List minimum tools**: What 3-5 tools would cover 80% of needs?
3. **Write README first**: Document before implementing
4. **Implement one tool**: Start with the simplest
5. **Test with agent**: Does it work as expected?
6. **Iterate**: Add tools as needs arise

Remember: **Start minimal, extend on-demand, leverage agent knowledge.**

## Resources

- Mario's browser-tools: https://github.com/badlogic/browser-tools
- Puppeteer docs: https://pptr.dev/
- Node.js CLI guide: https://nodejs.dev/learn/accept-input-from-the-command-line
- jq tutorial: https://stedolan.github.io/jq/tutorial/
