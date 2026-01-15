import Database from "better-sqlite3";
import { getHistoryPath } from "./paths.js";
import type { HistoryEntry } from "../types.js";

export function getHistory(limit = 100, search?: string): HistoryEntry[] {
  const dbPath = getHistoryPath();

  try {
    const db = new Database(dbPath, { readonly: true });

    let query = "SELECT url, title, atime, redirect FROM History";
    const params: (string | number)[] = [];

    if (search) {
      query += " WHERE url LIKE ? OR title LIKE ?";
      params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY atime DESC LIMIT ?";
    params.push(limit);

    const rows = db.prepare(query).all(...params) as HistoryEntry[];
    db.close();

    return rows;
  } catch (err) {
    throw new Error(
      `Failed to read history database: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function formatHistoryEntry(entry: HistoryEntry): {
  url: string;
  title: string;
  visited: string;
  redirect: boolean;
} {
  return {
    url: entry.url,
    title: entry.title,
    visited: new Date(entry.atime * 1000).toISOString(),
    redirect: entry.redirect === 1,
  };
}
