export type FilePreviewText = {
  title: string;
  moveWindow: string;
  closeWindow: string;
  windowActionFailed: string;
  loadFailed: string;
  openFailed: string;
  unsupported: string;
  truncated: string;
  openExternally: string;
  openExternallyFailed: string;
  noSelection: string;
  shortcutError: (error: string) => string;
  settingsHint: string;
  formats: string;
  shortcut: string;
};

export const zhCN: FilePreviewText = {
  title: "文件预览",
  moveWindow: "拖动窗口",
  closeWindow: "关闭预览",
  windowActionFailed: "操作失败，请重试",
  loadFailed: "无法读取预览内容",
  openFailed: "无法打开文件，请重试",
  unsupported: "该文件格式暂不支持预览。支持 PDF、Word、Excel、PPT、Markdown 与常见图片。",
  truncated: "文件过大，仅预览前 24 MB；完整内容请用系统程序打开。",
  openExternally: "用系统程序打开",
  openExternallyFailed: "无法用系统程序打开该文件",
  noSelection: "当前没有可预览的文件，请先在资源管理器中选中文件。",
  shortcutError: (error) => `预览快捷键未生效：${error}`,
  settingsHint: "在资源管理器或桌面选中文件后按空格即可快速预览（也可用 Ctrl+Shift+P）；在全局搜索结果里也可以点预览按钮。",
  formats: "支持 PDF、DOCX、XLSX/CSV、PPTX、Markdown、JPG/PNG 等格式。旧版 DOC/XLS/PPT 请用系统程序打开。",
  shortcut: "快捷键：空格（资源管理器/桌面），或 Ctrl+Shift+P",
};

export const en: FilePreviewText = {
  title: "File preview",
  moveWindow: "Move window",
  closeWindow: "Close preview",
  windowActionFailed: "Action failed. Try again.",
  loadFailed: "Could not load the preview",
  openFailed: "Could not open the file. Try again.",
  unsupported: "This file type cannot be previewed. PDF, Word, Excel, PowerPoint, Markdown and common images are supported.",
  truncated: "The file is large: only the first 24 MB is previewed. Open it in its own app for the full content.",
  openExternally: "Open in system app",
  openExternallyFailed: "Could not open the file in its system app",
  noSelection: "No file to preview. Select a file in File Explorer first.",
  shortcutError: (error) => `Preview shortcut unavailable: ${error}`,
  settingsHint: "Select a file in File Explorer or on the desktop and press Space to preview it (Ctrl+Shift+P also works). Search results also have a preview button.",
  formats: "Supports PDF, DOCX, XLSX/CSV, PPTX, Markdown, JPG/PNG and more. Legacy DOC/XLS/PPT need their system app.",
  shortcut: "Shortcut: Space (Explorer/desktop), or Ctrl+Shift+P",
};
