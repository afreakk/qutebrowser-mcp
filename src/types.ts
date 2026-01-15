export interface QutebrowserIPCMessage {
  args: string[];
  target_arg: string | null;
  protocol_version: number;
  cwd?: string;
  version?: string;
}

export interface TabHistoryEntry {
  url: string;
  title: string;
  active?: boolean;
  pinned?: boolean;
  "scroll-pos"?: { x: number; y: number };
  zoom?: number;
  last_visited?: string;
}

export interface SessionTab {
  history: TabHistoryEntry[];
  active?: boolean;
}

export interface SessionWindow {
  tabs: SessionTab[];
  active?: boolean;
  geometry?: string;
}

export interface Session {
  windows: SessionWindow[];
}

export interface TabInfo {
  windowIndex: number;
  tabIndex: number;
  url: string;
  title: string;
  active: boolean;
  pinned: boolean;
}

export interface HistoryEntry {
  url: string;
  title: string;
  atime: number;
  redirect: number;
}

export interface Bookmark {
  url: string;
  title?: string;
}

export interface Quickmark {
  name: string;
  url: string;
}
