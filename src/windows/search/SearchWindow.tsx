import { X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { FileSearchPanel } from "../../features/file-search/FileSearchPanel.tsx";
import { closeSearchWindow, dragSearchWindow, resizeSearchWindow, type SearchResizeDirection } from "./api.ts";
import { useSearchWindow } from "./useSearchWindow.ts";
import "./SearchWindow.css";

const EDGES: SearchResizeDirection[] = [
  "North", "South", "East", "West",
  "NorthEast", "NorthWest", "SouthEast", "SouthWest",
];

export function SearchWindow() {
  const t = useTranslation();
  const frame = useSearchWindow(t.fileSearch.title);
  return (
    <main className="search-window">
      <header className="search-window__titlebar" onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("button")) return;
        event.preventDefault();
        void dragSearchWindow().catch(frame.reportFailure);
      }}>
        <span className="search-window__title">{t.fileSearch.title}</span>
        <span className="search-window__drag-area" aria-label={t.fileSearch.moveWindow} />
        <button className="search-window__button" type="button" aria-label={t.fileSearch.closeWindow}
          onClick={() => { void closeSearchWindow().catch(frame.reportFailure); }}>
          <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
        </button>
      </header>
      <div className="search-window__content">
        <FileSearchPanel />
      </div>
      {frame.failed && <div className="search-window__error" role="alert">{t.fileSearch.windowActionFailed}</div>}
      {EDGES.map((edge) => (
        <div key={edge} className={`search-window__resize search-window__resize--${edge}`} aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void resizeSearchWindow(edge).catch(frame.reportFailure);
          }} />
      ))}
    </main>
  );
}
