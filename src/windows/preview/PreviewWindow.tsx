import { X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { FilePreviewPanel } from "../../features/file-preview/FilePreviewPanel.tsx";
import { useFilePreview } from "../../features/file-preview/useFilePreview.ts";
import {
  closePreviewWindow,
  dragPreviewWindow,
  resizePreviewWindow,
  type PreviewResizeDirection,
} from "./api.ts";
import { usePreviewWindow } from "./usePreviewWindow.ts";
import "./PreviewWindow.css";

const EDGES: PreviewResizeDirection[] = [
  "North", "South", "East", "West",
  "NorthEast", "NorthWest", "SouthEast", "SouthWest",
];

export function PreviewWindow() {
  const t = useTranslation();
  const frame = usePreviewWindow(t.filePreview.title);
  const preview = useFilePreview();
  const notice = preview.notice === "noSelection" ? t.filePreview.noSelection : preview.notice;

  return (
    <main className="preview-window">
      <header className="preview-window__titlebar" onPointerDown={(event) => {
        if (event.button !== 0 || (event.target as Element).closest("button")) return;
        event.preventDefault();
        void dragPreviewWindow().catch(frame.reportFailure);
      }}>
        <span className="preview-window__title">{t.filePreview.title}</span>
        <span className="preview-window__drag-area" aria-label={t.filePreview.moveWindow} />
        <button className="preview-window__button" type="button" aria-label={t.filePreview.closeWindow}
          onClick={() => { void closePreviewWindow().catch(frame.reportFailure); }}>
          <X size={16} strokeWidth={1.5} absoluteStrokeWidth />
        </button>
      </header>
      <div className="preview-window__content">
        {preview.loading && <p className="preview-window__status">…</p>}
        {notice && <p className="preview-window__status" role="alert">{notice}</p>}
        {preview.failed && <p className="preview-window__status" role="alert">{t.filePreview.loadFailed}</p>}
        {!preview.loading && preview.file && <FilePreviewPanel file={preview.file} />}
        {!preview.loading && !preview.file && !notice && <p className="preview-window__status">{t.filePreview.settingsHint}</p>}
      </div>
      {frame.failed && <div className="preview-window__status" role="alert">{t.filePreview.windowActionFailed}</div>}
      {EDGES.map((edge) => (
        <div key={edge} className={`preview-window__resize preview-window__resize--${edge}`} aria-hidden="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void resizePreviewWindow(edge).catch(frame.reportFailure);
          }} />
      ))}
    </main>
  );
}
