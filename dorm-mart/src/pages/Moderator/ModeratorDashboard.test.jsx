import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorDashboard from "./ModeratorDashboard.jsx";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../../utils/csrfFetch.js", () => ({ csrfFetch: jest.fn() }));
// eslint-disable-next-line import/first
import { csrfFetch } from "../../utils/csrfFetch.js";

describe("ModeratorDashboard", () => {
  afterEach(() => jest.restoreAllMocks());

  test("shows moderation stats and uncensored flagged content", async () => {
    jest.spyOn(global, "fetch").mockImplementation((url) => {
      const body = String(url).includes("profanity_words")
        ? { success: true, words: ["blockedword"] }
        : {
            success: true,
            stats: { flagged_messages: 1, open_reports: 0, total_reports: 0, banned_users: 0 },
            reports: [],
            flagged_messages: [{
              message_id: 9,
              conv_id: 4,
              sender_id: 2,
              sender_fname: "Test User",
              sender_email: "test@buffalo.edu",
              sender_role: "user",
              sender_is_banned: 0,
              content: "raw blockedword message",
              created_at: "2026-08-14T12:00:00Z",
            }],
          };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });

    render(<ModeratorDashboard />);

    expect(await screen.findByText("raw blockedword message")).toBeInTheDocument();
    expect(screen.getByText("Flagged messages").nextSibling).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toBeInTheDocument();
  });

  test("removes a reported listing with the moderator's chosen reason and note", async () => {
    jest.spyOn(global, "fetch").mockImplementation((url) => {
      const body = String(url).includes("profanity_words")
        ? { success: true, words: [] }
        : {
            success: true,
            stats: { flagged_messages: 0, open_reports: 0, total_reports: 0, banned_users: 0, open_listing_reports: 2 },
            reports: [],
            flagged_messages: [],
            listing_reports: [{
              report_id: 5,
              product_id: 12,
              seller_id: 3,
              listing_title: "Mini fridge",
              reason: "scam",
              details: "Asked me to pay outside the app",
              status: "open",
              created_at: "2026-09-20T12:00:00Z",
              item_status: "Active",
              listing_price: 40,
              open_reports_for_listing: 2,
              seller_name: "Sam Seller",
              seller_role: "user",
              seller_is_banned: 0,
              reporter_name: "Rita Reporter",
            }],
          };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });
    csrfFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
    jest.spyOn(window, "confirm").mockReturnValue(true);

    render(<ModeratorDashboard />);

    expect(await screen.findByRole("link", { name: "Mini fridge" })).toHaveAttribute("href", "/app/viewProduct/12");
    expect(screen.getByText("Asked me to pay outside the app")).toBeInTheDocument();
    expect(screen.getByText("+1 other open report")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason shown to seller"), { target: { value: "prohibited" } });
    fireEvent.change(screen.getByPlaceholderText("Optional note to the seller"), { target: { value: "  No weapons  " } });
    fireEvent.click(screen.getByRole("button", { name: "Remove listing" }));

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toContain("/moderation/resolve_listing_report.php");
    expect(JSON.parse(options.body)).toEqual({
      report_id: 5,
      action: "remove",
      removal_reason: "prohibited",
      note: "No weapons",
    });
  });
});
