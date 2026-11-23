export type CalculatorText = {
  title: string;
  /** The page's one-line explanation under the keypad. */
  hint: string;
  history: string;
  /** What the keypad accepts, for the settings page. */
  operators: string;
  clear: string;
  backspace: string;
  equals: string;
  /** Shown in place of a result while the expression cannot be read. */
  invalid: string;
  divideByZero: string;
  overflow: string;
};

export const zhCN: CalculatorText = {
  title: "计算器",
  hint: "Enter 计算，键盘可直接输入",
  history: "历史",
  operators: "支持 + − × ÷、括号与百分号",
  clear: "清空",
  backspace: "退格",
  equals: "计算",
  invalid: "算式不完整",
  divideByZero: "不能除以 0",
  overflow: "数值超出范围",
};

export const en: CalculatorText = {
  title: "Calculator",
  hint: "Enter to calculate; the keyboard types directly",
  history: "History",
  operators: "Supports + − × ÷, parentheses and percent",
  clear: "Clear",
  backspace: "Backspace",
  equals: "Calculate",
  invalid: "Incomplete expression",
  divideByZero: "Cannot divide by zero",
  overflow: "Number out of range",
};
