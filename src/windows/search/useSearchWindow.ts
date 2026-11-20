import { useEffect, useState } from "react";
import { useDocumentTheme, useStoredTheme } from "../../features/appearance/useDocumentTheme.ts";
import { setSearchWindowTitle } from "./api.ts";

/** Window-level setup: title and theme. The Rust side reveals the window once
 * the webview is ready; nothing else is needed here. */
export function useSearchWindow(title: string) {
  const [failed, setFailed] = useState(false);
  useDocumentTheme(useStoredTheme());
  useEffect(() => {
    void setSearchWindowTitle(title).catch(() => setFailed(true));
  }, [title]);
  return { failed, reportFailure: () => setFailed(true) };
}
