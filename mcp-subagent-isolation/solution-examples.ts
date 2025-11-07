/**
 * Simple Solutions for MCP Subagent Isolation
 *
 * This file demonstrates practical workarounds for isolating MCP servers
 * to specific agents in Claude Code SDK.
 */

import { query, createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

// ==============================================================================
// Solution 1: Query-Level Isolation (RECOMMENDED)
// ==============================================================================

/**
 * Instead of using SDK subagents with Task tool, create separate query()
 * invocations with different MCP server configurations.
 *
 * This achieves TRUE isolation - each query only sees its own MCP servers.
 */

async function solution1_QueryLevelIsolation() {
  console.log("=== Solution 1: Query-Level Isolation ===\n");

  // Define MCP server configs
  const playwrightConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-playwright"],
  };

  const filesystemConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    env: { ALLOWED_PATHS: "/home/user/projects" },
  };

  const databaseConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    env: { DATABASE_URL: "postgresql://localhost/mydb" },
  };

  // Task router - decides which query to use based on task type
  async function routeTask(taskDescription: string) {
    const taskLower = taskDescription.toLowerCase();

    // Route to browser automation agent
    if (taskLower.includes("browser") || taskLower.includes("web scraping")) {
      console.log("→ Routing to Browser Agent (Playwright only)\n");
      return await query({
        prompt: taskDescription,
        options: {
          mcpServers: {
            playwright: playwrightConfig, // ONLY Playwright
          },
          systemPrompt: "You are a browser automation specialist.",
        },
      });
    }

    // Route to file processing agent
    if (taskLower.includes("file") || taskLower.includes("directory")) {
      console.log("→ Routing to File Agent (Filesystem only)\n");
      return await query({
        prompt: taskDescription,
        options: {
          mcpServers: {
            filesystem: filesystemConfig, // ONLY Filesystem
          },
          systemPrompt: "You are a file operations specialist.",
        },
      });
    }

    // Route to database agent
    if (taskLower.includes("database") || taskLower.includes("sql")) {
      console.log("→ Routing to Database Agent (Database only)\n");
      return await query({
        prompt: taskDescription,
        options: {
          mcpServers: {
            database: databaseConfig, // ONLY Database
          },
          systemPrompt: "You are a database specialist.",
        },
      });
    }

    // Default: general agent with minimal tools
    console.log("→ Routing to General Agent (no MCP servers)\n");
    return await query({
      prompt: taskDescription,
      options: {
        mcpServers: {}, // No MCP servers
        allowedTools: ["Read", "Write", "Bash"],
      },
    });
  }

  // Example usage
  const tasks = [
    "Scrape product data from example.com",
    "List all TypeScript files in src/",
    "Query users table for active accounts",
    "Explain what MCP servers are",
  ];

  for (const task of tasks) {
    console.log(`Task: "${task}"`);
    const result = await routeTask(task);
    // Process result...
    console.log();
  }
}

// ==============================================================================
// Solution 2: Tool Allowlisting (Current Best Practice)
// ==============================================================================

/**
 * Use SDK subagents normally but restrict tools via allowedTools array.
 *
 * NOTE: This does NOT prevent enumeration - all MCP servers are still
 * visible and consume context. But it prevents actual usage.
 */

async function solution2_ToolAllowlisting() {
  console.log("=== Solution 2: Tool Allowlisting ===\n");

  const result = query({
    prompt: "Analyze the codebase and write a report",
    options: {
      // All MCP servers configured here (shared by everyone)
      mcpServers: {
        playwright: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-playwright"],
        },
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
          env: { ALLOWED_PATHS: "/home/user/projects" },
        },
      },

      // Define subagents with different tool restrictions
      agents: {
        "code-analyzer": {
          description: "Analyze code structure and patterns",
          prompt: "You are a code analysis expert.",
          // Only allow filesystem tools, NOT Playwright
          tools: [
            "Read",
            "Grep",
            "Glob",
            "mcp__filesystem__list_directory",
            "mcp__filesystem__read_file",
          ],
          model: "sonnet",
        },
        "report-writer": {
          description: "Write documentation and reports",
          prompt: "You are a technical writer.",
          // No MCP tools at all
          tools: ["Read", "Write"],
          model: "sonnet",
        },
      },

      // Main agent's allowed tools
      allowedTools: [
        "Read",
        "Write",
        "Grep",
        "Glob",
        "mcp__filesystem__list_directory",
        "mcp__filesystem__read_file",
        // Note: Playwright tools NOT in main agent's allowed list
      ],
    },
  });

  for await (const message of result) {
    // Process messages...
  }
}

