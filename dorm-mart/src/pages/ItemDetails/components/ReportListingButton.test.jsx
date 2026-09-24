import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReportListingButton from "./ReportListingButton";
import { csrfPostJson } from "../../../utils/apiClient";

jest.mock("../../../utils/apiClient", () => ({ csrfPostJson: jest.fn() }));

afterEach(() => jest.clearAllMocks());

function openDialog() {
  render(<ReportListingButton productId={12} title="Mini fridge" />);
  fireEvent.click(screen.getByRole("button", { name: "Report this listing" }));
  return screen.getByRole("dialog");
}

test("submits a preset reason with optional details", async () => {
  csrfPostJson.mockResolvedValue({ success: true, report_id: 1 });
  openDialog();

  const submit = screen.getByRole("button", { name: "Submit report" });
  expect(submit).toBeDisabled();

  fireEvent.click(screen.getByLabelText("Scam or fraud"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Wants Venmo up front  " } });
  fireEvent.click(submit);

  expect(await screen.findByText("Thanks for letting us know")).toBeInTheDocument();
  expect(csrfPostJson).toHaveBeenCalledWith(
    expect.stringContaining("/moderation/report_listing.php"),
    { product_id: 12, reason: "scam", details: "Wants Venmo up front" },
  );
});

test("'Something else' requires a description", () => {
  openDialog();
  fireEvent.click(screen.getByLabelText("Something else"));
  expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Selling a lease, not an item" } });
  expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
});

test("shows the server's error and keeps the form open", async () => {
  csrfPostJson.mockRejectedValue(new Error("You cannot report your own listing"));
  openDialog();
  fireEvent.click(screen.getByLabelText("Spam or duplicate listing"));
  fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("You cannot report your own listing");
  expect(screen.getByRole("button", { name: "Submit report" })).toBeInTheDocument();
});
