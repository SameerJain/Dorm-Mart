import { fireEvent, render, screen } from "@testing-library/react";
import CancelPurchaseModal from "../../../pages/ScheduledPurchases/components/CancelPurchaseModal";
import CloseFormModal from "../../../pages/ScheduledPurchases/components/CloseFormModal";

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function renderCancel(props = {}) {
  const handlers = { onClose: jest.fn(), onConfirm: jest.fn() };
  render(
    <CancelPurchaseModal
      actionError=""
      busyRequestId={null}
      pendingCancelRequestId={7}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

test("the cancel-purchase popup is a labelled dialog that locks page scroll", () => {
  renderCancel();
  const dialog = screen.getByRole("dialog", { name: "Cancel Scheduled Purchase?" });
  expect(dialog.textContent).toContain("This action cannot be undone.");
  expect(document.body.style.position).toBe("fixed");
});

test("its buttons keep their labels, and Escape keeps the purchase", () => {
  const { onClose, onConfirm } = renderCancel();
  fireEvent.click(screen.getByRole("button", { name: "Yes, Cancel" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "No, Keep It" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("while the cancellation runs, it cannot be dismissed or sent twice", () => {
  const { onClose } = renderCancel({ busyRequestId: 7 });
  expect(screen.getByRole("button", { name: "Cancelling..." }).disabled).toBe(true);
  expect(screen.getByRole("button", { name: "No, Keep It" }).disabled).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("dialog").parentElement);
  expect(onClose).not.toHaveBeenCalled();
});

test("a failed cancellation shows its error inside the popup", () => {
  renderCancel({ actionError: "Purchase already completed" });
  expect(screen.getByRole("alert").textContent).toBe("Purchase already completed");
});

test("the close-form popup asks before discarding the form", () => {
  const onClose = jest.fn();
  const onConfirm = jest.fn();
  render(<CloseFormModal onClose={onClose} onConfirm={onConfirm} />);
  expect(screen.getByRole("dialog", { name: "Close This Form?" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});
