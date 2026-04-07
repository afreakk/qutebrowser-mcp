# Tasks: Fix CDP-first architecture review findings

Source: Code review of CDP-first refactor
Generated: 2026-04-07

## Tasks

- [x] Add connection reuse to CDPClient.connectToTarget()

  - files: src/cdp/client.ts
  - context: In `connectToTarget()`, before calling `this.connect()`, check if `this.ws` is already open and `this.connectedTargetUrl` matches the target. Compare using `target.webSocketDebuggerUrl` (not URL, since navigate() changes the page URL). If already connected to the correct target, return early. This avoids unnecessary reconnections and the race conditions they cause.

- [x] Disconnect from closed tab in closeTarget()

  - files: src/cdp/client.ts
  - context: After the HTTP close call succeeds in `closeTarget()`, check if `this.connectedTargetUrl === target.url`. If so, call `this.disconnect()` to clean up the WebSocket that's about to receive a close event. This prevents the close event handler from rejecting unrelated pending promises if another tool call races.

- [x] Make disconnect() consistent with connect() cleanup

  - files: src/cdp/client.ts
  - context: In `disconnect()`, add `this.ws.removeAllListeners()` before `this.ws.close()`, matching the cleanup pattern used in `connect()` when replacing an old socket. Also drain `this.pending` by rejecting all entries with a "Disconnected" error before clearing, so callers get a clean rejection rather than a dangling promise.

- [x] Improve duplicate URL error message in findTarget()

  - files: src/cdp/client.ts
  - context: In `findTarget()`, when `matches.length > 1`, check if all matches have the same URL (`new Set(matches.map(t => t.url)).size === 1`). If so, change the error message to say "Multiple tabs open at the same URL — close duplicates or use an index-based tool (focus_tab, close_tab with index)." instead of "Be more specific."

- [x] Replace history.back() loop with Page.navigateToHistoryEntry for CDP back/forward

  - files: src/index.ts, src/cdp/client.ts
  - context: The current `go_back`/`go_forward` CDP path calls `cdp.evaluate("history.back()")` in a loop, which breaks for count > 1 because the page context is destroyed after the first navigation. Add a `navigateHistory(delta: number)` method to CDPClient that uses `Page.getNavigationHistory` to get the entry list and `currentIndex`, computes `targetIndex = currentIndex + delta` (negative for back, positive for forward), clamps to bounds, then calls `Page.navigateToHistoryEntry({ entryId: entries[targetIndex].id })`. Use this method in the `go_back` (delta = -(count ?? 1)) and `go_forward` (delta = count ?? 1) tool handlers instead of the evaluate loop.

- [x] Add truncation indicator to browser_fetch response

  - files: src/index.ts
  - context: In the `browser_fetch` tool handler, the JS expression truncates the response body at 50000 chars inside `Runtime.evaluate` with no indicator. Change the expression to also return `truncated: text.length > 50000` in the JSON result. Then in the tool handler, if `result.truncated` is true, append `"\n[TRUNCATED at 50000 chars]"` to `responseBody` before returning. Find the expression around line 600 (`body: text.substring(0, 50000)`).

- [x] Remove dead code path in IPC open() method

  - files: src/ipc/client.ts
  - context: The `open()` method has an `else if (options?.tab)` branch that pushes `-t`, but the only caller (`open_tab` tool) always passes `{ tab: true, background: true }`, so the `-b` branch always wins and `-t` is dead code. Since `open_tab` always opens in background now, simplify: remove the `tab` option from the method signature and the `else if` branch. Keep only the `background` option. Update the call site in `src/index.ts` to pass just `{ background: true }`.
