import { useEffect } from "react";
import { listenFileSearchOpenIsland } from "../../features/file-search/api";
import type { IslandPage } from "./types";

/**
 * The global search shortcut and the tray ask the island for its search page.
 * The main process shows and focuses the window first, so all this does is route
 * the page: keeping it here leaves IslandApp's own wiring untouched.
 */
export function useIslandSearchShortcut(openPage: (page: IslandPage) => void) {
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void listenFileSearchOpenIsland(() => openPage("search")).then((off) => {
      if (cancelled) {
        off();
        return;
      }
      dispose = off;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [openPage]);
}
