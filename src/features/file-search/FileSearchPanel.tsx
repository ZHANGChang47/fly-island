import { RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "../../i18n";
import { SearchResultRow } from "./SearchResultRow.tsx";
import { highlightWords } from "./search.ts";
import { useFileSearch } from "./useFileSearch.ts";
import "./FileSearchPanel.css";

export function FileSearchPanel() {
  const translation = useTranslation();
  const t = translation.fileSearch;
  const localeTag = translation.localeTag;
  const search = useFileSearch();
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const copiedTimer = useRef<number>(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [search.query]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const words = useMemo(() => highlightWords(search.query), [search.query]);

  const copyPath = (path: string) => {
    void search.copyPath(path);
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = search.results.length;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (count) setSelected((value) => (value + 1) % count);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (count) setSelected((value) => (value - 1 + count) % count);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = search.results[selected];
      if (entry) void search.open(entry.path);
    } else if (event.key === " " && event.target !== inputRef.current) {
      event.preventDefault();
      const entry = search.results[selected];
      if (entry) void search.preview(entry.path);
    } else if (event.key === "Escape" && search.query) {
      event.preventDefault();
      search.setQuery("");
    }
  };

  useEffect(() => {
    listRef.current?.querySelector(".search-result--selected")?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const statusText = search.status.building
    ? t.indexing(search.status.scanned)
    : search.status.entryCount > 0
      ? t.indexedCount(search.status.entryCount)
      : t.ready;

  return (
    <div className="file-search" onKeyDown={onKeyDown}>
      <div className="file-search__input-row">
        <Search className="file-search__input-icon" size={18} strokeWidth={1.6} absoluteStrokeWidth />
        <input
          ref={inputRef}
          className="file-search__input"
          type="text"
          value={search.query}
          onChange={(event) => search.setQuery(event.target.value)}
          placeholder={t.searchPlaceholder}
          aria-label={t.searchLabel}
          spellCheck={false}
          autoComplete="off"
        />
        {copied && <span className="file-search__copied">{t.copied}</span>}
        {search.query && (
          <button type="button" className="file-search__icon-button" aria-label={t.clearSearch}
            onClick={() => { search.setQuery(""); inputRef.current?.focus(); }}>
            <X size={16} strokeWidth={1.6} absoluteStrokeWidth />
          </button>
        )}
      </div>
      <p className="file-search__hint">
        {t.hint} <span className="file-search__hint-syntax">{t.hintSyntax}</span>
      </p>
      <div className="file-search__status">
        <span className={`file-search__status-dot${search.status.building ? " file-search__status-dot--busy" : ""}`} />
        <span className="file-search__status-text">{statusText}</span>
        <button type="button" className="file-search__rebuild" disabled={search.status.building}
          onClick={() => void search.refreshIndex()}>
          <RefreshCw size={13} strokeWidth={1.6} absoluteStrokeWidth className={search.status.building ? "file-search__spin" : undefined} />
          {search.status.building ? t.rebuilding : t.rebuild}
        </button>
        {search.query.trim() && !search.searching && (
          <span className="file-search__count">{t.resultCount(search.results.length)}</span>
        )}
      </div>
      {search.shortcutError && (
        <p className="file-search__error" role="alert">{t.shortcutError(search.shortcutError)}</p>
      )}
      <div className="file-search__results" role="listbox" ref={listRef}>
        {search.results.length === 0 ? (
          <div className="file-search__empty">
            {search.query.trim() ? t.emptyNoResults : t.emptyPrompt}
          </div>
        ) : (
          search.results.map((entry, index) => (
            <SearchResultRow
              key={entry.path}
              entry={entry}
              words={words}
              selected={index === selected}
              localeTag={localeTag}
              t={t}
              onOpen={() => void search.open(entry.path)}
              onPreview={() => void search.preview(entry.path)}
              onReveal={() => void search.reveal(entry.path)}
              onCopy={() => copyPath(entry.path)}
              onHover={() => setSelected(index)}
            />
          ))
        )}
      </div>
      {search.failed && <p className="file-search__error" role="alert">{t.windowActionFailed}</p>}
    </div>
  );
}
