import { Copy, Eye, ExternalLink, FileText, Folder, FolderOpen } from "lucide-react";
import type { FileSearchText } from "../../i18n/sections/fileSearch.ts";
import { kindForExtension } from "../file-preview/preview.ts";
import type { SearchEntry } from "./api.ts";
import { formatDate, formatSize, highlightSegments, parentOf } from "./search.ts";
import "./SearchResultRow.css";

interface Props {
  entry: SearchEntry;
  words: readonly string[];
  selected: boolean;
  localeTag: string;
  t: FileSearchText;
  onOpen: () => void;
  onPreview: () => void;
  onReveal: () => void;
  onCopy: () => void;
  onHover: () => void;
}

export function SearchResultRow({
  entry, words, selected, localeTag, t, onOpen, onPreview, onReveal, onCopy, onHover,
}: Props) {
  const Icon = entry.isDir ? Folder : FileText;
  const previewable = !entry.isDir && kindForExtension(entry.ext) !== null;
  return (
    <div
      className={`search-result${selected ? " search-result--selected" : ""}`}
      role="option"
      aria-selected={selected}
      onPointerEnter={onHover}
      onDoubleClick={onOpen}
    >
      <button
        type="button"
        className="search-result__main"
        aria-label={t.openResult(entry.name)}
        onClick={onOpen}
      >
        <Icon className="search-result__icon" size={18} strokeWidth={1.5} absoluteStrokeWidth />
        <span className="search-result__body">
          <span className="search-result__name">
            {highlightSegments(entry.name, words).map((segment, index) => (
              <span key={index} className={segment.hit ? "search-result__hit" : undefined}>
                {segment.text}
              </span>
            ))}
          </span>
          <span className="search-result__path" title={entry.path}>
            {parentOf(entry)}
          </span>
        </span>
      </button>
      <span className="search-result__meta">
        <span className="search-result__size">{formatSize(entry.size, entry.isDir)}</span>
        <span className="search-result__date">{formatDate(entry.modified, localeTag)}</span>
      </span>
      <span className="search-result__actions">
        {previewable && (
          <button type="button" className="search-result__action" aria-label={t.previewResult(entry.name)}
            title={t.previewResult(entry.name)} onClick={onPreview}>
            <Eye size={15} strokeWidth={1.5} absoluteStrokeWidth />
          </button>
        )}
        <button type="button" className="search-result__action" aria-label={t.revealResult(entry.name)}
          title={t.revealResult(entry.name)} onClick={onReveal}>
          <FolderOpen size={15} strokeWidth={1.5} absoluteStrokeWidth />
        </button>
        <button type="button" className="search-result__action" aria-label={t.copyPathResult(entry.name)}
          title={t.copyPathResult(entry.name)} onClick={onCopy}>
          <Copy size={15} strokeWidth={1.5} absoluteStrokeWidth />
        </button>
        <ExternalLink size={13} className="search-result__open-hint" strokeWidth={1.5} absoluteStrokeWidth aria-hidden="true" />
      </span>
    </div>
  );
}
