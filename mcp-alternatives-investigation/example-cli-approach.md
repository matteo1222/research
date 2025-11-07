# Example: CLI/Code Approach

## Scenario
You want to scrape article titles from a news website.

## Direct Code/CLI Approach

### Step 1: No Upfront Loading
No tools need to be loaded. Agent already knows how to:
- Write JavaScript/Python
- Execute bash commands

**Context cost: 0 tokens**

### Step 2: Write Custom Script On-Demand
```javascript
Agent: I'll write a quick Puppeteer script to scrape the titles.

// scrape.js
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://news-site.com');

  const titles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('article h2'))
      .map(el => el.textContent.trim());
  });

  console.log(JSON.stringify(titles, null, 2));
  await browser.close();
})();
```

### Step 3: Execute and Get Results
```bash
node scrape.js > titles.json
```

### Context Flow
```
[Agent] → Writes script → Executes via bash → Direct output to file/stdout
```

No back-and-forth through agent context needed!

### Composability Examples

#### Example 1: Scrape and filter
```bash
node scrape.js | jq '.[] | select(contains("AI"))' > ai-titles.txt
```

#### Example 2: Scrape multiple sites and combine
```bash
node scrape.js news-site-1.com > site1.json
node scrape.js news-site-2.com > site2.json
jq -s 'add' site1.json site2.json > all-titles.json
```

#### Example 3: Scrape, transform, and commit
```bash
node scrape.js | jq -r '.[]' | sort | uniq > unique-titles.txt
git add unique-titles.txt
git commit -m "Update scraped titles"
```

### Easy Extension
Need to add a feature? Just modify the script:

```javascript
// Add image scraping
const data = await page.evaluate(() => ({
  titles: Array.from(document.querySelectorAll('article h2'))
    .map(el => el.textContent.trim()),
  images: Array.from(document.querySelectorAll('article img'))
    .map(el => el.src)
}));
```

No need to update an MCP server or reload tool definitions!

### Advantages
1. **Zero upfront cost**: No tool definitions to load
2. **Infinite flexibility**: Write exactly what you need
3. **Composability**: Use with any CLI tool (jq, grep, awk, curl, etc.)
4. **Direct output**: Results go straight to files/stdout
5. **Easy extension**: Just edit the script
6. **Reusable**: Save the script for future use

## Total Context Usage
- Initial: 0 tokens (no tool loading)
- Script creation: ~200-500 tokens (the actual code)
- **Minimum**: Only what you actually use

## Context Savings
Traditional approach: **13,700+ tokens**
CLI/Code approach: **~300 tokens**
**Savings: ~13,400 tokens (97.8% reduction)**
