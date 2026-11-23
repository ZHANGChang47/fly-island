import { Calculator, Clipboard, FolderInput, Languages, ListChecks, Music2, Search, type LucideIcon } from "lucide-react";
import type { PageDot } from "./types";

export const PAGE_ICONS: Record<PageDot, LucideIcon> = {
  todo: ListChecks,
  music: Music2,
  clipboard: Clipboard,
  shelf: FolderInput,
  search: Search,
  translation: Languages,
  calculator: Calculator,
};
