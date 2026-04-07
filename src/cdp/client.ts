import WebSocket from "ws";

interface CDPTarget {
  id: string;
  title: string;
  url: string;
  type: string;
  webSocketDebuggerUrl: string;
}

interface CDPResponse {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

interface CDPEvent {
  method: string;
  params: Record<string, unknown>;
}

type CDPMessage = CDPResponse | CDPEvent;

const DEFAULT_CDP_PORT = 9222;
const CONNECT_TIMEOUT_MS = 5_000;
const SEND_TIMEOUT_MS = 30_000;
const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTH_LISTEN_WINDOW_MS = 3_000;
const AUTH_RELOAD_TIMEOUT_MS = 20_000;

interface CapturedAuth {
  headers: Record<string, string>;
  capturedAt: number;
}

export class CDPClient {
  private port: number;
  private ws: WebSocket | null = null;
  private connectedTargetUrl: string | null = null;
  private msgId = 0;
  private pending = new Map<
    number,
    {
      resolve: (v: Record<string, unknown>) => void;
      reject: (e: Error) => void;
    }
  >();
  private eventListeners = new Map<
    string,
    ((params: Record<string, unknown>) => void)[]
  >();
  private authCache = new Map<string, CapturedAuth>();

  constructor(port?: number) {
    this.port = port ?? DEFAULT_CDP_PORT;
  }

  async listTargets(): Promise<CDPTarget[]> {
    const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
    return (await res.json()) as CDPTarget[];
  }

  async findTarget(match: string): Promise<CDPTarget> {
    const targets = await this.listTargets();
    const pages = targets.filter((t) => t.type === "page");
    const lower = match.toLowerCase();

    // Try exact URL match first
    const exact = pages.filter((t) => t.url.toLowerCase() === lower);
    if (exact.length === 1) return exact[0];

    // Fall back to substring match on URL and title
    const matches = pages.filter(
      (t) =>
        t.url.toLowerCase().includes(lower) ||
        t.title.toLowerCase().includes(lower)
    );

    if (matches.length === 0) {
      throw new Error(
        `No tab found matching "${match}". Is the page open in qutebrowser?`
      );
    }
    if (matches.length > 1) {
      const list = matches
        .map((t) => `  - ${t.title} (${t.url})`)
        .join("\n");
      const allSameUrl =
        new Set(matches.map((t) => t.url)).size === 1;
      const hint = allSameUrl
        ? "Multiple tabs open at the same URL — close duplicates or use an index-based tool (focus_tab, close_tab with index)."
        : "Be more specific.";
      throw new Error(
        `Multiple tabs match "${match}":\n${list}\n${hint}`
      );
    }
    return matches[0];
  }

  async connect(wsUrl: string): Promise<void> {
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      this.connectedTargetUrl = null;
      old.removeAllListeners();
      old.close();
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, { maxPayload: 100 * 1024 * 1024 });

      const connectTimer = setTimeout(() => {
        ws.close();
        reject(new Error("CDP connection timed out"));
      }, CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(connectTimer);
        this.ws = ws;

        // Replace the initial error handler with a persistent one
        ws.removeListener("error", onConnectError);
        ws.on("error", (err) => {
          for (const p of this.pending.values()) {
            p.reject(new Error(`WebSocket error: ${err.message}`));
          }
          this.pending.clear();
          this.ws = null;
          this.connectedTargetUrl = null;
        });

        resolve();
      });

      const onConnectError = (err: Error) => {
        clearTimeout(connectTimer);
        reject(err);
      };
      ws.on("error", onConnectError);

      ws.on("message", (raw) => {
        let msg: CDPMessage;
        try {
          msg = JSON.parse(raw.toString()) as CDPMessage;
        } catch {
          return; // ignore malformed messages
        }
        if ("id" in msg && msg.id !== undefined) {
          const p = this.pending.get(msg.id);
          if (p) {
            this.pending.delete(msg.id);
            if ("error" in msg && msg.error) {
              p.reject(new Error(msg.error.message));
            } else {
              p.resolve(msg.result ?? {});
            }
          }
        } else if ("method" in msg) {
          const listeners = this.eventListeners.get(msg.method);
          if (listeners) {
            for (const fn of listeners) {
              fn(msg.params);
            }
          }
        }
      });

