import { useRef, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useModalFocus } from "../../hooks/useModalFocus";

function Modal({ onClose, dismissible, focusSecond = false, empty = false }) {
  const panelRef = useRef(null);
  const secondRef = useRef(null);
  useModalFocus(panelRef, { onClose, dismissible, initialFocusRef: focusSecond ? secondRef : undefined });
  return (
    <div ref={panelRef} role="dialog" aria-label="Test dialog" tabIndex={-1}>
      {!empty && (
        <>
          <button type="button">First</button>
          <button type="button" ref={secondRef}>Second</button>
          <button type="button" disabled>Disabled</button>
          <button type="button">Last</button>
        </>
      )}
    </div>
  );
}

function Page(props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Outside</button>
      {open && <Modal {...props} onClose={props.onClose === undefined ? () => setOpen(false) : props.onClose} />}
    </>
  );
}

function open(props) {
  render(<Page {...props} />);
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

test("opening moves focus to the first control in the dialog", () => {
  open();
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
});

test("a requested starting control takes focus instead of the first one", () => {
  open({ focusSecond: true });
  expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
});

test("a dialog with nothing to focus takes focus itself and swallows Tab", () => {
  open({ empty: true });
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveFocus();
  expect(fireEvent.keyDown(dialog, { key: "Tab" })).toBe(false);
});

test("Tab from the last control wraps to the first, skipping disabled controls", () => {
  open();
  const last = screen.getByRole("button", { name: "Last" });
  last.focus();
  expect(fireEvent.keyDown(last, { key: "Tab" })).toBe(false);
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
});

test("Shift+Tab from the first control wraps to the last", () => {
  open();
  const first = screen.getByRole("button", { name: "First" });
  expect(fireEvent.keyDown(first, { key: "Tab", shiftKey: true })).toBe(false);
  expect(screen.getByRole("button", { name: "Last" })).toHaveFocus();
});

test("Tab in the middle of the dialog is left to the browser", () => {
  open({ focusSecond: true });
  expect(fireEvent.keyDown(screen.getByRole("button", { name: "Second" }), { key: "Tab" })).toBe(true);
});

test("Escape closes the dialog and returns focus to the control that opened it", () => {
  const opener = open();
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

test("Escape is ignored while the dialog is not dismissible", () => {
  const onClose = jest.fn();
  open({ onClose, dismissible: false });
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("without onClose the hook leaves Escape to the dialog's own handler", () => {
  const outer = jest.fn();
  document.addEventListener("keydown", outer);
  open({ onClose: null });
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(outer).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  document.removeEventListener("keydown", outer);
});

test("Escape handled by the hook does not reach other key handlers", () => {
  const outer = jest.fn();
  document.addEventListener("keydown", outer);
  open();
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(outer).not.toHaveBeenCalled();
  document.removeEventListener("keydown", outer);
});
