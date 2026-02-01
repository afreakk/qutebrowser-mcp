#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ipc } from "./ipc/client.js";
import { listTabs } from "./utils/session.js";
import { getHistory, formatHistoryEntry } from "./utils/history.js";
import { getBookmarks, getQuickmarks } from "./utils/bookmarks.js";

const server = new McpServer({
  name: "qutebrowser-mcp",
  version: "1.0.0",
});

// === TAB MANAGEMENT TOOLS ===

server.tool(
  "list_tabs",
  "List all open tabs in qutebrowser with their URLs, titles, and active state",
  {},
  async () => {
    try {
      const tabs = await listTabs();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(tabs, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "open_tab",
  "Open a new tab with the specified URL",
  {
    url: z.string().describe("URL to open"),
    background: z
      .boolean()
      .optional()
      .describe("Open in background tab (default: false)"),
  },
  async ({ url, background }) => {
    try {
      await ipc.open(url, { tab: true, background });
      return {
        content: [
          {
            type: "text",
            text: `Opened ${url} in ${background ? "background " : ""}tab`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "close_tab",
  "Close the current tab or a specific tab by index",
  {
    index: z
      .number()
      .int()
      .optional()
      .describe("Tab index (1-based). Omit to close current tab"),
  },
  async ({ index }) => {
    try {
      if (index && index > 0) {
        await ipc.tabFocus(index);
      }
      await ipc.tabClose();
      return {
        content: [
          {
            type: "text",
            text: `Closed tab ${index ? index : "(current)"}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "focus_tab",
  "Switch to a specific tab by index",
  {
    index: z
      .union([z.number().int(), z.string()])
      .describe(
        "Tab index (1-based, negative from end) or 'last' for previous tab"
      ),
  },
  async ({ index }) => {
    try {
      await ipc.tabFocus(index);
      return {
        content: [
          {
            type: "text",
            text: `Focused tab ${index}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "move_tab",
  "Move the current tab to a new position",
  {
    position: z
      .union([z.number().int(), z.string()])
      .describe(
        "Target position: absolute (1-based), relative (+1/-1), or +/- to move to end/start"
      ),
  },
  async ({ position }) => {
    try {
      await ipc.tabMove(position);
      return {
        content: [
          {
            type: "text",
            text: `Moved tab to position ${position}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// === NAVIGATION TOOLS ===

server.tool(
  "navigate",
  "Navigate to a URL in the current tab",
  {
    url: z.string().describe("URL or search term to navigate to"),
  },
  async ({ url }) => {
    try {
      await ipc.open(url);
      return {
        content: [
          {
            type: "text",
            text: `Navigating to ${url}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "go_back",
  "Navigate back in browser history",
  {
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of steps back (default: 1)"),
  },
  async ({ count }) => {
    try {
      await ipc.back(count);
      return {
        content: [
          {
            type: "text",
            text: `Navigated back ${count || 1} step(s)`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "go_forward",
  "Navigate forward in browser history",
  {
    count: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Number of steps forward (default: 1)"),
  },
  async ({ count }) => {
    try {
      await ipc.forward(count);
      return {
        content: [
          {
            type: "text",
            text: `Navigated forward ${count || 1} step(s)`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "reload_page",
  "Reload the current page",
  {
    force: z
      .boolean()
      .optional()
      .describe("Force reload bypassing cache (default: false)"),
  },
  async ({ force }) => {
    try {
      await ipc.reload(force);
      return {
        content: [
          {
            type: "text",
            text: `Page ${force ? "force " : ""}reloaded`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// === CONTENT TOOLS ===

server.tool(
  "screenshot",
  "Take a screenshot of the current page",
  {
    filename: z.string().describe("Output filename (PNG format)"),
    rect: z
      .string()
      .optional()
      .describe("Capture rectangle in format WxH+X+Y (e.g., 800x600+0+0)"),
  },
  async ({ filename, rect }) => {
    try {
      await ipc.screenshot(filename, rect);
      return {
        content: [
          {
            type: "text",
            text: `Screenshot saved to ${filename}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "execute_js",
  "Execute JavaScript code in the current page context. Note: Output is shown in qutebrowser's UI, not returned here.",
  {
    code: z.string().describe("JavaScript code to execute"),
    quiet: z
      .boolean()
      .optional()
      .describe("Suppress output messages in qutebrowser (default: false)"),
  },
  async ({ code, quiet }) => {
    try {
      await ipc.jseval(code, quiet);
      return {
        content: [
          {
            type: "text",
            text: "JavaScript executed (check qutebrowser for output)",
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// === BOOKMARKS/HISTORY TOOLS ===

server.tool(
  "get_bookmarks",
  "List all bookmarks saved in qutebrowser",
  {},
  async () => {
    try {
      const bookmarks = await getBookmarks();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(bookmarks, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "get_quickmarks",
  "List all quickmarks (named bookmarks) in qutebrowser",
  {},
  async () => {
    try {
      const quickmarks = await getQuickmarks();
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(quickmarks, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "search_history",
  "Search browsing history by URL or title",
  {
    query: z
      .string()
      .optional()
      .describe("Search query to filter by URL or title"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of results (default: 100)"),
  },
  async ({ query, limit }) => {
    try {
      const history = getHistory(limit || 100, query);
      const formatted = history.map(formatHistoryEntry);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formatted, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// === STARTUP ===

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("qutebrowser MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
