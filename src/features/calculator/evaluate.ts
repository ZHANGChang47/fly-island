// The calculator's arithmetic: a small recursive-descent parser, so a typed expression is read
// rather than handed to eval. Supports + - * /, parentheses, a postfix percent sign (divided by
// 100, and read as "a percentage of the left side" in a sum or difference) and a leading sign.
// Full-width and typographic operators are folded onto their ASCII forms first.

export type CalcErrorCode = "empty" | "syntax" | "divide-by-zero" | "overflow";

export type CalcResult = { ok: true; value: number } | { ok: false; error: CalcErrorCode };

type Token =
  | { kind: "number"; value: number }
  | { kind: "operator"; value: string }
  | { kind: "open" }
  | { kind: "close" };

/** A value on the way up the parser; `percent` marks a postfix % so a sum can read it relatively. */
type Term = { value: number; percent: boolean };

class CalcFailure extends Error {
  readonly code: CalcErrorCode;

  constructor(code: CalcErrorCode) {
    super(code);
    this.code = code;
  }
}

const OPERATOR_ALIASES: Readonly<Record<string, string>> = {
  "×": "*",
  "·": "*",
  "÷": "/",
  "−": "-",
  "–": "-",
  "—": "-",
  "＋": "+",
  "＊": "*",
  "／": "/",
  "（": "(",
  "）": ")",
};

/** Spaces, thousands separators and the like are decoration: they never change the value. */
const IGNORED = /[\s,_]/g;

function normalizeExpression(source: string): string {
  return source.replace(IGNORED, "").replace(/[×·÷−–—＋＊／（）]/g, (character) => OPERATOR_ALIASES[character] ?? character);
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if ((character >= "0" && character <= "9") || character === ".") {
      let end = index;
      let dots = 0;
      while (end < source.length && ((source[end] >= "0" && source[end] <= "9") || source[end] === ".")) {
        if (source[end] === ".") dots += 1;
        end += 1;
      }
      const text = source.slice(index, end);
      const value = Number(text);
      if (dots > 1 || text === "." || !Number.isFinite(value)) throw new CalcFailure("syntax");
      tokens.push({ kind: "number", value });
      index = end;
      continue;
    }
    if (character === "+" || character === "-" || character === "*" || character === "/" || character === "%") {
      tokens.push({ kind: "operator", value: character });
      index += 1;
      continue;
    }
    if (character === "(") {
      tokens.push({ kind: "open" });
      index += 1;
      continue;
    }
    if (character === ")") {
      tokens.push({ kind: "close" });
      index += 1;
      continue;
    }
    // Anything else (letters, a stray symbol) is not arithmetic.
    throw new CalcFailure("syntax");
  }
  return tokens;
}

function finite(value: number): number {
  if (!Number.isFinite(value)) throw new CalcFailure("overflow");
  return value;
}

/** Reads an expression into a number; throws CalcFailure with the reason it could not. */
function parse(tokens: Token[]): number {
  let index = 0;
  const peek = (): Token | undefined => tokens[index];

  const parsePrimary = (): Term => {
    const token = peek();
    if (!token) throw new CalcFailure("syntax");
    if (token.kind === "number") {
      index += 1;
      return { value: token.value, percent: false };
    }
    if (token.kind === "open") {
      index += 1;
      const inner = parseSum();
      const close = peek();
      if (!close || close.kind !== "close") throw new CalcFailure("syntax");
      index += 1;
      return { value: inner.value, percent: false };
    }
    throw new CalcFailure("syntax");
  };

  const parsePostfix = (): Term => {
    let term = parsePrimary();
    let token = peek();
    while (token && token.kind === "operator" && token.value === "%") {
      index += 1;
      term = { value: finite(term.value / 100), percent: true };
      token = peek();
    }
    return term;
  };

  const parseUnary = (): Term => {
    const token = peek();
    if (token && token.kind === "operator" && (token.value === "+" || token.value === "-")) {
      index += 1;
      const inner = parseUnary();
      return { value: token.value === "-" ? finite(-inner.value) : inner.value, percent: inner.percent };
    }
    return parsePostfix();
  };

  const parseProduct = (): Term => {
    let left = parseUnary();
    let token = peek();
    while (token && token.kind === "operator" && (token.value === "*" || token.value === "/")) {
      index += 1;
      const right = parseUnary();
      if (token.value === "/") {
        if (right.value === 0) throw new CalcFailure("divide-by-zero");
        left = { value: finite(left.value / right.value), percent: false };
      } else {
        left = { value: finite(left.value * right.value), percent: false };
      }
      token = peek();
    }
    return left;
  };

  const parseSum = (): Term => {
    let left = parseProduct();
    let token = peek();
    while (token && token.kind === "operator" && (token.value === "+" || token.value === "-")) {
      index += 1;
      const right = parseProduct();
      // "200 + 10%" reads as 200 + 10% of 200, the way a pocket calculator does.
      const amount = right.percent ? finite(left.value * right.value) : right.value;
      left = { value: finite(token.value === "+" ? left.value + amount : left.value - amount), percent: false };
      token = peek();
    }
    return left;
  };

  const result = parseSum();
  if (index !== tokens.length) throw new CalcFailure("syntax");
  return finite(result.value);
}

/** The value of `input`, or the reason it has none. Never throws. */
export function evaluateExpression(input: string): CalcResult {
  const normalized = normalizeExpression(input);
  if (normalized === "") return { ok: false, error: "empty" };
  try {
    return { ok: true, value: parse(tokenize(normalized)) };
  } catch (failure) {
    if (failure instanceof CalcFailure) return { ok: false, error: failure.code };
    return { ok: false, error: "syntax" };
  }
}

/**
 * A result as text: grouped thousands, at most ten decimals, with binary noise such as
 * 0.30000000000000004 rounded away. Very large or very small values go to exponent form.
 */
export function formatNumber(value: number, locale = "en-US"): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e15 || magnitude < 1e-9) {
    return value.toExponential(6).replace(/\.?0+e/, "e").replace("e+", "e");
  }
  const rounded = Number.parseFloat(value.toPrecision(12));
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(rounded);
}
