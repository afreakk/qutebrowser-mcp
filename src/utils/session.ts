import * as fs from "fs/promises";
import * as YAML from "yaml";
import { getSessionPath } from "./paths.js";
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

export async function listTabs(): Promise<TabInfo[]> {
  const session = await getSessionData();
  return extractTabs(session);
}