// ==============================================================================
// Solution 3: In-Process SDK MCP Servers
// ==============================================================================

/**
 * Create lightweight custom tools using SDK's in-process MCP servers.
 *
 * Better performance than external MCP servers, but still shared across
 * all agents in the same query.
 */

async function solution3_InProcessMcpServers() {
  console.log("=== Solution 3: In-Process SDK MCP Servers ===\n");

  // Create custom tools
  const analyzeCodeTool = tool(
    "analyze_code",
    "Analyze code for patterns and issues",
    { filePath: z.string(), checkType: z.enum(["security", "performance", "style"]) },
    async ({ filePath, checkType }) => {
      // Custom analysis logic here
      return {
        content: [
          {
            type: "text",
            text: `Analyzed ${filePath} for ${checkType} issues: Found 0 critical issues.`,
          },
        ],
      };
    }
  );

  const generateDocsTool = tool(
    "generate_docs",
    "Generate documentation from code",
    { filePath: z.string(), format: z.enum(["markdown", "html"]) },
    async ({ filePath, format }) => {
      // Doc generation logic here
      return {
        content: [
          {
            type: "text",
            text: `Generated ${format} documentation for ${filePath}`,
          },
        ],
      };
    }
  );

  // Create SDK MCP servers
  const codeToolsServer = createSdkMcpServer({
    name: "code-tools",
    version: "1.0.0",
    tools: [analyzeCodeTool],
  });

  const docsToolsServer = createSdkMcpServer({
    name: "docs-tools",
    version: "1.0.0",
    tools: [generateDocsTool],
  });

  const result = query({
    prompt: "Analyze and document the authentication module",
    options: {
      mcpServers: {
        "code-tools": codeToolsServer,
        "docs-tools": docsToolsServer,
      },
      agents: {
        "code-analyzer": {
          description: "Analyze code quality",
          prompt: "You are a code analysis expert.",
          tools: ["Read", "Grep", "mcp__code-tools__analyze_code"],
          model: "sonnet",
        },
        "doc-generator": {
          description: "Generate documentation",
          prompt: "You are a documentation specialist.",
          tools: ["Read", "Write", "mcp__docs-tools__generate_docs"],
          model: "sonnet",
        },
      },
    },
  });

  for await (const message of result) {
    // Process messages...
  }
}

// ==============================================================================
// Solution 4: External Orchestrator Pattern
// ==============================================================================

/**
 * Build a sophisticated orchestrator that analyzes tasks and routes to
 * appropriate isolated query invocations.
 */

interface TaskType {
  category: "browser" | "filesystem" | "database" | "general";
  complexity: "simple" | "complex";
  tools: string[];
}