      ws.on("close", () => {
        this.ws = null;
        this.connectedTargetUrl = null;
        for (const p of this.pending.values()) {
          p.reject(new Error("WebSocket closed"));
        }
        this.pending.clear();
      });
    });
  }

  async connectToTarget(match: string): Promise<CDPTarget> {
    const target = await this.findTarget(match);
    // Reuse existing connection if already connected to this target
    if (
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      this.connectedTargetUrl === target.webSocketDebuggerUrl
    ) {
      return target;
    }
    await this.connect(target.webSocketDebuggerUrl);
    this.connectedTargetUrl = target.webSocketDebuggerUrl;
    return target;
  }

  private send(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    if (!this.ws) {
      throw new Error("Not connected to any tab");
    }
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP call ${method} timed out`));
      }, SEND_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      this.ws!.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression: string): Promise<unknown> {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    const r = result as {
      result?: { type: string; value?: unknown; description?: string };
      exceptionDetails?: {
        text: string;
        exception?: { description?: string };
      };
    };
    if (r.exceptionDetails) {
      const desc =
        r.exceptionDetails.exception?.description ?? r.exceptionDetails.text;
      throw new Error(`JS error: ${desc}`);
    }
    return r.result?.value;
  }

  private on(
    event: string,
    fn: (params: Record<string, unknown>) => void
  ): void {
    const list = this.eventListeners.get(event) ?? [];
    list.push(fn);
    this.eventListeners.set(event, list);
  }

  private removeAllListeners(event: string): void {
    this.eventListeners.delete(event);
  }

  /**
   * Capture auth headers from network requests. First listens for
   * background requests (SPAs often poll), then reloads only if
   * no auth header is seen within a short window.
   */
  async captureAuthHeaders(
    urlFilter?: string,
    headerFilter?: (key: string) => boolean
  ): Promise<Record<string, string>> {
    // Check cache keyed by page URL
    const cacheKey = this.connectedTargetUrl ?? "default";
    const cached = this.authCache.get(cacheKey);
    if (cached && Date.now() - cached.capturedAt < AUTH_CACHE_TTL_MS) {
      return cached.headers;
    }

    await this.send("Network.enable");

    const keepHeader = headerFilter ?? defaultHeaderFilter;

    return new Promise<Record<string, string>>((resolve, reject) => {
      let reloaded = false;

      const cleanup = () => {
        this.removeAllListeners("Network.requestWillBeSent");
        this.send("Network.disable").catch(() => {});
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "Timed out waiting for auth headers. Is the page logged in?"
          )
        );
      }, AUTH_RELOAD_TIMEOUT_MS);

      // If no auth seen in the listen window, reload to trigger requests
      const reloadTimer = setTimeout(() => {
        if (!reloaded) {
          reloaded = true;
          this.send("Page.reload").catch((err) => {
            console.error("Page.reload failed:", err);
          });
        }
      }, AUTH_LISTEN_WINDOW_MS);

      this.on("Network.requestWillBeSent", (params) => {
        const req = params.request as {
          url: string;
          headers: Record<string, string>;
        };
        if (urlFilter && !req.url.includes(urlFilter)) return;
        const auth = req.headers.Authorization ?? req.headers.authorization;
        if (!auth) return;

        clearTimeout(timer);
        clearTimeout(reloadTimer);
        cleanup();

        const captured: Record<string, string> = {};
        for (const [k, v] of Object.entries(req.headers)) {
          if (keepHeader(k)) {
            captured[k] = v;
          }
        }

        this.authCache.set(cacheKey, {
          headers: captured,
          capturedAt: Date.now(),
        });
        resolve(captured);
      });
    });
  }

  clearAuthCache(): void {
    this.authCache.clear();
  }

  /**
   * Navigate forward or backward in session history using CDP's
   * Page.getNavigationHistory / Page.navigateToHistoryEntry.
   * Unlike history.back() loops, this works for count > 1 because
   * it doesn't destroy the page context between steps.
   * @param delta Negative for back, positive for forward.
   */
  async navigateHistory(delta: number): Promise<void> {
    const result = await this.send("Page.getNavigationHistory");
    const { currentIndex, entries } = result as {
      currentIndex: number;
      entries: { id: number; url: string; title: string }[];
    };
    const targetIndex = Math.max(
      0,
      Math.min(entries.length - 1, currentIndex + delta)
    );
    if (targetIndex === currentIndex) return;
    await this.send("Page.navigateToHistoryEntry", {
      entryId: entries[targetIndex].id,
    });
  }

  async navigate(url: string): Promise<void> {
    await this.send("Page.navigate", { url });
  }

  async reload(ignoreCache?: boolean): Promise<void> {
    await this.send("Page.reload", { ignoreCache: ignoreCache ?? false });
  }

  async closeTarget(match: string): Promise<void> {
    const target = await this.findTarget(match);
    const res = await fetch(`http://127.0.0.1:${this.port}/json/close/${target.id}`);
    if (!res.ok) {
      throw new Error(`Failed to close tab: ${res.statusText}`);
    }
    // Clean up WebSocket if we were connected to the closed tab
    if (this.connectedTargetUrl === target.webSocketDebuggerUrl) {
      this.disconnect();
    }
  }

  async captureScreenshot(format: "png" | "jpeg" = "png", quality?: number): Promise<Buffer> {
    // Some QtWebEngine versions need Page domain enabled first
    await this.send("Page.enable");

    const params: Record<string, unknown> = { format };
    if (format === "jpeg" && quality !== undefined) {
      params.quality = quality;
    }
    const result = await this.send("Page.captureScreenshot", params);
    const data = (result as { data: string }).data;
    return Buffer.from(data, "base64");
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.connectedTargetUrl = null;
    this.eventListeners.clear();
    // Drain pending promises so callers get a clean rejection
    for (const p of this.pending.values()) {
      p.reject(new Error("Disconnected"));
    }
    this.pending.clear();
  }
}

function defaultHeaderFilter(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower === "authorization" ||
    lower.startsWith("x-anchor") ||
    lower === "x-tenantid" ||
    lower === "x-owa-sessionid"
  );
}

export const cdp = new CDPClient();
