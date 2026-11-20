import { useCallback, useEffect, useState } from "react";
import {
  getCurrentPreview,
  listenNoSelection,
  listenPreviewOpen,
  listenShortcutError,
  previewFile,
  type PreviewFile,
} from "./api.ts";

/** Loads the current file and follows window opens / global hotkey notifications. */
export function useFilePreview() {
  const [file, setFile] = useState<PreviewFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFile(await getCurrentPreview());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getCurrentPreview()
      .then((value) => { if (!cancelled) setFile(value); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    let stopOpen: (() => void) | undefined;
    let stopError: (() => void) | undefined;
    let stopEmpty: (() => void) | undefined;
    void listenPreviewOpen(() => { void load(); })
      .then((stop) => { if (cancelled) stop(); else stopOpen = stop; })
      .catch(() => {});
    void listenShortcutError((error) => {
      if (!cancelled) setNotice(error);
    }).then((stop) => { if (cancelled) stop(); else stopError = stop; })
      .catch(() => {});
    void listenNoSelection(() => {
      if (!cancelled) setNotice("noSelection");
    }).then((stop) => { if (!cancelled) stop(); else stopEmpty = stop; })
      .catch(() => {});
    return () => {
      cancelled = true;
      stopOpen?.();
      stopError?.();
      stopEmpty?.();
    };
  }, [load]);

  const open = useCallback(async (path: string) => {
    setFailed(false);
    try {
      const value = await previewFile(path);
      setFile(value);
      setNotice(null);
      return true;
    } catch {
      setFailed(true);
      return false;
    }
  }, []);

  return { file, loading, failed, notice, setNotice, load, open };
}
