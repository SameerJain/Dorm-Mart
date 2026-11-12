import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaymentsPage from "../../../pages/Settings/PaymentsPage";
import { apiGetJson, csrfPostJson } from "../../../utils/apiClient";

jest.mock("../../../utils/apiClient", () => ({ apiGetJson: jest.fn(), csrfPostJson: jest.fn() }));
jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);

const stripeAccount = {
  feature_enabled: true, payment_mode: "live", is_test_mode: false, connected: false,
  details_submitted: false, charges_enabled: false, payouts_enabled: false, ready: false,
  dashboard_url: "https://dashboard.stripe.com/",
};

beforeEach(() => jest.resetAllMocks());

test("demo mode says no money moves and offers no Stripe controls", async () => {
  apiGetJson.mockResolvedValueOnce({ data: { feature_enabled: true, payment_mode: "mock", is_mock: true, connected: false, ready: true } });
  render(<PaymentsPage />);
  expect(await screen.findByText("Demo transactions are ready")).toBeInTheDocument();
  expect(screen.getByText(/Payments are in demo mode.*no real money is charged or transferred/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Connect Stripe" })).not.toBeInTheDocument();
  expect(screen.queryByText("Before you connect")).not.toBeInTheDocument();
  expect(apiGetJson.mock.calls[0][0]).toMatch(/payments\/account_status\.php$/);
});

test("with payments switched off the page explains manual confirmation still works", async () => {
  apiGetJson.mockResolvedValueOnce({ data: { ...stripeAccount, feature_enabled: false, payment_mode: null } });
  render(<PaymentsPage />);
  expect(await screen.findByText(/Real payments are not available on this installation yet/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Connect Stripe" })).not.toBeInTheDocument();
  expect(screen.queryByText("Demo transactions are ready")).not.toBeInTheDocument();
});

test("an unconnected real account can start Stripe onboarding", async () => {
  apiGetJson.mockResolvedValueOnce({ data: stripeAccount });
  csrfPostJson.mockResolvedValueOnce({ data: { url: null } });
  render(<PaymentsPage />);
  expect(await screen.findByText("Not connected")).toBeInTheDocument();
  expect(screen.getByText("Before you connect")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Connect Stripe" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Stripe did not return an onboarding link.");
  expect(csrfPostJson.mock.calls[0][0]).toMatch(/payments\/onboard\.php$/);
  expect(screen.getByRole("button", { name: "Connect Stripe" })).toBeEnabled();
});

test("a ready account shows its status and can disconnect only after confirming", async () => {
  const ready = { ...stripeAccount, connected: true, details_submitted: true, charges_enabled: true, payouts_enabled: true, ready: true };
  apiGetJson.mockResolvedValueOnce({ data: ready }).mockResolvedValueOnce({ data: stripeAccount });
  csrfPostJson.mockResolvedValueOnce({ success: true });
  const confirm = jest.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<PaymentsPage />);
  expect(await screen.findByText("Ready to accept payments")).toBeInTheDocument();
  expect(screen.getAllByText("Ready")).toHaveLength(3);
  expect(screen.queryByRole("button", { name: "Connect Stripe" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Stripe Dashboard" })).toHaveAttribute("href", "https://dashboard.stripe.com/");

  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  expect(csrfPostJson).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
  await waitFor(() => expect(csrfPostJson.mock.calls[0][0]).toMatch(/payments\/disconnect\.php$/));
  expect(await screen.findByText("Not connected")).toBeInTheDocument();
  confirm.mockRestore();
});

test("onboarding in progress offers to continue setup and marks test mode", async () => {
  apiGetJson.mockResolvedValueOnce({ data: { ...stripeAccount, payment_mode: "test", is_test_mode: true, connected: true, details_submitted: true } });
  render(<PaymentsPage />);
  expect(await screen.findByText("Onboarding incomplete")).toBeInTheDocument();
  expect(screen.getByText("Test Mode")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue Stripe Setup" })).toBeInTheDocument();
  expect(screen.getAllByText("Required")).toHaveLength(2);
});

test("a failed load shows the error instead of payment controls", async () => {
  apiGetJson.mockRejectedValueOnce(new Error("Unable to load payment settings"));
  render(<PaymentsPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load payment settings");
  expect(screen.queryByRole("button", { name: "Connect Stripe" })).not.toBeInTheDocument();
});