class AgentOrchestrator {
  private browserConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-playwright"],
  };

  private filesystemConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    env: { ALLOWED_PATHS: "/home/user/projects" },
  };

  private databaseConfig = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    env: { DATABASE_URL: "postgresql://localhost/mydb" },
  };

  /**
   * Analyze task to determine required capabilities
   */
  private analyzeTask(taskDescription: string): TaskType {
    const lower = taskDescription.toLowerCase();

    // Simple pattern matching (could use LLM for better accuracy)
    if (lower.includes("browser") || lower.includes("web")) {
      return { category: "browser", complexity: "complex", tools: ["playwright"] };
    }
    if (lower.includes("file") || lower.includes("directory")) {
      return { category: "filesystem", complexity: "simple", tools: ["filesystem"] };
    }
    if (lower.includes("database") || lower.includes("sql")) {
      return { category: "database", complexity: "complex", tools: ["database"] };
    }

    return { category: "general", complexity: "simple", tools: [] };
  }

  /**
   * Execute task with appropriate isolated MCP configuration
   */
  async executeTask(taskDescription: string) {
    const taskType = this.analyzeTask(taskDescription);

    console.log(`Task Type: ${taskType.category} (${taskType.complexity})`);
    console.log(`Required Tools: ${taskType.tools.join(", ") || "none"}\n`);

    switch (taskType.category) {
      case "browser":
        return await this.executeBrowserTask(taskDescription);

      case "filesystem":
        return await this.executeFilesystemTask(taskDescription);

      case "database":
        return await this.executeDatabaseTask(taskDescription);

      default:
        return await this.executeGeneralTask(taskDescription);
    }
  }

  private async executeBrowserTask(prompt: string) {
    console.log("→ Executing with Browser Agent (Playwright isolated)\n");
    return await query({
      prompt,
      options: {
        mcpServers: {
          playwright: this.browserConfig,
        },
        systemPrompt: "You are a browser automation expert.",
        model: "claude-3-5-sonnet-20241022",
      },
    });
  }

  private async executeFilesystemTask(prompt: string) {
    console.log("→ Executing with Filesystem Agent (Filesystem isolated)\n");
    return await query({
      prompt,
      options: {
        mcpServers: {
          filesystem: this.filesystemConfig,
        },
        systemPrompt: "You are a file operations expert.",
        model: "claude-3-5-sonnet-20241022",
      },
    });
  }

  private async executeDatabaseTask(prompt: string) {
    console.log("→ Executing with Database Agent (Database isolated)\n");
    return await query({
      prompt,
      options: {
        mcpServers: {
          database: this.databaseConfig,
        },
        systemPrompt: "You are a database expert.",
        model: "claude-3-5-sonnet-20241022",
      },
    });
  }

  private async executeGeneralTask(prompt: string) {
    console.log("→ Executing with General Agent (No MCP servers)\n");
    return await query({
      prompt,
      options: {
        mcpServers: {},
        allowedTools: ["Read", "Write", "Bash", "Grep", "Glob"],
        systemPrompt: "You are a helpful assistant.",
        model: "claude-3-5-sonnet-20241022",
      },
    });
  }

  /**
   * Execute multiple tasks in parallel (where possible)
   */
  async executeMultipleTasks(tasks: string[]) {
    const taskTypes = tasks.map((task) => ({
      task,
      type: this.analyzeTask(task),
    }));

    // Group tasks by category for potential batching
    const tasksByCategory = taskTypes.reduce(
      (acc, { task, type }) => {
        if (!acc[type.category]) {
          acc[type.category] = [];
        }
        acc[type.category].push(task);
        return acc;
      },
      {} as Record<string, string[]>
    );

    // Execute tasks by category
    const results = [];
    for (const [category, categoryTasks] of Object.entries(tasksByCategory)) {
      console.log(`\nExecuting ${categoryTasks.length} ${category} tasks...`);
      for (const task of categoryTasks) {
        const result = await this.executeTask(task);
        results.push(result);
      }
    }

    return results;
  }
}

async function solution4_ExternalOrchestrator() {
  console.log("=== Solution 4: External Orchestrator Pattern ===\n");

  const orchestrator = new AgentOrchestrator();

  const tasks = [
    "Scrape pricing data from competitors' websites",
    "List all markdown files in docs/",
    "Query database for user activity in last 30 days",
    "Explain the difference between async and sync functions",
  ];

  await orchestrator.executeMultipleTasks(tasks);
}

// ==============================================================================
// Solution Comparison Example
// ==============================================================================

/**
 * Side-by-side comparison of approaches
 */

async function compareApproaches() {
  console.log("=== Comparison: Subagent vs Query-Level Isolation ===\n");

  // Traditional SDK subagents (all MCP servers shared)
  console.log("APPROACH 1: SDK Subagents (shared MCP servers)");
  const traditionalApproach = query({
    prompt: "Process files",
    options: {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
        playwright: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-playwright"],
        },
      },
      agents: {
        "file-processor": {
          description: "Process files",
          tools: ["Read", "mcp__filesystem__list_directory"],
          prompt: "Process files only",
        },
      },
    },
  });
  console.log("→ file-processor can see both filesystem AND playwright MCP servers");
  console.log("→ Context includes all tool descriptions (~40k tokens wasted)\n");

  // Query-level isolation (true separation)
  console.log("APPROACH 2: Query-Level Isolation (isolated MCP servers)");
  const isolatedApproach = await query({
    prompt: "Process files",
    options: {
      mcpServers: {
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem"],
        },
        // Playwright NOT included
      },
      systemPrompt: "Process files only",
    },
  });
  console.log("→ Agent only sees filesystem MCP server");
  console.log("→ Context includes only filesystem tools (no wasted tokens)\n");
}

// ==============================================================================
// Main
// ==============================================================================

async function main() {
  console.log("Claude Code SDK: MCP Subagent Isolation Solutions\n");
  console.log("=" .repeat(70) + "\n");

  // Uncomment to run specific solutions:

  // await solution1_QueryLevelIsolation();
  // await solution2_ToolAllowlisting();
  // await solution3_InProcessMcpServers();
  // await solution4_ExternalOrchestrator();
  // await compareApproaches();
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  solution1_QueryLevelIsolation,
  solution2_ToolAllowlisting,
  solution3_InProcessMcpServers,
  solution4_ExternalOrchestrator,
  AgentOrchestrator,
  compareApproaches,
};
