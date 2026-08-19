import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserPreferences from "./UserPreferences";
import { csrfFetch } from "../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), {
  virtual: true,
});
jest.mock("./SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../components/PageBackButton", () => () => null);
jest.mock("../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    updateTheme: jest.fn(),
    syncFromServerIfNoPending: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const response = (body) => ({ ok: true, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn((url) =>
    url.includes("get_categories.php")
      ? Promise.resolve(response([]))
      : Promise.resolve(
          response({
            ok: true,
            data: {
              promoEmails: false,
              promoFrequency: "off",
              revealContact: true,
              contactPhone: "(716) 555-0123",
              interests: [],
              theme: "light",
            },
          }),
        ),
  );
  csrfFetch.mockResolvedValue(response({ ok: true }));
});

test("loads and persists the seller contact-sharing toggle", async () => {
  render(<UserPreferences />);

  const phoneInput = screen.getByLabelText("Phone number (optional)");
  await waitFor(() =>
    expect(phoneInput).toHaveProperty("value", "(716) 555-0123"),
  );
  const toggle = screen.getByRole("checkbox", {
    name: /share my UB email and phone number/i,
  });
  expect(toggle.checked).toBe(true);

  fireEvent.click(toggle);

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled(), { timeout: 1500 });
  const savedBody = JSON.parse(csrfFetch.mock.calls.at(-1)[1].body);
  expect(savedBody).toMatchObject({
    revealContact: false,
    contactPhone: "(716) 555-0123",
  });
});

test("shows backend validation failures instead of silently losing changes", async () => {
  csrfFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, error: "Invalid phone number" }),
  });
  render(<UserPreferences />);

  const phoneInput = screen.getByLabelText("Phone number (optional)");
  await waitFor(() =>
    expect(phoneInput).toHaveProperty("value", "(716) 555-0123"),
  );
  fireEvent.change(phoneInput, { target: { value: "+" } });

  expect(
    (await screen.findByRole("alert", {}, { timeout: 1500 })).textContent,
  ).toContain("Invalid phone number");
});
