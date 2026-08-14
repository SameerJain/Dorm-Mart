import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TwoFactorAuthentication from "./TwoFactorAuthentication";
import { csrfFetch } from "../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("./SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("enables email two-factor authentication and updates the button", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ ok: true, enabled: false, email: "te****@buffalo.edu" }),
  );
  csrfFetch.mockResolvedValue(
    jsonResponse({
      ok: true,
      enabled: true,
      message: "Two-Factor Authentication Enabled Successfully.",
    }),
  );

  render(<TwoFactorAuthentication />);
  await screen.findByText("Verification codes will be sent to te****@buffalo.edu.");
  fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("Two-Factor Authentication Enabled Successfully.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Disable 2FA" })).toBeTruthy();
  expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/two_factor.php"),
    expect.objectContaining({ body: JSON.stringify({ action: "enable", password: "" }) }),
  );
});

test("requires the current password when disabling two-factor authentication", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ ok: true, enabled: true, email: "te****@buffalo.edu" }),
  );
  csrfFetch.mockResolvedValue(
    jsonResponse({
      ok: true,
      enabled: false,
      message: "Two-Factor Authentication Disabled Successfully.",
    }),
  );

  render(<TwoFactorAuthentication />);
  fireEvent.click(await screen.findByRole("button", { name: "Disable 2FA" }));
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "1234!" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
  expect(await screen.findByText("Two-Factor Authentication Disabled Successfully.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enable 2FA" })).toBeTruthy();
});
