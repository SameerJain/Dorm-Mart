import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SafetySummaryPage from "../../../pages/Legal/SafetySummaryPage";
import { apiGetJson } from "../../../utils/apiClient";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../../utils/apiClient", () => ({ apiGetJson: jest.fn() }));

const summary = {
  message_reports: { total: 12, open: 1, action_taken: 7, dismissed: 4 },
  listing_reports: {
    total: 5,
    open: 2,
    listings_removed: 2,
    dismissed: 1,
    top_reasons: [{ reason: "Scam or fraud", count: 3 }],
  },
  response_time: { window_days: 90, reports_handled: 14, avg_hours_to_decision: 5.2 },
  banned_accounts: 2,
  flagged_messages: 9,
  generated_at: "2026-09-27T12:00:00Z",
};

test("shows anonymous safety totals", async () => {
  apiGetJson.mockResolvedValue({ success: true, data: summary });
  render(<SafetySummaryPage />);

  expect(await screen.findByText("5 hours")).toBeInTheDocument();
  expect(screen.getByText("Scam or fraud: 3")).toBeInTheDocument();
  // Open reports from both queues are summed.
  expect(screen.getByText("Reports waiting for review").nextSibling).toHaveTextContent("3");
  expect(document.title).toBe("Safety at Dorm Mart");
});

test("explains when the numbers can't load", async () => {
  apiGetJson.mockRejectedValue(new Error("offline"));
  render(<SafetySummaryPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be loaded/i);
});
