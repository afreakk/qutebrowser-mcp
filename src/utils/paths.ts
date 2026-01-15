import * as path from "path";
import * as os from "os";

export function getDataDir(): string {
  return (
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
  );
}

export function getConfigDir(): string {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

export function getRuntimeDir(): string {
  const uid = process.getuid?.() ?? 1000;
  return process.env.XDG_RUNTIME_DIR || `/run/user/${uid}`;
}

export function getQutebrowserDataDir(): string {
  return path.join(getDataDir(), "qutebrowser");
}

export function getQutebrowserConfigDir(): string {
  return path.join(getConfigDir(), "qutebrowser");
}

export function getSessionPath(): string {
  return path.join(getQutebrowserDataDir(), "sessions", "_autosave.yml");
}

export function getHistoryPath(): string {
  return path.join(getQutebrowserDataDir(), "history.sqlite");
}

export function getBookmarksPath(): string {
  return path.join(getQutebrowserConfigDir(), "bookmarks", "urls");
}

export function getQuickmarksPath(): string {
  return path.join(getQutebrowserConfigDir(), "quickmarks");
}

export function getIPCSocketDir(): string {
  return path.join(getRuntimeDir(), "qutebrowser");
}
