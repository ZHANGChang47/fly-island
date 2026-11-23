import assert from "node:assert/strict";
import test from "node:test";
import { evaluateExpression, formatNumber } from "../../src/features/calculator/evaluate.ts";

const value = (expression) => {
  const result = evaluateExpression(expression);
  assert.equal(result.ok, true, `${expression} should evaluate: ${JSON.stringify(result)}`);
  return result.value;
};

test("arithmetic follows precedence and parentheses", () => {
  assert.equal(value("1+2*3"), 7);
  assert.equal(value("(1+2)*3"), 9);
  assert.equal(value("8/2-3"), 1);
  assert.equal(value("2*(3+4)-5"), 9);
  assert.equal(value("-3*-2"), 6);
  assert.equal(value("+4--4"), 8);
});

test("the keypad's typographic operators read as arithmetic", () => {
  assert.equal(value("6×7"), 42);
  assert.equal(value("8÷2"), 4);
  assert.equal(value("5−2"), 3);
  assert.equal(value("（2＋3）×4"), 20);
});

test("a percent sign divides by a hundred and joins a sum relatively", () => {
  assert.equal(value("50%"), 0.5);
  assert.equal(value("200*10%"), 20);
  assert.equal(value("200+10%"), 220);
  assert.equal(value("200-10%"), 180);
  assert.equal(value("100+10%*2"), 100.2);
});

test("thousands separators and spaces are ignored", () => {
  assert.equal(value("1,000 + 2"), 1002);
  assert.equal(value(" 3 * 4 "), 12);
});

test("missing or stray input reports the reason instead of a number", () => {
  assert.deepEqual(evaluateExpression(""), { ok: false, error: "empty" });
  assert.deepEqual(evaluateExpression("   "), { ok: false, error: "empty" });
  assert.deepEqual(evaluateExpression("1+"), { ok: false, error: "syntax" });
  assert.deepEqual(evaluateExpression("()"), { ok: false, error: "syntax" });
  assert.deepEqual(evaluateExpression("2..3"), { ok: false, error: "syntax" });
  assert.deepEqual(evaluateExpression("1/0"), { ok: false, error: "divide-by-zero" });
  assert.deepEqual(evaluateExpression("2+abc"), { ok: false, error: "syntax" });
  assert.deepEqual(evaluateExpression("999999999e999"), { ok: false, error: "syntax" });
});

test("results print without binary noise or a leading zero tail", () => {
  assert.equal(formatNumber(0.1 + 0.2), "0.3");
  assert.equal(formatNumber(1000), "1,000");
  assert.equal(formatNumber(1 / 3), "0.3333333333");
  assert.equal(formatNumber(0), "0");
  assert.equal(formatNumber(-2.5), "-2.5");
  assert.equal(formatNumber(1e20), "1e20");
});
