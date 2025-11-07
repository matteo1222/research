"""
Simple Solutions for MCP Subagent Isolation (Python)

This file demonstrates practical workarounds for isolating MCP servers
to specific agents in Claude Code SDK.
"""

import anyio
from claude_agent_sdk import (
    ClaudeAgentOptions,
    ClaudeSDKClient,
    tool,
    create_sdk_mcp_server,
)

# ==============================================================================
# Solution 1: Query-Level Isolation (RECOMMENDED)
# ==============================================================================


async def solution1_query_level_isolation():
    """
    Instead of using SDK subagents with Task tool, create separate queries
    with different MCP server configurations.

    This achieves TRUE isolation - each query only sees its own MCP servers.
    """
    print("=== Solution 1: Query-Level Isolation ===\n")

    # Define MCP server configs
    filesystem_config = {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem"],
        "env": {"ALLOWED_PATHS": "/home/user/projects"},
    }

    playwright_config = {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-playwright"],
    }

    database_config = {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "env": {"DATABASE_URL": "postgresql://localhost/mydb"},
    }

    async def route_task(task_description: str):
        """Route tasks to appropriate isolated query based on requirements"""
        task_lower = task_description.lower()

        # Route to browser automation agent
        if "browser" in task_lower or "web scraping" in task_lower:
            print("→ Routing to Browser Agent (Playwright only)\n")
            options = ClaudeAgentOptions(
                mcp_servers={"playwright": playwright_config},
                system_prompt="You are a browser automation specialist.",
            )
            async with ClaudeSDKClient(options=options) as client:
                await client.query(task_description)
                return [msg async for msg in client.receive_response()]

        # Route to file processing agent
        elif "file" in task_lower or "directory" in task_lower:
            print("→ Routing to File Agent (Filesystem only)\n")
            options = ClaudeAgentOptions(
                mcp_servers={"filesystem": filesystem_config},
                system_prompt="You are a file operations specialist.",
            )
            async with ClaudeSDKClient(options=options) as client:
                await client.query(task_description)
                return [msg async for msg in client.receive_response()]

        # Route to database agent
        elif "database" in task_lower or "sql" in task_lower:
            print("→ Routing to Database Agent (Database only)\n")
            options = ClaudeAgentOptions(
                mcp_servers={"database": database_config},
                system_prompt="You are a database specialist.",
            )
            async with ClaudeSDKClient(options=options) as client:
                await client.query(task_description)
                return [msg async for msg in client.receive_response()]

        # Default: general agent with minimal tools
        else:
            print("→ Routing to General Agent (no MCP servers)\n")
            options = ClaudeAgentOptions(
                mcp_servers={},
                allowed_tools=["Read", "Write", "Bash"],
            )
            async with ClaudeSDKClient(options=options) as client:
                await client.query(task_description)
                return [msg async for msg in client.receive_response()]

    # Example usage
    tasks = [
        "Scrape product data from example.com",
        "List all Python files in src/",
        "Query users table for active accounts",
        "Explain what MCP servers are",
    ]

    for task in tasks:
        print(f'Task: "{task}"')
        await route_task(task)
        print()


# ==============================================================================
# Solution 2: Tool Allowlisting (Current Best Practice)
# ==============================================================================


async def solution2_tool_allowlisting():
    """
    Use SDK subagents normally but restrict tools via allowed_tools list.

    NOTE: This does NOT prevent enumeration - all MCP servers are still
    visible and consume context. But it prevents actual usage.
    """
    print("=== Solution 2: Tool Allowlisting ===\n")

    # All MCP servers configured (shared by everyone)
    options = ClaudeAgentOptions(
        mcp_servers={
            "playwright": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-playwright"],
            },
            "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem"],
                "env": {"ALLOWED_PATHS": "/home/user/projects"},
            },
        },
        # Main agent's allowed tools - Playwright excluded
        allowed_tools=[
            "Read",
            "Write",
            "Grep",
            "Glob",
            "mcp__filesystem__list_directory",
            "mcp__filesystem__read_file",
        ],
        system_prompt="You are a code analysis expert.",
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Analyze the codebase and write a report")

        async for message in client.receive_response():
            # Process messages...
            pass


# ==============================================================================
# Solution 3: In-Process SDK MCP Servers
# ==============================================================================


