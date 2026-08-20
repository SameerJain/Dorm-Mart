import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotificationPage, { isSafeNotificationDestination } from "./NotificationPage";
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

  fireEvent.click(screen.getByRole("button", { name: /price reduced/i }));

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
