import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Mirrors `SearchEntry` in src-tauri/src/file_search/model.rs. */
export interface SearchEntry {
  path: string;
  name: string;
  nameLower: string;
  parentLower: string;
  ext: string;
  size: number;
  isDir: boolean;
  modified: number;
}

/** Mirrors `IndexStatus` in src-tauri/src/file_search/service.rs. */
export interface FileSearchStatus {
  entryCount: number;
  building: boolean;
  scanned: number;
  roots: string[];
  builtAt: number | null;
}

/** Matches `INDEX_STATUS_EVENT` in service.rs. */
export const FILE_SEARCH_STATUS_EVENT = "file-search-index-status";
/** Matches `SHORTCUT_ERROR_EVENT` in hotkey.rs. */
export const FILE_SEARCH_SHORTCUT_ERROR_EVENT = "file-search-shortcut-error";
/** Matches `ISLAND_OPEN_EVENT` in mod.rs: the shortcut asks the island for its search page. */
export const FILE_SEARCH_OPEN_ISLAND_EVENT = "file-search-open-island";

export function listenFileSearchOpenIsland(handler: () => void): Promise<() => void> {
  return listen(FILE_SEARCH_OPEN_ISLAND_EVENT, () => handler());
}

export function searchFiles(query: string): Promise<SearchEntry[]> {
  return invoke<SearchEntry[]>("search_files", { query });
}

export function getFileSearchStatus(): Promise<FileSearchStatus> {
  return invoke<FileSearchStatus>("get_file_search_status");
}

export function rebuildFileSearchIndex(): Promise<void> {
  return invoke<void>("rebuild_file_search_index");
}

export function openSearchResult(path: string): Promise<void> {
  return invoke<void>("open_search_result", { path });
}

export function revealSearchResult(path: string): Promise<void> {
  return invoke<void>("reveal_search_result", { path });
}

export function copySearchResultPath(path: string): Promise<void> {
  return invoke<void>("copy_search_result_path", { path });
}

export function listenFileSearchStatus(
  handler: (status: FileSearchStatus) => void,
): Promise<() => void> {
  return listen<FileSearchStatus>(FILE_SEARCH_STATUS_EVENT, (event) => handler(event.payload));
}

export function listenShortcutError(handler: (error: string | null) => void): Promise<() => void> {
  return listen<string | null>(FILE_SEARCH_SHORTCUT_ERROR_EVENT, (event) => handler(event.payload));
}
