import * as fs from "fs/promises";
import * as YAML from "yaml";
import { getSessionPath } from "./paths.js";
import { ipc } from "../ipc/client.js";
import type { Session, TabInfo } from "../types.js";

export async function getSessionData(): Promise<Session> {
  const sessionPath = getSessionPath();
  try {
    const content = await fs.readFile(sessionPath, "utf-8");
    return YAML.parse(content) as Session;
  } catch (err) {
    throw new Error(
      `Failed to read session file: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function extractTabs(session: Session): TabInfo[] {
  const tabs: TabInfo[] = [];

  session.windows.forEach((window, windowIndex) => {
    window.tabs.forEach((tab, tabIndex) => {
      // Get the active history entry (current page) or the last one
      const currentEntry =
        tab.history.find((h) => h.active) ||
        tab.history[tab.history.length - 1];

      if (currentEntry) {
        tabs.push({
          windowIndex,
          tabIndex,
          url: currentEntry.url,
          title: currentEntry.title || currentEntry.url,
          active: !!tab.active && !!window.active,
          pinned: currentEntry.pinned || false,
        });
      }
    });
  });

  return tabs;
}

async function waitForFileChange(
  filePath: string,
  originalMtime: number,
  maxWaitMs = 500,
  pollIntervalMs = 25
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.mtimeMs > originalMtime) {
        return true;
      }
    } catch {
      // File doesn't exist yet, keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return false;
}

export async function listTabs(): Promise<TabInfo[]> {
  const sessionPath = getSessionPath();

  // Get current mtime before triggering save
  let originalMtime = 0;
  try {
    const stat = await fs.stat(sessionPath);
    originalMtime = stat.mtimeMs;
  } catch {
    // File doesn't exist yet, that's fine
  }

  // Save session to ensure we read fresh data
  // Must use --force for internal sessions (starting with _)
  await ipc.sendCommand(":session-save", "--force", "_autosave");

  // Wait for the file to actually be updated
  await waitForFileChange(sessionPath, originalMtime);

  const session = await getSessionData();
  return extractTabs(session);
}
