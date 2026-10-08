import { renderHook } from "@testing-library/react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

let scrollTo;

beforeEach(() => {
  scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  Object.defineProperty(window, "scrollY", { configurable: true, value: 420 });
});

afterEach(() => {
  jest.restoreAllMocks();
  delete window.scrollY;
});

test("fixes the page in place while locked and puts it back on unlock", () => {
  const { rerender } = renderHook(({ locked }) => useBodyScrollLock(locked), {
    initialProps: { locked: true },
  });

  expect(document.documentElement.style.overflow).toBe("hidden");
  expect(document.body.style.overflow).toBe("hidden");
  expect(document.body.style.position).toBe("fixed");
  expect(document.body.style.top).toBe("-420px");

  rerender({ locked: false });

  expect(document.documentElement.style.overflow).toBe("");
  expect(document.body.style.overflow).toBe("");
  expect(document.body.style.position).toBe("");
  expect(document.body.style.top).toBe("");
  expect(scrollTo).toHaveBeenCalledWith(0, 420);
});

test("does nothing while unlocked", () => {
  renderHook(() => useBodyScrollLock(false));
  expect(document.body.style.position).toBe("");
  expect(scrollTo).not.toHaveBeenCalled();
});

test("stacked locks keep the original scroll position until the last one releases", () => {
  const outer = renderHook(() => useBodyScrollLock(true));
  // Once the body is fixed the window reports scrollY 0, as a real browser does.
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  const inner = renderHook(() => useBodyScrollLock(true));

  expect(document.body.style.top).toBe("-420px");

  inner.unmount();
  expect(document.body.style.position).toBe("fixed");
  expect(scrollTo).not.toHaveBeenCalled();

  outer.unmount();
  expect(document.body.style.position).toBe("");
  expect(document.body.style.top).toBe("");
  expect(scrollTo).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith(0, 420);
});

test("restores whatever inline styles the page had before the lock", () => {
  document.body.style.overflow = "scroll";
  document.documentElement.style.overflow = "auto";

  const { unmount } = renderHook(() => useBodyScrollLock(true));
  unmount();

  expect(document.body.style.overflow).toBe("scroll");
  expect(document.documentElement.style.overflow).toBe("auto");

  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
});
