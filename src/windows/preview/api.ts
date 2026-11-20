import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function closePreviewWindow(): Promise<void> {
  return invoke<void>("close_preview_window");
}

export function setPreviewWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}

export function dragPreviewWindow(): Promise<void> {
  return getCurrentWindow().startDragging();
}

export type PreviewResizeDirection = Parameters<ReturnType<typeof getCurrentWindow>["startResizeDragging"]>[0];

export function resizePreviewWindow(direction: PreviewResizeDirection): Promise<void> {
  return getCurrentWindow().startResizeDragging(direction);
}
