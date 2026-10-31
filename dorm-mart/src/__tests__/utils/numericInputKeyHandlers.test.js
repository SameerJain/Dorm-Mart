import { decimalNumericKeyDownHandler, integerNumericKeyDownHandler } from "../../utils/numericInputKeyHandlers";

// Plain functions, not jest.fn(): react-scripts resets mocks between tests.
function keyEvent(key, value = "", modifiers = {}) {
  const event = { key, currentTarget: { value }, prevented: 0, ...modifiers };
  event.preventDefault = () => {
    event.prevented += 1;
  };
  return event;
}
const blocked = (handler, key, value, modifiers) => {
  const event = keyEvent(key, value, modifiers);
  handler(event);
  return event.prevented === 1;
};

const NAV_KEYS = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

describe.each([
  ["integer", integerNumericKeyDownHandler],
  ["decimal", decimalNumericKeyDownHandler],
])("%s handler", (_name, handler) => {
  test.each(NAV_KEYS)("never blocks %s", (key) => {
    expect(blocked(handler, key, "12.5")).toBe(false);
  });

  test.each(["0", "5", "9"])("allows the digit %s", (key) => {
    expect(blocked(handler, key, "12.5")).toBe(false);
  });

  test.each(["e", "E", "+", "-", "a", "z", " ", ",", "$", "!", "Shift", "F5"])("blocks %p", (key) => {
    expect(blocked(handler, key, "")).toBe(true);
  });

  test("blocks a longer key name that merely starts or ends with a digit", () => {
    for (const key of ["12", "1a", "a1", "Digit1", "١"]) {
      expect(blocked(handler, key, "")).toBe(true);
    }
  });

  test.each(["ctrlKey", "metaKey", "altKey"])("lets shortcuts through with %s held, so copy and paste work", (modifier) => {
    expect(blocked(handler, "v", "", { [modifier]: true })).toBe(false);
    expect(blocked(handler, "e", "", { [modifier]: true })).toBe(false);
  });

  test("lets IME and unidentified keys through, since the value is checked on change", () => {
    expect(blocked(handler, "Unidentified", "")).toBe(false);
    expect(blocked(handler, "Process", "")).toBe(false);
  });

  test("Shift alone does not unlock letters", () => {
    expect(blocked(handler, "E", "", { shiftKey: true })).toBe(true);
  });
});

describe("integer handler", () => {
  test("never allows a decimal point", () => {
    expect(blocked(integerNumericKeyDownHandler, ".", "")).toBe(true);
    expect(blocked(integerNumericKeyDownHandler, ".", "12")).toBe(true);
  });
});

describe("decimal handler", () => {
  test("allows one decimal point, on empty or whole-number fields", () => {
    expect(blocked(decimalNumericKeyDownHandler, ".", "")).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", "12")).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", "0")).toBe(false);
  });

  test("blocks a second decimal point wherever the first one is", () => {
    for (const value of ["12.5", "12.", ".5", "."]) {
      expect(blocked(decimalNumericKeyDownHandler, ".", value)).toBe(true);
    }
  });

  test("digits are still fine after the decimal point", () => {
    expect(blocked(decimalNumericKeyDownHandler, "5", "12.")).toBe(false);
  });

  test("a non-string field value is treated as text", () => {
    expect(blocked(decimalNumericKeyDownHandler, ".", 12)).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", null)).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", undefined)).toBe(false);
  });

  test("blocks other punctuation", () => {
    expect(blocked(decimalNumericKeyDownHandler, ",", "1")).toBe(true);
  });
});
