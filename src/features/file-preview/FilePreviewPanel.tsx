import { ExternalLink, FileWarning } from "lucide-react";
import { useTranslation } from "../../i18n";
import {
  openPreviewExternally,
  type PreviewFile,
} from "./api.ts";
import { mimeFor } from "./preview.ts";
import { ExcelRenderer } from "./renderers/ExcelRenderer.tsx";
import { ImageRenderer } from "./renderers/ImageRenderer.tsx";
import { MarkdownRenderer } from "./renderers/MarkdownRenderer.tsx";
import { PdfRenderer } from "./renderers/PdfRenderer.tsx";
import { SlidesRenderer } from "./renderers/SlidesRenderer.tsx";
import { WordRenderer } from "./renderers/WordRenderer.tsx";
import "./FilePreviewPanel.css";

export function FilePreviewPanel({ file }: { file: PreviewFile }) {
  const t = useTranslation().filePreview;
  const isCsv = /\.((csv)|(tsv))$/i.test(file.path);
  const openExternally = () => { void openPreviewExternally(); };

  return (
    <div className="file-preview">
      <header className="file-preview__header">
        <div className="file-preview__heading">
          <span className="file-preview__name" title={file.path}>{file.name}</span>
          <span className="file-preview__path" title={file.path}>{file.path}</span>
        </div>
        <button type="button" className="file-preview__action" onClick={openExternally}
          aria-label={t.openExternally} title={t.openExternally}>
          <ExternalLink size={16} strokeWidth={1.6} absoluteStrokeWidth />
          <span>{t.openExternally}</span>
        </button>
      </header>
      {file.truncated && (
        <p className="file-preview__warning" role="status">
          <FileWarning size={14} strokeWidth={1.6} absoluteStrokeWidth /> {t.truncated}
        </p>
      )}
      <div className="file-preview__body">
        {file.kind === "pdf" && <PdfRenderer data={file.data} />}
        {file.kind === "word" && <WordRenderer data={file.data} />}
        {file.kind === "excel" && <ExcelRenderer data={file.data} isCsv={isCsv} />}
        {file.kind === "slides" && <SlidesRenderer data={file.data} />}
        {file.kind === "markdown" && <MarkdownRenderer data={file.data} />}
        {file.kind === "image" && (
          <ImageRenderer data={file.data} mime={mimeFor(file.path)} name={file.name} />
        )}
      </div>
    </div>
  );
}
