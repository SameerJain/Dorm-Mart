import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ElectronicPaymentModal from "../../../../pages/Chat/components/ElectronicPaymentModal";
import { csrfPostJson } from "../../../../utils/apiClient";

jest.mock("../../../../utils/apiClient", () => ({ csrfPostJson: jest.fn() }));
jest.mock("@stripe/stripe-js", () => ({ loadStripe: jest.fn() }));
jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }) => children,
  PaymentElement: () => <div data-testid="stripe-card-form" />,
  useElements: () => ({}),
  useStripe: () => ({}),
}));

beforeEach(() => jest.clearAllMocks());

test("demo checkout clearly labels the transaction and never loads Stripe", async () => {
  const { loadStripe } = require("@stripe/stripe-js");
  const onStatusChange = jest.fn();
  csrfPostJson.mockResolvedValueOnce({ data: { is_mock: true, amount_cents: 2750, scheduled_request_id: 7 } });
  csrfPostJson.mockResolvedValueOnce({ data: { completed: true, is_mock: true } });
  render(<ElectronicPaymentModal scheduledRequestId={7} onClose={jest.fn()} onStatusChange={onStatusChange} />);
  const complete = await screen.findByRole("button", { name: "Complete mock transaction" });
  expect(screen.getByText(/no real money/i)).toBeInTheDocument();
  expect(screen.queryByTestId("stripe-card-form")).toBeNull();
  expect(loadStripe).not.toHaveBeenCalled();
  fireEvent.click(complete);
  await waitFor(() => expect(onStatusChange).toHaveBeenCalledTimes(1));
  expect(csrfPostJson.mock.calls[1][0]).toMatch(/payments\/mock_confirm.php$/);
  expect(csrfPostJson.mock.calls[1][1]).toEqual({ scheduled_request_id: 7 });
  expect(await screen.findByText(/mock transaction completed/i)).toBeInTheDocument();
  expect(loadStripe).not.toHaveBeenCalled();
});

test("a failed mock payment keeps the error visible and allows retry", async () => {
  csrfPostJson.mockResolvedValueOnce({ data: { is_mock: true, amount_cents: 500, scheduled_request_id: 7 } });
  csrfPostJson.mockRejectedValueOnce(new Error("The Payment Window is not open"));
  render(<ElectronicPaymentModal scheduledRequestId={7} onClose={jest.fn()} onStatusChange={jest.fn()} />);
  fireEvent.click(await screen.findByRole("button", { name: "Complete mock transaction" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("The Payment Window is not open");
  expect(screen.getByRole("button", { name: "Complete mock transaction" })).toBeEnabled();
});
