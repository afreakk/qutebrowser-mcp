# qutebrowser-mcp

MCP (Model Context Protocol) server for [qutebrowser](https://qutebrowser.org/) browser automation.

Control qutebrowser from Claude Code or any MCP-compatible client.

> **Note:** Linux only. Uses Unix domain sockets and XDG paths.

## Features

- **Tab Management** - List, open, close, and focus tabs
- **Navigation** - Go to URLs, back/forward, reload
- **Screenshots** - Capture the current page
- **JavaScript Execution** - Run JS in page context (fire-and-forget via IPC, or with return values via CDP)
- **Authenticated Fetch** - Make HTTP requests through the browser's logged-in sessions (cookies or Bearer tokens)
- **Bookmarks & History** - Access bookmarks, quickmarks, and browsing history

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

### IPC Tools

These use qutebrowser's Unix domain socket. No extra setup needed.

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open tabs with URLs and titles |
| `open_tab` | Open a new tab with URL |
| `close_tab` | Close current or specific tab |
| `focus_tab` | Switch to a tab by index |
| `move_tab` | Move the current tab to a new position |
| `navigate` | Go to URL in current tab |
| `go_back` | Navigate back in history |
| `go_forward` | Navigate forward |
| `reload_page` | Reload current page |
| `screenshot` | Take screenshot of page |
| `execute_js` | Run JavaScript on page (output in qutebrowser UI, not returned) |
| `get_bookmarks` | List bookmarks |
| `get_quickmarks` | List quickmarks |
| `search_history` | Search browsing history |

### CDP Tools

These use Chrome DevTools Protocol for capabilities IPC can't provide. Requires qutebrowser started with remote debugging enabled (see [CDP Setup](#cdp-setup)).

| Tool | Description |
|------|-------------|
| `cdp_evaluate` | Run JS in any tab and **return the result** |
| `browser_fetch` | `fetch()` inside a page context, inheriting cookies/session |
| `browser_fetch_auth` | Capture auth headers from network traffic, make server-side requests |
| `cdp_list_targets` | List all CDP-accessible tabs |

#### `browser_fetch` vs `browser_fetch_auth`

- **`browser_fetch`** runs `fetch()` inside the tab's page context. Best for **cookie-based auth** (same-origin requests).
- **`browser_fetch_auth`** intercepts Bearer tokens from the tab's network traffic, then makes the request server-side. Best for **token-based auth** (e.g. Outlook, which uses MSAuth tokens injected by JavaScript).

## How It Works

The server communicates with qutebrowser through two channels:

1. **IPC** (Unix domain socket) - Fire-and-forget commands (open, close, navigate, etc.)
2. **CDP** (Chrome DevTools Protocol WebSocket) - Bidirectional communication for JS evaluation with return values, network interception, and auth header capture

State is read from:

- **Session file** (`~/.local/share/qutebrowser/sessions/_autosave.yml`) - Tab state
- **SQLite database** (`~/.local/share/qutebrowser/history.sqlite`) - Browsing history
- **Config files** (`~/.config/qutebrowser/`) - Bookmarks and quickmarks

## CDP Setup

To use the CDP tools (`cdp_evaluate`, `browser_fetch`, `browser_fetch_auth`, `cdp_list_targets`), start qutebrowser with remote debugging enabled:

```bash
qutebrowser --qt-arg remote-debugging-port 9222
```

Or set the environment variable:

```bash
QTWEBENGINE_REMOTE_DEBUGGING=9222 qutebrowser
```

The IPC-based tools work without this flag.

## Requirements

- **Linux** (uses Unix domain sockets for IPC)
- Node.js 18+
- qutebrowser running with IPC enabled (default)
- For CDP tools: qutebrowser started with `--qt-arg remote-debugging-port 9222`

Respects XDG environment variables (`XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_RUNTIME_DIR`) with standard fallbacks, so it should work across most Linux distributions.

## License

MIT
