import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorDashboard from "./ModeratorDashboard.jsx";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../../utils/csrfFetch.js", () => ({ csrfFetch: jest.fn() }));

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
});
