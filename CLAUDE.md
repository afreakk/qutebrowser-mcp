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
Claude Code <-> MCP Server (stdio) <-> qutebrowser IPC socket
                    |
                    +-> Session file (tab state)
                    +-> SQLite (history)
                    +-> Config files (bookmarks)
```

### Key Components

- **src/index.ts** - MCP server entry point, registers all tools using `@modelcontextprotocol/sdk`
- **src/ipc/client.ts** - Unix socket client for qutebrowser IPC. Commands are fire-and-forget (no responses)
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
