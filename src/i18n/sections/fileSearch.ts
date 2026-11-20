export type FileSearchText = {
  title: string;
  searchPlaceholder: string;
  searchLabel: string;
  islandPageHint: string;
  clearSearch: string;
  hint: string;
  hintSyntax: string;
  openWindow: string;
  closeWindow: string;
  moveWindow: string;
  windowActionFailed: string;
  resultCount: (count: number) => string;
  indexedCount: (count: number) => string;
  indexing: (scanned: number) => string;
  ready: string;
  rebuild: string;
  rebuilding: string;
  emptyPrompt: string;
  emptyNoResults: string;
  openResult: (name: string) => string;
  previewResult: (name: string) => string;
  revealResult: (name: string) => string;
  copyPathResult: (name: string) => string;
  copied: string;
  folder: string;
  shortcutError: (error: string) => string;
};

export const zhCN: FileSearchText = {
  title: "全局搜索",
  searchPlaceholder: "搜索文件与文件夹…",
  searchLabel: "搜索本地文件",
  islandPageHint: "搜索页就在岛上；按 Ctrl+Shift+G 随时把它调出来。首次启动会在后台建立索引。",
  clearSearch: "清除搜索",
  hint: "输入文件名即可搜索；用空格分隔多个关键词。",
  hintSyntax: "支持 ext:rs 按扩展名、path:work 按路径筛选。",
  openWindow: "打开全局搜索（Ctrl+Shift+G）",
  closeWindow: "关闭搜索窗口",
  moveWindow: "拖动窗口",
  windowActionFailed: "操作失败，请重试",
  resultCount: (count) => `${count} 个结果`,
  indexedCount: (count) => `已索引 ${count.toLocaleString()} 个项目`,
  indexing: (scanned) => `正在建立索引… ${scanned.toLocaleString()} 个项目`,
  ready: "索引就绪",
  rebuild: "重新索引",
  rebuilding: "正在重建索引…",
  emptyPrompt: "输入关键词，立即搜索本机文件。",
  emptyNoResults: "没有匹配的文件。",
  openResult: (name) => `打开 ${name}`,
  previewResult: (name) => `预览 ${name}`,
  revealResult: (name) => `在文件夹中显示 ${name}`,
  copyPathResult: (name) => `复制 ${name} 的路径`,
  copied: "已复制路径",
  folder: "文件夹",
  shortcutError: (error) => `快捷键未生效：${error}`,
};

export const en: FileSearchText = {
  title: "Global search",
  searchPlaceholder: "Search files and folders…",
  searchLabel: "Search local files",
  islandPageHint: "Search lives on the island: press Ctrl+Shift+G to bring it up. The index is built in the background on first launch.",
  clearSearch: "Clear search",
  hint: "Type a file name to search; separate words with spaces.",
  hintSyntax: "Use ext:rs for extension and path:work for folder filters.",
  openWindow: "Open global search (Ctrl+Shift+G)",
  closeWindow: "Close search window",
  moveWindow: "Move window",
  windowActionFailed: "Action failed. Try again.",
  resultCount: (count) => (count === 1 ? "1 result" : `${count} results`),
  indexedCount: (count) => `${count.toLocaleString()} items indexed`,
  indexing: (scanned) => `Building index… ${scanned.toLocaleString()} items`,
  ready: "Index ready",
  rebuild: "Rebuild index",
  rebuilding: "Rebuilding index…",
  emptyPrompt: "Type a keyword to search files on this PC.",
  emptyNoResults: "No matching files.",
  openResult: (name) => `Open ${name}`,
  previewResult: (name) => `Preview ${name}`,
  revealResult: (name) => `Show ${name} in folder`,
  copyPathResult: (name) => `Copy path of ${name}`,
  copied: "Path copied",
  folder: "Folder",
  shortcutError: (error) => `Shortcut unavailable: ${error}`,
};
