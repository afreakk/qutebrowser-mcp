# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run build    # Compile TypeScript to dist/
npm run watch    # Watch mode for development
npm start        # Run the MCP server
```

## Architecture

This is an MCP (Model Context Protocol) server that provides browser automation tools for qutebrowser.

### Communication Flow

```
Claude Code <-> MCP Server (stdio) <-> qutebrowser IPC socket (fire-and-forget commands)
                    |               \-> CDP WebSocket (JS eval, network intercept, auth capture)
                    |
                    +-> Session file (tab state)
                    +-> SQLite (history)
                    +-> Config files (bookmarks)
```

### Key Components

- **src/index.ts** - MCP server entry point, registers all tools using `@modelcontextprotocol/sdk`
- **src/ipc/client.ts** - Unix socket client for qutebrowser IPC. Commands are fire-and-forget (no responses)
- **src/cdp/client.ts** - Chrome DevTools Protocol client. Connects via WebSocket to port 9222 for JS evaluation, network interception, and auth header capture
- **src/utils/session.ts** - Parses `~/.local/share/qutebrowser/sessions/_autosave.yml` for tab state
- **src/utils/history.ts** - Reads `~/.local/share/qutebrowser/history.sqlite` using better-sqlite3
- **src/utils/bookmarks.ts** - Reads plain text bookmark/quickmark files from config dir
- **src/utils/paths.ts** - XDG path resolution for qutebrowser data/config/runtime directories

### IPC Protocol

qutebrowser uses a Unix domain socket at `/run/user/{UID}/qutebrowser/ipc-*`. Messages are JSON with newline terminator:

```json
{"args": [":command", "arg1"], "target_arg": null, "protocol_version": 1}
```

**Important**: IPC is write-only. Tab state comes from parsing the session YAML file, not from IPC responses.

### MCP Tools

Tools are defined in `src/index.ts` using `server.tool()`. Each tool:
- Has a name, description, and zod schema for parameters
- Returns `{ content: [{ type: "text", text: "..." }] }` on success
- Returns `{ content: [...], isError: true }` on failure

## Using the MCP Tools (for AI Agents)

### Tool Discovery

The qutebrowser MCP tools are deferred tools. Use ToolSearch to load them first:

```
ToolSearch(query: "+qutebrowser")
```

Available tools:

```
mcp__qutebrowser__list_tabs
mcp__qutebrowser__focus_tab
mcp__qutebrowser__move_tab
mcp__qutebrowser__open_tab
mcp__qutebrowser__close_tab
mcp__qutebrowser__navigate
mcp__qutebrowser__go_back
mcp__qutebrowser__go_forward
mcp__qutebrowser__reload_page
mcp__qutebrowser__screenshot
mcp__qutebrowser__execute_js
mcp__qutebrowser__get_bookmarks
mcp__qutebrowser__get_quickmarks
mcp__qutebrowser__search_history
mcp__qutebrowser__cdp_evaluate
mcp__qutebrowser__browser_fetch
mcp__qutebrowser__browser_fetch_auth
mcp__qutebrowser__cdp_list_targets
```

### CDP Tools (require `--qt-arg remote-debugging-port 9222`)

The CDP tools connect to qutebrowser's Chrome DevTools Protocol endpoint for capabilities the IPC socket can't provide:

- **cdp_evaluate** - Execute JS in any tab and **return the result** (unlike `execute_js` which is fire-and-forget)
- **browser_fetch** - Run `fetch()` inside a tab's page context, inheriting cookies/session. Good for cookie-based auth.
- **browser_fetch_auth** - Capture auth headers from a tab's network traffic (via page reload), then make the request server-side. Works for sites like Outlook that use Bearer tokens rather than cookies. Auth headers are cached for 5 minutes.
- **cdp_list_targets** - List all CDP-accessible tabs

### Tab Indexing

**Critical**: `list_tabs` returns **0-based** indices, but `focus_tab` and `move_tab` use **1-based** indices.

```
list_tabs output:  tabIndex: 0, 1, 2, 3...
focus_tab input:   index: 1, 2, 3, 4...  (add 1 to list_tabs index)
move_tab input:    position: 1, 2, 3...  (1-based absolute position)
```

Example: To focus on a tab shown as `tabIndex: 5` in list_tabs, use `focus_tab(index: 6)`.

### Tab Organization Workflow

1. Call `list_tabs` to see current state (0-based indices)
2. Call `focus_tab(index)` with **1-based index** to select the tab to move
3. Call `move_tab(position)` with **1-based target position**
4. Call `list_tabs` again to verify the change

Note: `move_tab` moves the **currently focused** tab, not a specific tab by index.

### IPC Command Format

Commands are sent as a **single joined string** in the args array:

```json
{"args": [":tab-move 5"], "target_arg": null, "protocol_version": 1}
```

**NOT** as separate elements:
```json
{"args": [":tab-move", "5"], ...}  // WRONG - creates new tabs!
```

### Session Save Behavior

To read fresh tab state, the server calls `:session-save --force _autosave` before reading the session file. The `--force` flag is required because `_autosave` is an internal session (starts with underscore).

The server polls the file's mtime until it changes (up to 500ms max), so it returns as soon as qutebrowser writes the file.
