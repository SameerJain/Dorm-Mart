import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

test("explains local addresses, searches history, and refreshes results", async () => {
  const devices = [
    {
      id: 1, device_type: "Desktop", browser: "Firefox", operating_system: "Linux",
      ip_address: "127.0.0.1", ip_scope: "local", location: null,
      logged_in_at: "2026-09-17T12:00:00Z", last_seen_at: "2026-09-17T12:05:00Z",
      is_current: true, signed_out_at: null,
    },
    {
      id: 2, device_type: "Mobile", browser: "Safari", operating_system: "iOS",
      ip_address: "8.8.8.8", ip_scope: "public", location: "Buffalo, New York, United States",
      logged_in_at: "2026-09-16T12:00:00Z", last_seen_at: "2026-09-16T12:05:00Z",
      is_current: false, signed_out_at: "2026-09-16T12:05:00Z",
    },
  ];
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ success: true, devices }),
  });
  render(<LoggedDevicesPage />);
  expect(await screen.findByText("Local device · no public location")).toBeTruthy();
  const search = screen.getByRole("searchbox", { name: "Search login history" });
  fireEvent.change(search, { target: { value: "buffalo" } });
  expect(screen.getByText("Safari on iOS")).toBeTruthy();
  expect(screen.queryByText("Firefox on Linux")).toBeNull();
  expect(screen.getByText("Showing 1 of 2 login sessions")).toBeTruthy();
  fireEvent.change(search, { target: { value: "no match" } });
  expect(screen.getByText("No logins match your search.")).toBeTruthy();
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("button", { name: "Refresh history" })).toBeTruthy();
});

test("keeps history usable when a public IP cannot be located", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, devices: [{
      id: 3, browser: "Chrome", operating_system: "Windows", device_type: "Desktop",
      ip_address: "8.8.8.8", ip_scope: "public", location: null,
      logged_in_at: "2026-09-17T12:00:00Z", last_seen_at: "2026-09-17T12:05:00Z",
    }] }),
  });
  render(<LoggedDevicesPage />);
  expect(await screen.findByText("City could not be determined from this IP")).toBeTruthy();
  expect(screen.getByText("8.8.8.8")).toBeTruthy();
});
