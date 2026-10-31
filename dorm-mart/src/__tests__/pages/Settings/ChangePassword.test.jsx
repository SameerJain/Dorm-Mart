import { act, fireEvent, render, screen } from "@testing-library/react";
import ChangePasswordPage from "../../../pages/Settings/ChangePassword";
import { csrfFetch } from "../../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const STRONG = "Newpass1!";

function fill(current, next, confirm) {
  fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("New Password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Re-enter New Password"), { target: { value: confirm } });
}

function rejectedWith(error) {
  return { ok: false, json: async () => ({ ok: false, error }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("an empty form shows a scroll-locking popup instead of a browser alert", async () => {
  render(<ChangePasswordPage />);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  const dialog = await screen.findByRole("dialog", { name: "Couldn't change password" });
  expect(dialog.textContent).toContain("Please fill in all password fields.");
  expect(document.body.style.position).toBe("fixed");
  expect(window.alert).not.toHaveBeenCalled();
  expect(csrfFetch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.body.style.position).toBe("");
});

test("mismatched new passwords are reported in the popup", async () => {
  render(<ChangePasswordPage />);
  fill("Oldpass1!", STRONG, "Newpass2!");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText(
    "The new password that was entered is different from the re-entry of the password.",
  )).toBeTruthy();
  expect(csrfFetch).not.toHaveBeenCalled();
});

test("a weak new password names the first rule it breaks", async () => {
  render(<ChangePasswordPage />);
  fill("Oldpass1!", "short", "short");
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("The new password must have at least 8 characters.")).toBeTruthy();
  expect(csrfFetch).not.toHaveBeenCalled();
});

test("the server's own error message is shown when it rejects the change", async () => {
  csrfFetch.mockResolvedValue(rejectedWith("Current password is incorrect"));
  render(<ChangePasswordPage />);
  fill("Oldpass1!", STRONG, STRONG);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  const dialog = await screen.findByRole("dialog", { name: "Couldn't change password" });
  expect(dialog.textContent).toContain("Current password is incorrect");
  expect(window.alert).not.toHaveBeenCalled();
});

test("a network failure is reported in the popup", async () => {
  csrfFetch.mockRejectedValue(new Error("offline"));
  render(<ChangePasswordPage />);
  fill("Oldpass1!", STRONG, STRONG);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText(
    "Network error while changing password. Please try again.",
  )).toBeTruthy();
});

test("Enter on the popup closes it without submitting again, and submits once it is closed", async () => {
  csrfFetch.mockResolvedValue(rejectedWith("Current password is incorrect"));
  render(<ChangePasswordPage />);
  fill("Oldpass1!", STRONG, STRONG);
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  await screen.findByRole("dialog", { name: "Couldn't change password" });
  expect(csrfFetch).toHaveBeenCalledTimes(1);

  // In a browser, Enter on the focused OK button fires keydown, then a click.
  const ok = screen.getByRole("button", { name: "OK" });
  expect(document.activeElement).toBe(ok);
  fireEvent.keyDown(ok, { key: "Enter" });
  fireEvent.click(ok);
  await act(async () => {});
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(csrfFetch).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(window, { key: "Enter" });
  await screen.findByRole("dialog", { name: "Couldn't change password" });
  expect(csrfFetch).toHaveBeenCalledTimes(2);
});