async def solution3_inprocess_mcp_servers():
    """
    Create lightweight custom tools using SDK's in-process MCP servers.

    Better performance than external MCP servers, but still shared across
    all agents in the same query.
    """
    print("=== Solution 3: In-Process SDK MCP Servers ===\n")

    # Create custom tools
    @tool("analyze_code", "Analyze code for patterns and issues", {"file_path": str, "check_type": str})
    async def analyze_code(args):
        file_path = args["file_path"]
        check_type = args["check_type"]
        # Custom analysis logic here
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Analyzed {file_path} for {check_type} issues: Found 0 critical issues.",
                }
            ]
        }

    @tool("generate_docs", "Generate documentation from code", {"file_path": str, "format": str})
    async def generate_docs(args):
        file_path = args["file_path"]
        doc_format = args["format"]
        # Doc generation logic here
        return {"content": [{"type": "text", "text": f"Generated {doc_format} documentation for {file_path}"}]}

    # Create SDK MCP servers
    code_tools_server = create_sdk_mcp_server(name="code-tools", version="1.0.0", tools=[analyze_code])

    docs_tools_server = create_sdk_mcp_server(name="docs-tools", version="1.0.0", tools=[generate_docs])

    options = ClaudeAgentOptions(
        mcp_servers={
            "code-tools": code_tools_server,
            "docs-tools": docs_tools_server,
        },
        allowed_tools=[
            "Read",
            "Grep",
            "mcp__code-tools__analyze_code",
            "mcp__docs-tools__generate_docs",
        ],
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Analyze and document the authentication module")

        async for message in client.receive_response():
            # Process messages...
            pass


# ==============================================================================
# Solution 4: External Orchestrator Pattern
# ==============================================================================


class AgentOrchestrator:
    """
    Build a sophisticated orchestrator that analyzes tasks and routes to
    appropriate isolated query invocations.
    """

    def __init__(self):
        self.browser_config = {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-playwright"],
        }

        self.filesystem_config = {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-filesystem"],
            "env": {"ALLOWED_PATHS": "/home/user/projects"},
        }

        self.database_config = {
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-postgres"],
            "env": {"DATABASE_URL": "postgresql://localhost/mydb"},
        }

    def analyze_task(self, task_description: str) -> dict:
        """Analyze task to determine required capabilities"""
        lower = task_description.lower()

        if "browser" in lower or "web" in lower:
            return {"category": "browser", "complexity": "complex", "tools": ["playwright"]}
        if "file" in lower or "directory" in lower:
            return {"category": "filesystem", "complexity": "simple", "tools": ["filesystem"]}
        if "database" in lower or "sql" in lower:
            return {"category": "database", "complexity": "complex", "tools": ["database"]}

        return {"category": "general", "complexity": "simple", "tools": []}

    async def execute_task(self, task_description: str):
        """Execute task with appropriate isolated MCP configuration"""
        task_type = self.analyze_task(task_description)

        print(f"Task Type: {task_type['category']} ({task_type['complexity']})")
        print(f"Required Tools: {', '.join(task_type['tools']) or 'none'}\n")

        category = task_type["category"]

        if category == "browser":
            return await self._execute_browser_task(task_description)
        elif category == "filesystem":
            return await self._execute_filesystem_task(task_description)
        elif category == "database":
            return await self._execute_database_task(task_description)
        else:
            return await self._execute_general_task(task_description)

    async def _execute_browser_task(self, prompt: str):
        print("→ Executing with Browser Agent (Playwright isolated)\n")
        options = ClaudeAgentOptions(
            mcp_servers={"playwright": self.browser_config},
            system_prompt="You are a browser automation expert.",
        )
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            return [msg async for msg in client.receive_response()]

    async def _execute_filesystem_task(self, prompt: str):
        print("→ Executing with Filesystem Agent (Filesystem isolated)\n")
        options = ClaudeAgentOptions(
            mcp_servers={"filesystem": self.filesystem_config},
            system_prompt="You are a file operations expert.",
        )
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            return [msg async for msg in client.receive_response()]

    async def _execute_database_task(self, prompt: str):
        print("→ Executing with Database Agent (Database isolated)\n")
        options = ClaudeAgentOptions(
            mcp_servers={"database": self.database_config},
            system_prompt="You are a database expert.",
        )
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            return [msg async for msg in client.receive_response()]

    async def _execute_general_task(self, prompt: str):
        print("→ Executing with General Agent (No MCP servers)\n")
        options = ClaudeAgentOptions(
            mcp_servers={},
            allowed_tools=["Read", "Write", "Bash", "Grep", "Glob"],
            system_prompt="You are a helpful assistant.",
        )
        async with ClaudeSDKClient(options=options) as client:
            await client.query(prompt)
            return [msg async for msg in client.receive_response()]

    async def execute_multiple_tasks(self, tasks: list[str]):
        """Execute multiple tasks in sequence"""
        results = []
        for task in tasks:
            result = await self.execute_task(task)
            results.append(result)
        return results


async def solution4_external_orchestrator():
    print("=== Solution 4: External Orchestrator Pattern ===\n")

    orchestrator = AgentOrchestrator()

    tasks = [
        "Scrape pricing data from competitors' websites",
        "List all markdown files in docs/",
        "Query database for user activity in last 30 days",
        "Explain the difference between async and sync functions",
    ]

    await orchestrator.execute_multiple_tasks(tasks)


# ==============================================================================
# Solution Comparison Example
# ==============================================================================


async def compare_approaches():
    """Side-by-side comparison of approaches"""
    print("=== Comparison: Subagent vs Query-Level Isolation ===\n")

    print("APPROACH 1: SDK Subagents (shared MCP servers)")
    print("→ All agents can see both filesystem AND playwright MCP servers")
    print("→ Context includes all tool descriptions (~40k tokens wasted)\n")

    print("APPROACH 2: Query-Level Isolation (isolated MCP servers)")
    options = ClaudeAgentOptions(
        mcp_servers={
            "filesystem": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-filesystem"],
            }
            # Playwright NOT included
        },
        system_prompt="Process files only",
    )

    async with ClaudeSDKClient(options=options) as client:
        await client.query("Process files")
        # Will only see filesystem MCP server

    print("→ Agent only sees filesystem MCP server")
    print("→ Context includes only filesystem tools (no wasted tokens)\n")


# ==============================================================================
# Main
# ==============================================================================


async def main():
    print("Claude Code SDK: MCP Subagent Isolation Solutions (Python)\n")
    print("=" * 70 + "\n")

    # Uncomment to run specific solutions:

    # await solution1_query_level_isolation()
    # await solution2_tool_allowlisting()
    # await solution3_inprocess_mcp_servers()
    # await solution4_external_orchestrator()
    # await compare_approaches()


if __name__ == "__main__":
    anyio.run(main)
