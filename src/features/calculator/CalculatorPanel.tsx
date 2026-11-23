import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { evaluateExpression, formatNumber } from "./evaluate";
import "./CalculatorPanel.css";

const STORAGE_KEY = "fly-island-calculator";
/** How many past results the strip keeps; the oldest are dropped. */
const HISTORY_LIMIT = 20;

type HistoryEntry = { expression: string; value: string };

type Key =
  | { kind: "insert"; label: string; token: string; tone?: "operator" }
  | { kind: "clear"; label: string }
  | { kind: "backspace"; label: string };

const KEYS: readonly (readonly Key[])[] = [
  [
    { kind: "clear", label: "C" },
    { kind: "backspace", label: "⌫" },
    { kind: "insert", label: "(", token: "(" },
    { kind: "insert", label: ")", token: ")" },
  ],
  [
    { kind: "insert", label: "7", token: "7" },
    { kind: "insert", label: "8", token: "8" },
    { kind: "insert", label: "9", token: "9" },
    { kind: "insert", label: "÷", token: "/", tone: "operator" },
  ],
  [
    { kind: "insert", label: "4", token: "4" },
    { kind: "insert", label: "5", token: "5" },
    { kind: "insert", label: "6", token: "6" },
    { kind: "insert", label: "×", token: "*", tone: "operator" },
  ],
  [
    { kind: "insert", label: "1", token: "1" },
    { kind: "insert", label: "2", token: "2" },
    { kind: "insert", label: "3", token: "3" },
    { kind: "insert", label: "−", token: "-", tone: "operator" },
  ],
  [
    { kind: "insert", label: "0", token: "0" },
    { kind: "insert", label: ".", token: "." },
    { kind: "insert", label: "%", token: "%" },
    { kind: "insert", label: "+", token: "+", tone: "operator" },
  ],
];

/** Reads what an earlier visit left: the expression and the results already worked out. */
function loadStored(): { expression: string; history: HistoryEntry[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { expression: "", history: [] };
    const saved = JSON.parse(raw) as { expression?: unknown; history?: unknown };
    const history = Array.isArray(saved.history)
      ? saved.history.filter((entry): entry is HistoryEntry =>
        typeof entry === "object" && entry !== null
        && typeof (entry as HistoryEntry).expression === "string"
        && typeof (entry as HistoryEntry).value === "string").slice(0, HISTORY_LIMIT)
      : [];
    return { expression: typeof saved.expression === "string" ? saved.expression : "", history };
  } catch {
    return { expression: "", history: [] };
  }
}

/**
 * The calculator as a page of the expanded island: an expression is typed or tapped in, the
 * result follows as it changes, and Enter keeps the working in a short history. Like the
 * translation page it leaves its text alone while the island collapses, and keeps it on disk
 * so switching pages and back does not lose the sum.
 */
export function CalculatorPanel({ isOpen }: { isOpen: boolean }) {
  const t = useTranslation();
  const stored = useMemo(loadStored, []);
  const [expression, setExpression] = useState(stored.expression);
  const [history, setHistory] = useState<HistoryEntry[]>(stored.history);
  /** Set by Enter: a digit starts a new expression instead of editing the result. */
  const [fromResult, setFromResult] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ expression, history }));
    } catch {
      // A full or blocked storage only costs the memory of this page.
    }
  }, [expression, history]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  // After a tap the caret goes back where the token landed, so the input keeps typing where it was.
  useEffect(() => {
    if (caret.current === null) return;
    const at = caret.current;
    caret.current = null;
    inputRef.current?.setSelectionRange(at, at);
  }, [expression]);

  const outcome = useMemo(() => evaluateExpression(expression), [expression]);
  const localeTag = t.localeTag;
  const text = t.calculator;
  const shown = expression.trim() === ""
    ? "0"
    : outcome.ok ? formatNumber(outcome.value, localeTag) : "—";
  const note = !outcome.ok && expression.trim() !== ""
    ? outcome.error === "divide-by-zero" ? text.divideByZero
      : outcome.error === "overflow" ? text.overflow
        : text.invalid
    : "";

  const insert = useCallback((token: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    if (fromResult && /^[0-9.(]$/.test(token)) {
      setExpression(token);
      setFromResult(false);
      caret.current = token.length;
      return;
    }
    setExpression(expression.slice(0, start) + token + expression.slice(end));
    setFromResult(false);
    caret.current = start + token.length;
  }, [expression, fromResult]);

  const backspace = useCallback(() => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? expression.length;
    const end = input?.selectionEnd ?? start;
    if (start !== end) {
      setExpression(expression.slice(0, start) + expression.slice(end));
      caret.current = start;
    } else if (start > 0) {
      setExpression(expression.slice(0, start - 1) + expression.slice(start));
      caret.current = start - 1;
    }
    setFromResult(false);
  }, [expression]);

  const clear = useCallback(() => {
    setExpression("");
    setFromResult(false);
    caret.current = 0;
    inputRef.current?.focus();
  }, []);

  const commit = useCallback(() => {
    const result = evaluateExpression(expression);
    if (!result.ok) return;
    const value = formatNumber(result.value, localeTag);
    if (expression.trim() !== value) {
      setHistory((current) => [{ expression: expression.trim(), value }, ...current].slice(0, HISTORY_LIMIT));
    }
    setExpression(value);
    setFromResult(true);
    caret.current = value.length;
    inputRef.current?.focus();
  }, [expression, localeTag]);

  const onKey = (key: Key) => {
    if (key.kind === "clear") clear();
    else if (key.kind === "backspace") backspace();
    else insert(key.token);
  };

  return (
    <div className="calc">
      <div className="calc__display">
        <input
          ref={inputRef}
          className="calc__expression"
          value={expression}
          onChange={(event) => { setExpression(event.target.value); setFromResult(false); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
          }}
          placeholder="0"
          aria-label={text.title}
          spellCheck={false}
          autoComplete="off"
        />
        <div className={`calc__result${outcome.ok || expression.trim() === "" ? "" : " calc__result--invalid"}`} aria-live="polite">
          {shown}
        </div>
        <div className="calc__note">{note}</div>
      </div>
      <div className="calc__pad">
        {KEYS.map((row, rowIndex) => row.map((key) => (
          <button
            key={`${rowIndex}-${key.label}`}
            type="button"
            className={`calc__key${key.kind === "insert" && key.tone === "operator" ? " calc__key--operator" : ""}${key.kind !== "insert" ? " calc__key--action" : ""}`}
            aria-label={key.kind === "clear" ? text.clear : key.kind === "backspace" ? text.backspace : undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onKey(key)}
          >
            {key.label}
          </button>
        )))}
      </div>
      <button type="button" className="calc__equals" onMouseDown={(event) => event.preventDefault()} onClick={commit}>
        {text.equals}
      </button>
      <div className="calc__footer">
        <span className="calc__hint">{text.hint}</span>
        {history.length > 0 && (
          <div className="calc__history" aria-label={text.history}>
            {history.slice(0, 3).map((entry, index) => (
              <button
                key={`${entry.expression}-${entry.value}-${index}`}
                type="button"
                className="calc__history-entry"
                title={`${entry.expression} = ${entry.value}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setExpression(entry.expression);
                  setFromResult(false);
                  caret.current = entry.expression.length;
                  inputRef.current?.focus();
                }}
              >
                {entry.expression} = {entry.value}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
