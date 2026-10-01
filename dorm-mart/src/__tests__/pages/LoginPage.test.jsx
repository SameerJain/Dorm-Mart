import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "../../pages/LoginPage";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
jest.mock("../../hooks/useEmailPolicy", () => ({
  useEmailPolicy: () => ({ allowAllEmails: true, emailPolicyLoading: false }),
}));

test("does not replace the email field value with pasted text", () => {
  render(<LoginPage />);

  const emailInput = screen.getByRole("textbox");
  fireEvent.change(emailInput, { target: { value: "sameer" } });

  fireEvent.paste(emailInput, {
    clipboardData: { getData: () => "@buffalo.edu" },
  });

  expect(emailInput).toHaveProperty("value", "sameer");
});

test("labels the sign-in fields for assistive technology", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText("University Email Address")).toHaveProperty("type", "email");
  expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
});

test("lets the user leave the verification-code step", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, requires_two_factor: true, email: "s***@buffalo.edu" }),
  });
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText("University Email Address"), {
    target: { value: "sameer@buffalo.edu" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Login" }));

  expect(await screen.findByLabelText("Verification code")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /sign in again or use a different account/i }));

  expect(screen.getByLabelText("University Email Address")).toBeTruthy();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  global.fetch.mockRestore();
});
