import * as fs from "fs/promises";
import { getBookmarksPath, getQuickmarksPath } from "./paths.js";
import type { Bookmark, Quickmark } from "../types.js";

export async function getBookmarks(): Promise<Bookmark[]> {
  const bookmarksPath = getBookmarksPath();

  try {
    const content = await fs.readFile(bookmarksPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const spaceIndex = line.indexOf(" ");
        if (spaceIndex === -1) {
          return { url: line };
        }
        return {
          url: line.substring(0, spaceIndex),
          title: line.substring(spaceIndex + 1),
        };
      });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw new Error(
      `Failed to read bookmarks: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function getQuickmarks(): Promise<Quickmark[]> {
  const quickmarksPath = getQuickmarksPath();

  try {
    const content = await fs.readFile(quickmarksPath, "utf-8");
    return content
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const spaceIndex = line.indexOf(" ");
        if (spaceIndex === -1) {
          return { name: line, url: "" };
        }
        return {
          name: line.substring(0, spaceIndex),
          url: line.substring(spaceIndex + 1),
        };
      });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw new Error(
      `Failed to read quickmarks: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
