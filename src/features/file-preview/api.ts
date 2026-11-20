import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Mirrors `PreviewKind` in src-tauri/src/file_preview/model.rs. */
export type PreviewKind = "pdf" | "word" | "excel" | "slides" | "markdown" | "image";

/** Mirrors `PreviewFile` in src-tauri/src/file_preview/model.rs. */
export interface PreviewFile {
  path: string;
  name: string;
  kind: PreviewKind;
  /** Base64 of the file bytes. */
  data: string;
  truncated: boolean;
}

/** Matches constants in file_preview/mod.rs. */
export const FILE_PREVIEW_OPEN_EVENT = "file-preview-open";
export const FILE_PREVIEW_SHORTCUT_ERROR_EVENT = "file-preview-shortcut-error";
export const FILE_PREVIEW_NO_SELECTION_EVENT = "file-preview-no-selection";

export function previewFile(path: string): Promise<PreviewFile> {
  return invoke<PreviewFile>("preview_file", { path });
}

export function getCurrentPreview(): Promise<PreviewFile | null> {
  return invoke<PreviewFile | null>("get_current_preview");
}

export function openFilePreview(): Promise<void> {
  return invoke<void>("open_file_preview");
}

export function openPreviewExternally(): Promise<void> {
  return invoke<void>("open_preview_externally");
}

/** Loads a path into the preview slot, then shows/focuses the preview window. */
export async function previewPath(path: string): Promise<void> {
  await previewFile(path);
  await openFilePreview();
}

export function listenPreviewOpen(handler: () => void): Promise<() => void> {
  return listen(FILE_PREVIEW_OPEN_EVENT, () => handler());
}

export function listenShortcutError(handler: (error: string | null) => void): Promise<() => void> {
  return listen<string | null>(FILE_PREVIEW_SHORTCUT_ERROR_EVENT, (event) => handler(event.payload));
}

export function listenNoSelection(handler: () => void): Promise<() => void> {
  return listen(FILE_PREVIEW_NO_SELECTION_EVENT, () => handler());
}
