# qutebrowser-mcp

MCP (Model Context Protocol) server for [qutebrowser](https://qutebrowser.org/) browser automation.

Control qutebrowser from Claude Code or any MCP-compatible client.

> **Note:** Linux only. Uses Unix domain sockets and XDG paths.

## Features

- **CDP-First Design** - Most tools operate on specific tabs via Chrome DevTools Protocol without changing focus
- **Tab Management** - List, open, close, focus, and move tabs
- **Navigation** - Go to URLs, back/forward, reload — all targetable to specific tabs
- **Screenshots** - Capture any tab without switching to it
- **JavaScript Execution** - Run JS in any tab and get return values
- **Authenticated Fetch** - Make HTTP requests through the browser's logged-in sessions (cookies or Bearer tokens)
- **Bookmarks & History** - Access bookmarks, quickmarks, and browsing history

## CDP Setup (Recommended)

Most tools use Chrome DevTools Protocol to operate on tabs without changing focus. Enable remote debugging via environment variable:

```bash
QTWEBENGINE_REMOTE_DEBUGGING=9222 qutebrowser
```

Without CDP, tools fall back to IPC which operates on the currently focused tab and may cause tab switches.

## Installation

```bash
npm install
npm run build
```

## Usage

### With Claude Code

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "qutebrowser": {
      "command": "node",
      "args": ["/path/to/qutebrowser-mcp/dist/index.js"]
    }
  }
}
```

### Run Directly

```bash
npm start
```

## Available Tools

### CDP-Enabled Tools

These accept an optional `tab` parameter (URL or title substring) to target a specific tab via CDP **without changing focus**. Without `tab`, they fall back to IPC on the focused tab.

| Tool | Description |
|------|-------------|
| `list_tabs` | List all tabs with indices, URLs, titles, active state (session file + CDP enrichment) |
| `close_tab` | Close a tab by URL/title match (CDP) or by index (IPC) |
| `navigate` | Navigate a tab to a URL |
| `go_back` | Navigate back in history |
| `go_forward` | Navigate forward in history |
| `reload_page` | Reload a page |
| `screenshot` | Capture a page as PNG |
| `execute_js` | Run JavaScript and return the result (CDP) or fire-and-forget (IPC) |

### IPC-Only Tools

These use qutebrowser's Unix domain socket for features CDP can't provide.

| Tool | Description |
|------|-------------|
| `open_tab` | Open a new background tab |
| `focus_tab` | Switch focus to a tab by index (intentionally changes focus) |
| `move_tab` | Move the current tab to a new position |
| `get_bookmarks` | List bookmarks |
| `get_quickmarks` | List quickmarks |
| `search_history` | Search browsing history |

### CDP-Only Tools

These always require CDP and a `tab` parameter.

| Tool | Description |
|------|-------------|
| `browser_fetch` | `fetch()` inside a page context, inheriting cookies/session |
| `browser_fetch_auth` | Capture auth headers from network traffic, make server-side requests |

#### `browser_fetch` vs `browser_fetch_auth`

- **`browser_fetch`** runs `fetch()` inside the tab's page context. Best for **cookie-based auth** (same-origin requests).
- **`browser_fetch_auth`** intercepts Bearer tokens from the tab's network traffic, then makes the request server-side. Best for **token-based auth** (e.g. Outlook, which uses MSAuth tokens injected by JavaScript).

## How It Works

The server communicates with qutebrowser through two channels:

1. **CDP** (Chrome DevTools Protocol WebSocket) - Primary channel. Bidirectional communication for JS evaluation, navigation, screenshots, tab close, reload, and network interception. Operates on specific tabs without changing focus.
2. **IPC** (Unix domain socket) - Secondary channel. Fire-and-forget commands for qutebrowser-specific features (tab open, focus, move, bookmarks, session save).

State is read from:

- **Session file** (`~/.local/share/qutebrowser/sessions/_autosave.yml`) - Tab indices, active state, pinned state
- **CDP targets** - Fresh tab titles and URLs
- **SQLite database** (`~/.local/share/qutebrowser/history.sqlite`) - Browsing history
- **Config files** (`~/.config/qutebrowser/`) - Bookmarks and quickmarks

## Requirements

- **Linux** (uses Unix domain sockets for IPC)
- Node.js 18+
- qutebrowser running with IPC enabled (default)
- **Recommended:** qutebrowser started with `QTWEBENGINE_REMOTE_DEBUGGING=9222` for CDP support

Respects XDG environment variables (`XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_RUNTIME_DIR`) with standard fallbacks, so it should work across most Linux distributions.

## License

MIT
