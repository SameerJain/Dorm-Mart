import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import BrowserPushSettings from "../../../pages/Settings/BrowserPushSettings";
import { browserPushState, enableBrowserPush, disableBrowserPush } from "../../../utils/browserPush";
jest.mock("../../../utils/browserPush", () => ({ browserPushState: jest.fn(), enableBrowserPush: jest.fn(), disableBrowserPush: jest.fn() }));

const available = { supported: true, configured: true, enabled: false, publicKey: "public", permission: "default" };
beforeEach(() => jest.resetAllMocks());

test("permission is requested only after clicking Enable", async () => {
  browserPushState.mockResolvedValueOnce(available).mockResolvedValueOnce({ ...available, enabled: true });
  render(<BrowserPushSettings />);
  const enable = await screen.findByRole("button", { name: "Enable browser notifications" });
  expect(enableBrowserPush).not.toHaveBeenCalled();
  fireEvent.click(enable);
  expect(await screen.findByRole("button", { name: "Disable browser notifications" })).toBeInTheDocument();
  expect(enableBrowserPush).toHaveBeenCalledWith("public");
});

test("users can disable notifications on this browser", async () => {
  browserPushState.mockResolvedValueOnce({ ...available, enabled: true }).mockResolvedValueOnce(available);
  render(<BrowserPushSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Disable browser notifications" }));
  await waitFor(() => expect(disableBrowserPush).toHaveBeenCalledTimes(1));
  expect(await screen.findByRole("button", { name: "Enable browser notifications" })).toBeInTheDocument();
});

test("unsupported and blocked browsers get useful explanations", async () => {
  browserPushState.mockResolvedValueOnce({ supported: false });
  const first = render(<BrowserPushSettings />);
  expect(await screen.findByText(/supported browser and a secure connection/i)).toBeInTheDocument();
  first.unmount();
  browserPushState.mockResolvedValueOnce({ ...available, permission: "denied" });
  render(<BrowserPushSettings />);
  expect(await screen.findByRole("button", { name: "Enable browser notifications" })).toBeDisabled();
  expect(screen.getByText(/notifications are blocked/i)).toBeInTheDocument();
});

test("failed enable keeps the control available and explains the error", async () => {
  browserPushState.mockResolvedValue(available);
  enableBrowserPush.mockRejectedValue(new Error("Permission was not granted"));
  render(<BrowserPushSettings />);
  fireEvent.click(await screen.findByRole("button", { name: "Enable browser notifications" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Permission was not granted");
  expect(screen.getByRole("button", { name: "Enable browser notifications" })).toBeEnabled();
});

test("an unconfigured server never offers a broken permission prompt", async () => {
  browserPushState.mockResolvedValue({ ...available, configured: false });
  render(<BrowserPushSettings />);
  expect(await screen.findByText("Browser notifications are not available yet.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enable browser notifications" })).toBeNull();
  expect(enableBrowserPush).not.toHaveBeenCalled();
});
