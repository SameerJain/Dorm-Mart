import { act, fireEvent, render, screen } from "@testing-library/react";
import SubmitConfirmationDialog from "../../components/SubmitConfirmationDialog";

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("renders nothing while closed", () => {
  render(<SubmitConfirmationDialog isOpen={false} message="Submit?" onCancel={() => {}} />);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("opens as a labelled dialog with the message", () => {
  render(<SubmitConfirmationDialog isOpen message="Post this review?" onCancel={() => {}} />);
  const dialog = screen.getByRole("dialog", { name: "Ready to Submit?" });
  expect(dialog.textContent).toContain("Post this review?");
});

test("Confirm runs the submit, and a failed submit closes the dialog", async () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn().mockRejectedValue(new Error("server error"));
  render(<SubmitConfirmationDialog isOpen message="Submit?" onCancel={onCancel} onConfirm={onConfirm} />);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  });
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test("Escape cancels", () => {
  const onCancel = jest.fn();
  render(<SubmitConfirmationDialog isOpen message="Submit?" onCancel={onCancel} onConfirm={jest.fn()} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledTimes(1);
});
