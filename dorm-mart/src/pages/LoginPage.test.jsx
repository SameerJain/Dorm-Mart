import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "./LoginPage";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
jest.mock("../hooks/useEmailPolicy", () => ({
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
