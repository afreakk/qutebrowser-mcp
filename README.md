# qutebrowser-mcp

MCP (Model Context Protocol) server for [qutebrowser](https://qutebrowser.org/) browser automation.

Control qutebrowser from Claude Code or any MCP-compatible client.

> **Note:** Linux only. Uses Unix domain sockets and XDG paths.

## Features

- **Tab Management** - List, open, close, and focus tabs
- **Navigation** - Go to URLs, back/forward, reload
- **Screenshots** - Capture the current page
- **JavaScript Execution** - Run JS in page context
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

| Tool | Description |
|------|-------------|
| `list_tabs` | List all open tabs with URLs and titles |
| `open_tab` | Open a new tab with URL |
| `close_tab` | Close current or specific tab |
| `focus_tab` | Switch to a tab by index |
| `navigate` | Go to URL in current tab |
| `go_back` | Navigate back in history |
| `go_forward` | Navigate forward |
| `reload_page` | Reload current page |
| `screenshot` | Take screenshot of page |
| `execute_js` | Run JavaScript on page |
| `get_bookmarks` | List bookmarks |
| `get_quickmarks` | List quickmarks |
| `search_history` | Search browsing history |

## How It Works

The server communicates with qutebrowser via its IPC (Unix domain socket) for sending commands, and reads state from:

- **Session file** (`~/.local/share/qutebrowser/sessions/_autosave.yml`) - Tab state
- **SQLite database** (`~/.local/share/qutebrowser/history.sqlite`) - Browsing history
- **Config files** (`~/.config/qutebrowser/`) - Bookmarks and quickmarks

### Limitations

- **IPC is write-only** - Commands are fire-and-forget, no direct responses
- **Session file delay** - Tab state updates periodically, not instantly (run `:session-save` in qutebrowser to force update)
- **JavaScript output** - `execute_js` results appear in qutebrowser's UI, not returned to caller

## Requirements

- **Linux** (uses Unix domain sockets for IPC)
- Node.js 18+
- qutebrowser running with IPC enabled (default)

Respects XDG environment variables (`XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_RUNTIME_DIR`) with standard fallbacks, so it should work across most Linux distributions.

## License

MIT
