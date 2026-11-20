import { useEffect, useState } from "react";
import { useDocumentTheme, useStoredTheme } from "../../features/appearance/useDocumentTheme.ts";
import { setPreviewWindowTitle } from "./api.ts";

/** Window-level setup: title and theme. */
export function usePreviewWindow(title: string) {
  const [failed, setFailed] = useState(false);
  useDocumentTheme(useStoredTheme());
  useEffect(() => {
    void setPreviewWindowTitle(title).catch(() => setFailed(true));
  }, [title]);
  return { failed, reportFailure: () => setFailed(true) };
}
