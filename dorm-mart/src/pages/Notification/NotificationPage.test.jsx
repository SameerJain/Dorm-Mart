import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotificationPage, {
  formatNotificationTime,
  isSafeNotificationDestination,
} from "./NotificationPage";
import { ChatContext } from "../../context/ChatContext";
import { csrfFetch } from "../../utils/csrfFetch";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

test("only allows internal app notification destinations", () => {
  expect(isSafeNotificationDestination("/app/viewProduct/4")).toBe(true);
  expect(isSafeNotificationDestination("https://evil.example/phish")).toBe(false);
  expect(isSafeNotificationDestination("//evil.example/phish")).toBe(false);
  expect(isSafeNotificationDestination("javascript:alert(1)")).toBe(false);
});

test("marks an unread notification as read before opening it", async () => {
  const markNotificationReadLocal = jest.fn();
  csrfFetch.mockResolvedValue({ ok: true });

  render(
    <ChatContext.Provider value={{
      unreadNotificationsByProduct: [{
        notification_id: 12,
        title: "Price reduced",
        message: "A saved item is cheaper.",
        destination: "/app/viewProduct/4",
        severity: "success",
        is_read: false,
        created_at: "2026-08-14T12:00:00Z",
      }],
      markNotificationReadLocal,
    }}>
      <NotificationPage />
    </ChatContext.Provider>,
  );

  fireEvent.click(screen.getByRole("button", { name: /^price reduced/i }));

  await waitFor(() => expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("mark_item_read.php"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ notification_id: 12 }),
    }),
  ));
  expect(markNotificationReadLocal).toHaveBeenCalledWith(12);
  expect(mockNavigate).toHaveBeenCalledWith("/app/viewProduct/4");
});

function renderWith(value) {
  return render(
    <ChatContext.Provider value={value}>
      <NotificationPage />
    </ChatContext.Provider>,
  );
}

const soldNotice = {
  notification_id: 30,
  title: "Desk lamp sold",
  message: "An item on your wishlist sold.",
  destination: null,
  severity: "info",
  is_read: false,
  created_at: "2026-08-14T12:00:00Z",
};

test("a notification without a link can still be marked read", async () => {
  csrfFetch.mockReset();
  mockNavigate.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const markNotificationReadLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], markNotificationReadLocal });

  fireEvent.click(screen.getByRole("button", { name: /^desk lamp sold/i }));

  await waitFor(() => expect(markNotificationReadLocal).toHaveBeenCalledWith(30));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("mark all read calls the endpoint and updates local state", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const markAllNotificationsReadLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], markAllNotificationsReadLocal });

  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

  await waitFor(() => expect(markAllNotificationsReadLocal).toHaveBeenCalled());
  expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("mark_all_items_read.php"),
    expect.objectContaining({ method: "POST" }),
  );
});

test("clear all asks for confirmation first", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const clearNotificationsLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], clearNotificationsLocal });

  fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
  expect(csrfFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(clearNotificationsLocal).toHaveBeenCalled());
});

test("a failed delete shows an inline error instead of an alert", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: false, status: 500 });
  renderWith({ unreadNotificationsByProduct: [soldNotice], removeNotificationLocal: jest.fn() });

  fireEvent.click(screen.getByRole("button", { name: /delete notification: desk lamp sold/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t delete/i);
});

test("shows a loading state instead of the empty state before the first fetch", () => {
  renderWith({ unreadNotificationsByProduct: [], notificationsStatus: "loading" });
  expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();
  expect(screen.queryByText(/you have no notifications/i)).not.toBeInTheDocument();
});

test("treats timestamps as UTC whatever shape they arrive in", () => {
  const iso = formatNotificationTime("2026-08-14T12:00:00Z");
  expect(formatNotificationTime("2026-08-14 12:00:00")).toBe(iso);
  expect(iso).toBe(new Date(Date.UTC(2026, 7, 14, 12)).toLocaleString());
  expect(formatNotificationTime("not a date")).toBe("");
  expect(formatNotificationTime(null)).toBe("");
});
