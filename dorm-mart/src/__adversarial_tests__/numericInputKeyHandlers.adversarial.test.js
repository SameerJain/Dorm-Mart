import {
  decimalNumericKeyDownHandler,
  integerNumericKeyDownHandler,
} from "../utils/numericInputKeyHandlers";

function keyEvent(key, value = "", overrides = {}) {
  return {
    key,
    currentTarget: { value },
    preventDefault: jest.fn(),
    ...overrides,
  };
}

describe("numeric input key guards", () => {
  test("integer guard allows navigation, shortcuts, and digits while blocking signs/exponents", () => {
    const arrow = keyEvent("ArrowLeft");
    const shortcut = keyEvent("a", "", { ctrlKey: true });
    const digit = keyEvent("7");
    const exponent = keyEvent("e");
    const sign = keyEvent("-");

    integerNumericKeyDownHandler(arrow);
    integerNumericKeyDownHandler(shortcut);
    integerNumericKeyDownHandler(digit);
    integerNumericKeyDownHandler(exponent);
    integerNumericKeyDownHandler(sign);

    expect(arrow.preventDefault).not.toHaveBeenCalled();
    expect(shortcut.preventDefault).not.toHaveBeenCalled();
    expect(digit.preventDefault).not.toHaveBeenCalled();
    expect(exponent.preventDefault).toHaveBeenCalledTimes(1);
    expect(sign.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("decimal guard allows one decimal separator and blocks a second", () => {
    const firstDecimal = keyEvent(".", "12");
    const secondDecimal = keyEvent(".", "12.3");
    const processKey = keyEvent("Process");

    decimalNumericKeyDownHandler(firstDecimal);
    decimalNumericKeyDownHandler(secondDecimal);
    decimalNumericKeyDownHandler(processKey);

    expect(firstDecimal.preventDefault).not.toHaveBeenCalled();
    expect(secondDecimal.preventDefault).toHaveBeenCalledTimes(1);
    expect(processKey.preventDefault).not.toHaveBeenCalled();
  });
});
