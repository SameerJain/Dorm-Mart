import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import MessageActions from "../../../../pages/Chat/components/MessageActions";

// jsdom has no matchMedia, so the component treats this as a touch device and
// opens the bottom sheet (rather than the pointer-device menu).
const actions = [
  { key: "edit", label: "Edit message", icon: "edit", onSelect: jest.fn() },
  { key: "report", label: "Report message", icon: "report", danger: true, onSelect: jest.fn() },
];

beforeEach(() => jest.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

test("the touch sheet opens on right-click and closes on Cancel", () => {
  render(
    <MessageActions actions={actions}>
      <p>hello</p>
    </MessageActions>,
  );

  fireEvent.contextMenu(screen.getByText("hello"));
  expect(screen.getByRole("menu", { name: "Message actions" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
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

  jest.useFakeTimers();
  fireEvent.touchStart(screen.getByRole("button", { name: "Report" }), {
    touches: [{ clientX: 10, clientY: 10 }],
  });
  jest.advanceTimersByTime(1000);
  jest.useRealTimers();
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
