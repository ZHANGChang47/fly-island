import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function closeSearchWindow(): Promise<void> {
  return invoke<void>("close_search_window");
}

export function dragSearchWindow(): Promise<void> {
  return getCurrentWindow().startDragging();
}

export function setSearchWindowTitle(title: string): Promise<void> {
  return getCurrentWindow().setTitle(title);
}

export type SearchResizeDirection = Parameters<ReturnType<typeof getCurrentWindow>["startResizeDragging"]>[0];

export function resizeSearchWindow(direction: SearchResizeDirection): Promise<void> {
  return getCurrentWindow().startResizeDragging(direction);
}
