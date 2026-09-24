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

// Saves are debounced 400ms; leave headroom for a loaded CI runner (the full
// suite runs in band and this file timed out at 1.5s under that load).
const SAVE_WAIT_MS = 4000;
jest.setTimeout(15000);

// The page auto-saves (debounced) whenever values change, including once right
// after the initial load, so wait for the save that carries the expected fields
// rather than whichever call happens to be last.
const savedBodies = () => csrfFetch.mock.calls.map((call) => JSON.parse(call[1].body));
const waitForSave = (expected) =>
  waitFor(
    () => expect(savedBodies()).toContainEqual(expect.objectContaining(expected)),
    { timeout: SAVE_WAIT_MS },
  );

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

  const phoneInput = await screen.findByLabelText("Phone number (optional)");
  await waitFor(() => expect(phoneInput.value).toBe("(716) 555-0123"));
  const toggle = await screen.findByRole("checkbox", {
    name: /share my email and phone number/i,
  });
  expect(toggle.checked).toBe(true);

  fireEvent.click(toggle);

  await waitForSave({ revealContact: false, contactPhone: "(716) 555-0123" });
});

test("edits and persists the phone number field", async () => {
  render(<UserPreferences />);

  const phoneInput = await screen.findByLabelText("Phone number (optional)");
  fireEvent.change(phoneInput, { target: { value: "716-555-9999" } });

  await waitForSave({ contactPhone: "716-555-9999" });
});

test("shows backend validation failures instead of silently losing changes", async () => {
  csrfFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, error: "Unable to save preferences" }),
  });
  render(<UserPreferences />);

  const toggle = await screen.findByRole("checkbox", {
    name: /share my email and phone number/i,
  });
  fireEvent.click(toggle);

  expect(
    (await screen.findByRole("alert", {}, { timeout: SAVE_WAIT_MS })).textContent,
  ).toContain("Unable to save preferences");
});

test.each(["off", "daily", "weekly"])("persists the %s promotional email frequency", async (frequency) => {
  render(<UserPreferences />);

  await waitFor(() => expect(screen.getByRole("checkbox").checked).toBe(true));
  fireEvent.change(screen.getByLabelText("Promotional email frequency"), {
    target: { value: frequency },
  });

  await waitForSave({ promoFrequency: frequency, promoEmails: frequency !== "off" });
});
