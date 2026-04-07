# Context Bridge

Accumulated learnings across task runs. Read this before starting work.

## Recent Changes

<!-- Summaries of recently completed tasks, newest last. Older entries get pruned. -->

- **Task 1**: Added connection reuse to `connectToTarget()`. Now checks `ws.readyState === OPEN` and compares `connectedTargetUrl` against `target.webSocketDebuggerUrl` before reconnecting. Changed `connectedTargetUrl` to store `webSocketDebuggerUrl` instead of `target.url`.
- **Task 2**: Added `disconnect()` call in `closeTarget()` when the closed tab matches `connectedTargetUrl`. Comparison uses `webSocketDebuggerUrl` (consistent with task 1 change).
- **Task 3**: Made `disconnect()` add `removeAllListeners()` before `ws.close()` and drain `pending` map with "Disconnected" rejection.
- **Task 4**: Improved `findTarget()` error for duplicate URLs — checks if all matches share same URL and suggests closing duplicates or using index-based tools.
- **Task 5**: Added `navigateHistory(delta)` to CDPClient using `Page.getNavigationHistory`/`Page.navigateToHistoryEntry`. Updated go_back/go_forward handlers to use it instead of evaluate loop.

## Discoveries

## Conventions
