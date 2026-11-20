import { useCallback, useEffect, useRef, useState } from "react";
import {
  copySearchResultPath,
  getFileSearchStatus,
  listenFileSearchStatus,
  listenShortcutError,
  openSearchResult,
  rebuildFileSearchIndex,
  revealSearchResult,
  searchFiles,
  type FileSearchStatus,
  type SearchEntry,
} from "./api.ts";
import { previewPath } from "../file-preview/api.ts";

const EMPTY_STATUS: FileSearchStatus = {
  entryCount: 0,
  building: false,
  scanned: 0,
  roots: [],
  builtAt: null,
};
const DEBOUNCE_MS = 140;

export function useFileSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [status, setStatus] = useState<FileSearchStatus>(EMPTY_STATUS);
  const [searching, setSearching] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const sequence = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void getFileSearchStatus()
      .then((value) => { if (!cancelled) setStatus(value); })
      .catch(() => { if (!cancelled) setFailed(true); });
    let stopStatus: (() => void) | undefined;
    let stopError: (() => void) | undefined;
    void listenFileSearchStatus((value) => { if (!cancelled) setStatus(value); })
      .then((stop) => { if (cancelled) stop(); else stopStatus = stop; })
      .catch(() => {});
    void listenShortcutError((value) => { if (!cancelled) setShortcutError(value); })
      .then((stop) => { if (cancelled) stop(); else stopError = stop; })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopStatus?.();
      stopError?.();
    };
  }, []);

  useEffect(() => {
    const current = ++sequence.current;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchFiles(trimmed)
        .then((value) => {
          if (current === sequence.current) setResults(value);
        })
        .catch(() => { if (current === sequence.current) setFailed(true); })
        .finally(() => { if (current === sequence.current) setSearching(false); });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const refreshIndex = useCallback(async () => {
    setFailed(false);
    try {
      await rebuildFileSearchIndex();
    } catch {
      setFailed(true);
    }
  }, []);

  const act = useCallback(async (action: (path: string) => Promise<void>, path: string) => {
    setFailed(false);
    try {
      await action(path);
    } catch {
      setFailed(true);
    }
  }, []);

  return {
    query,
    setQuery,
    results,
    status,
    searching,
    shortcutError,
    failed,
    refreshIndex,
    open: (path: string) => act(openSearchResult, path),
    reveal: (path: string) => act(revealSearchResult, path),
    copyPath: (path: string) => act(copySearchResultPath, path),
    preview: (path: string) => act(previewPath, path),
  };
}
