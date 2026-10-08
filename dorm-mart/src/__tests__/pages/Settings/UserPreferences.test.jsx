import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserPreferences from "../../../pages/Settings/UserPreferences";
import { csrfFetch } from "../../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), {
  virtual: true,
});
jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../../components/PageBackButton", () => () => null);
jest.mock("../../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    updateTheme: jest.fn(),
    syncFromServerIfNoPending: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock("../../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const response = (body) => ({
  ok: true,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

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

const mockLoadedPreferences = (overrides = {}) => {
  global.fetch = jest.fn((url) =>
    url.includes("get_categories.php")
      ? Promise.resolve(response([]))
      : Promise.resolve(
          response({
            ok: true,
            data: {
              promoEmails: false,
              promoFrequency: "off",
              interests: [],
              theme: "light",
              ...overrides,
            },
          }),
        ),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadedPreferences();
  csrfFetch.mockResolvedValue(response({ ok: true }));
});

test("shows backend validation failures instead of silently losing changes", async () => {
  csrfFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, error: "Unable to save preferences" }),
  });
  mockLoadedPreferences({ promoFrequency: "weekly", promoEmails: true });
  render(<UserPreferences />);

  const frequency = await screen.findByLabelText("Promotional email frequency");
  await waitFor(() => expect(frequency.value).toBe("weekly"));
  fireEvent.change(frequency, { target: { value: "daily" } });

  expect(
    (await screen.findByRole("alert", {}, { timeout: SAVE_WAIT_MS })).textContent,
  ).toContain("Unable to save preferences");
});

// Autosave sends only fields that differ from what loaded, so each case starts
// from a different frequency than the one it selects.
test.each([
  ["off", "weekly"],
  ["daily", "off"],
  ["weekly", "off"],
])("persists the %s promotional email frequency", async (frequency, loadedFrequency) => {
  mockLoadedPreferences({
    promoFrequency: loadedFrequency,
    promoEmails: loadedFrequency !== "off",
  });
  render(<UserPreferences />);

  const select = screen.getByLabelText("Promotional email frequency");
  await waitFor(() => expect(select.value).toBe(loadedFrequency));
  fireEvent.change(select, {
    target: { value: frequency },
  });

  await waitForSave({ promoFrequency: frequency, promoEmails: frequency !== "off" });
});
