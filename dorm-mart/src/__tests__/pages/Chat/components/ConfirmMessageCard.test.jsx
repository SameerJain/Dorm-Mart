import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ConfirmMessageCard from "../../../../pages/Chat/components/ConfirmMessageCard";

test.each([
  ["confirm_request", "pending", true, "Marked Successful", "Action required"],
  ["confirm_request", "pending", false, "Marked Unsuccessful", "Action required"],
  ["confirm_request", "buyer_accepted", true, "Marked Successful", "Response sent"],
  ["confirm_request", "auto_accepted", false, "Marked Unsuccessful", "Response sent"],
  ["confirm_request", "buyer_declined", true, "Buyer Denied", "Response sent"],
  ["confirm_request", "seller_cancelled", true, "Cancelled", "Cancelled"],
  ["confirm_accepted", undefined, true, "Marked Successful", "Buyer accepted"],
  ["confirm_auto_accepted", undefined, false, "Marked Unsuccessful", "Auto accepted"],
  ["confirm_denied", undefined, true, "Buyer Denied", "Buyer denied"],
  ["unknown", undefined, true, "Marked Successful", "Update"],
])("renders %s with status %s and success %s", (type, status, successful, title, label) => {
  render(<ConfirmMessageCard message={{ metadata: {
    type,
    confirm_request_id: 9,
    confirm_purchase_status: status,
    is_successful: successful,
  } }} isMine={false} />);

  expect(screen.getByText(`Confirm Purchase: ${title}`)).toBeInTheDocument();
  expect(screen.getByText(label)).toBeInTheDocument();
});

test("keeps an unanswered request actionable when a response timestamp has no status", () => {
  render(<ConfirmMessageCard message={{ metadata: {
    type: "confirm_request",
    confirm_request_id: 9,
    buyer_response_at: "2026-10-26T12:00:00Z",
  } }} isMine={false} />);

  expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
});
