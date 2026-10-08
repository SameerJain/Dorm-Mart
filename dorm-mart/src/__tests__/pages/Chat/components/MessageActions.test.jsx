import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageActions from "../../../../pages/Chat/components/MessageActions";

// jsdom has no matchMedia, so the component treats this as a touch device and
// opens the bottom sheet (rather than the pointer-device menu).
const actions = [
  { key: "copy", label: "Copy text", icon: "copy", onSelect: jest.fn() },
  { key: "report", label: "Report message", icon: "report", danger: true, onSelect: jest.fn() },
];

beforeEach(() => jest.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test("the touch sheet blocks page scrolling while open and releases it on close", () => {
  render(
    <MessageActions actions={actions}>
      <p>hello</p>
    </MessageActions>,
  );

  fireEvent.contextMenu(screen.getByText("hello"));
  expect(screen.getByRole("menu", { name: "Message actions" })).toBeInTheDocument();
  expect(document.body.style.position).toBe("fixed");
  expect(document.documentElement.style.overflow).toBe("hidden");

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(document.body.style.position).toBe("");
  expect(document.documentElement.style.overflow).toBe("");
});

test("the sheet is capped to the viewport and scrolls on short screens", () => {
  render(
    <MessageActions actions={actions}>
      <p>hello</p>
    </MessageActions>,
  );
  fireEvent.contextMenu(screen.getByText("hello"));

  const sheet = screen.getByRole("menu", { name: "Message actions" });
  expect(sheet).toHaveClass("max-h-[85dvh]", "overflow-y-auto", "overscroll-contain");
});

test("right-click or long-press inside a dialog rendered in the message does not open the menu", () => {
  render(
    <MessageActions actions={actions}>
      <p>hello</p>
      <div role="dialog">
        <button type="button">Report</button>
      </div>
    </MessageActions>,
  );

  fireEvent.contextMenu(screen.getByRole("button", { name: "Report" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  expect(document.body.style.position).toBe("");

  jest.useFakeTimers();
  fireEvent.touchStart(screen.getByRole("button", { name: "Report" }), {
    touches: [{ clientX: 10, clientY: 10 }],
  });
  jest.advanceTimersByTime(1000);
  jest.useRealTimers();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
