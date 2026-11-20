import "../../src/styles/tokens.css";
import "../../src/styles/fonts.css";
import "../../src/styles/base.css";
import "../../src/windows/island/IslandApp.css";
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider, LOCALE_STORAGE_KEY } from "../../src/i18n";
import { IslandApp } from "../../src/windows/island/IslandApp";
import { demoData } from "../../web-demo/demoData";
import { installDemoMocks } from "../../web-demo/mocks";

// A detached clipboard must open its own window when its page dot is clicked.
// The old wiring called setPage("clipboard") first, and the feature guard corrected it to Todo.
Object.assign(globalThis, { isTauri: true, IS_REACT_ACT_ENVIRONMENT: true });
const automated = new URLSearchParams(location.search).has("test");
for (const key of Object.keys(localStorage)) {
  if (key.startsWith("focusd-island-")) localStorage.removeItem(key);
}
localStorage.setItem(LOCALE_STORAGE_KEY, "zh-CN");
localStorage.setItem("focusd-island-last-page", "todo");
localStorage.setItem("focusd-island-settings", JSON.stringify({ clipboardDetached: true }));
installDemoMocks(demoData.zh);

type TauriInternals = { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> };
const internals = (window as unknown as { __TAURI_INTERNALS__: TauriInternals }).__TAURI_INTERNALS__;
const originalInvoke = internals.invoke.bind(internals);
let clipboardWindowOpened = 0;
internals.invoke = (command, args) => {
  if (command === "open_clipboard_window") clipboardWindowOpened++;
  return originalInvoke(command, args);
};

const messages: string[] = [];
const check = (ok: unknown, label: string) => { messages.push(`${ok ? "PASS" : "FAIL"} ${label}`); };
const frames = (count = 3) => new Promise<void>((resolve) => {
  const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(count);
});
const island = () => document.querySelector<HTMLElement>(".island")!;

const root = createRoot(document.getElementById("root")!);
await act(async () => { root.render(<StrictMode><I18nProvider><IslandApp /></I18nProvider></StrictMode>); });
await act(async () => { await frames(4); });

if (automated) {
  check(island().classList.contains("island--todo"), "初始打开的是待办页");
  const openButton = document.querySelector<HTMLButtonElement>(".island__open-button");
  check(Boolean(openButton), "折叠岛屿有展开按钮");
  await act(async () => { openButton?.click(); await frames(4); });
  check(island().classList.contains("island--expanded"), "点击后岛屿展开");
  const clipboardDot = document.querySelector<HTMLButtonElement>(".dot-button--clipboard");
  check(Boolean(clipboardDot), "剪贴板圆点可见");
  await act(async () => { clipboardDot?.click(); await frames(4); });
  check(clipboardWindowOpened === 1, "点击剪贴板圆点请求打开独立窗口");
  check(!island().classList.contains("island--clipboard"), "岛屿没有切到剪贴板页");
  check(island().classList.contains("island--todo"), "岛屿仍停留在待办页，而不是被纠正回来");

  const results = document.getElementById("results")!;
  const failed = messages.some((line) => line.startsWith("FAIL"));
  results.textContent = `${messages.join("\n")}\n${failed ? "FAILED" : "ALL PASS"}`;
  document.documentElement.dataset.testResult = failed ? "failed" : "passed";
}
