import { render, screen } from "@testing-library/react";
import LoggedDevicesPage from "./LoggedDevicesPage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("./SettingsLayout", () => ({ children }) => <div>{children}</div>);

test("shows device, location, and current-session details", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      devices: [
        {
          id: 7,
          device_type: "Desktop",
          browser: "Microsoft Edge",
          operating_system: "Windows",
          ip_address: "203.0.113.10",
          location: "Buffalo, NY, US",
          logged_in_at: "2026-08-14 13:05:00",
          last_seen_at: "2026-08-14 13:10:00",
          signed_out_at: null,
          is_current: true,
        },
      ],
    }),
  });

  render(<LoggedDevicesPage />);

  expect(await screen.findByText("Microsoft Edge on Windows")).toBeTruthy();
  expect(screen.getByText("Buffalo, NY, US")).toBeTruthy();
  expect(screen.getByText("203.0.113.10")).toBeTruthy();
  expect(screen.getByText("Current device")).toBeTruthy();
});
