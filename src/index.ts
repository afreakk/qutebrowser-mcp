#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { ipc } from "./ipc/client.js";
import { cdp } from "./cdp/client.js";
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
      if (index !== undefined && index > 0) {
        await ipc.tabCloseByIndex(index);
      } else {
        await ipc.tabClose();
      }
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

// === CDP TOOLS ===

server.tool(
  "cdp_evaluate",
  "Execute JavaScript in a browser tab via Chrome DevTools Protocol and return the result. Requires qutebrowser to be running with --qt-arg remote-debugging-port 9222. Unlike execute_js, this returns the actual result.",
  {
    expression: z
      .string()
      .describe(
        "JavaScript expression to evaluate. Use an async IIFE for async operations: (async () => { ... })()"
      ),
    tab: z
      .string()
      .optional()
      .describe(
        "Tab to target by URL or title substring (e.g. 'outlook', 'github.com'). Uses the currently connected tab if omitted."
      ),
  },
  async ({ expression, tab }) => {
    try {
      if (tab) {
        await cdp.connectToTarget(tab);
      }
      const result = await cdp.evaluate(expression);
      const text =
        result === undefined
          ? "(undefined)"
          : typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "browser_fetch",
  "Make an authenticated HTTP request through a browser tab's session. Runs fetch() inside the page context of a tab matching the given domain, inheriting all cookies and auth tokens. Returns the response body.",
  {
    tab: z
      .string()
      .describe(
        "Tab to use by URL or title substring (e.g. 'outlook', 'github.com'). The tab must be open and logged in."
      ),
    url: z.string().describe("URL to fetch"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .optional()
      .describe("HTTP method (default: GET)"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Additional request headers as key-value pairs"),
    body: z
      .string()
      .optional()
      .describe("Request body (for POST/PUT/PATCH). Will be sent as-is."),
  },
  async ({ tab, url, method, headers, body }) => {
    try {
      await cdp.connectToTarget(tab);

      const fetchOpts: Record<string, unknown> = {
        method: method ?? "GET",
        credentials: "include",
      };
      if (headers) {
        fetchOpts.headers = headers;
      }
      if (body) {
        fetchOpts.body = body;
      }

      const expression = `
        (async () => {
          const r = await fetch(${JSON.stringify(url)}, ${JSON.stringify(fetchOpts)});
          const ct = r.headers.get("content-type") || "";
          const text = await r.text();
          return JSON.stringify({
            status: r.status,
            statusText: r.statusText,
            contentType: ct,
            body: text.substring(0, 50000)
          });
        })()
      `;

      const raw = await cdp.evaluate(expression);
      const result = JSON.parse(raw as string) as {
        status: number;
        statusText: string;
        contentType: string;
        body: string;
      };

      if (result.status >= 400) {
        return {
          content: [
            {
              type: "text" as const,
              text: `HTTP ${result.status} ${result.statusText}\n\n${result.body}`,
            },
          ],
          isError: true,
        };
      }

      // Try to pretty-print JSON responses
      let responseBody = result.body;
      if (result.contentType.includes("json")) {
        try {
          responseBody = JSON.stringify(JSON.parse(result.body), null, 2);
        } catch {
          // keep raw text
        }
      }

      return { content: [{ type: "text" as const, text: responseBody }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "browser_fetch_auth",
  "Make an authenticated HTTP request using auth headers captured from a browser tab's network traffic. Reloads the tab to intercept fresh auth tokens, then makes the request server-side. Works for sites like Outlook that use Bearer tokens rather than cookies.",
  {
    tab: z
      .string()
      .describe(
        "Tab to capture auth from, by URL or title substring (e.g. 'outlook')"
      ),
    url: z.string().describe("URL to fetch"),
    method: z
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .optional()
      .describe("HTTP method (default: GET)"),
    headers: z
      .record(z.string())
      .optional()
      .describe("Additional request headers (merged with captured auth headers)"),
    body: z
      .string()
      .optional()
      .describe("Request body (for POST/PUT/PATCH)"),
    url_filter: z
      .string()
      .optional()
      .describe(
        "Only capture auth from requests matching this substring (e.g. 'service.svc')"
      ),
  },
  async ({ tab, url, method, headers, body, url_filter }) => {
    try {
      await cdp.connectToTarget(tab);
      const authHeaders = await cdp.captureAuthHeaders(url_filter);

      const merged = { ...authHeaders, ...headers };
      const fetchOpts: RequestInit = {
        method: method ?? "GET",
        headers: merged,
      };
      if (body) {
        fetchOpts.body = body;
      }

      const res = await fetch(url, fetchOpts);
      const text = await res.text();

      if (res.status >= 400) {
        return {
          content: [
            {
              type: "text" as const,
              text: `HTTP ${res.status} ${res.statusText}\n\n${text.substring(0, 50000)}`,
            },
          ],
          isError: true,
        };
      }

      // Pretty-print JSON
      const ct = res.headers.get("content-type") ?? "";
      let responseBody = text.substring(0, 50000);
      if (ct.includes("json")) {
        try {
          responseBody = JSON.stringify(JSON.parse(text), null, 2).substring(0, 50000);
        } catch {
          // keep raw
        }
      }

      return { content: [{ type: "text" as const, text: responseBody }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "cdp_list_targets",
  "List all CDP-accessible browser tabs. Requires qutebrowser to be running with --qt-arg remote-debugging-port 9222.",
  {},
  async () => {
    try {
      const targets = await cdp.listTargets();
      const pages = targets
        .filter((t) => t.type === "page")
        .map((t) => ({ title: t.title, url: t.url }));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(pages, null, 2) }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${err instanceof Error ? err.message : String(err)}. Is qutebrowser running with --qt-arg remote-debugging-port 9222?`,
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
