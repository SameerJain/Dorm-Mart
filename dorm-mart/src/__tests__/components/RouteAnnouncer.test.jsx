import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { useLocation } from "react-router-dom";
import RouteAnnouncer, { MAIN_CONTENT_ID, SkipToContent, pageTitleForPath } from "../../components/RouteAnnouncer";

// react-router-dom 7 cannot be loaded by Jest 27, so the location is supplied directly.
jest.mock("react-router-dom", () => ({ useLocation: jest.fn() }));

const pages = {
  "/app": <p>Home content</p>,
  "/app/chat": <p>Chat content</p>,
  "/app/setting/payments": <input aria-label="Field the page focuses" autoFocus />,
};

function Shell({ path }) {
  useLocation.mockReturnValue({ pathname: path });
  return (
    <>
      <SkipToContent />
      <RouteAnnouncer />
      <nav>
        <button type="button">Chat link</button>
      </nav>
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        {pages[path]}
      </main>
    </>
  );
}

/** Renders the shell at `path`; the returned function navigates to another path. */
function renderAt(path) {
  const view = render(<Shell path={path} />);
  return (nextPath) => view.rerender(<Shell path={nextPath} />);
}

describe("pageTitleForPath", () => {
  test.each([
    ["/", "Welcome"],
    ["/app", "Home"],
    ["/app/", "Home"],
    ["/login", "Log in"],
    ["/app/chat", "Chat"],
    ["/app/viewProduct/42", "Listing"],
    ["/app/viewreceipt", "Receipt"],
    ["/app/product-listing/edit/7", "Edit listing"],
    ["/app/product-listing/new", "New listing"],
    ["/app/purchase-history/item-detail/3", "Purchase details"],
    ["/app/purchase-history", "Purchase history"],
    ["/app/seller-dashboard/ongoing-purchases", "Ongoing purchases"],
    ["/app/seller-dashboard", "Seller dashboard"],
    ["/app/setting/payments", "Payments"],
    ["/forgot-password/confirmation", "Check your email"],
    ["/forgot-password", "Forgot password"],
    ["/app/does-not-exist", "Page not found"],
  ])("%s is titled %s", (path, title) => {
    expect(pageTitleForPath(path)).toBe(title);
  });

  test("a path that only shares a prefix with a known page is not that page", () => {
    expect(pageTitleForPath("/app/chatter")).toBe("Page not found");
    expect(pageTitleForPath("/loginx")).toBe("Page not found");
  });
});

describe("RouteAnnouncer", () => {
  test("the first page sets the tab title without announcing or moving focus", () => {
    renderAt("/app");
    expect(document.title).toBe("Home | Dorm Mart");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(document.getElementById(MAIN_CONTENT_ID)).not.toHaveFocus();
  });

  test("navigating announces the new page, retitles the tab and moves focus to the content", () => {
    const navigate = renderAt("/app");
    screen.getByRole("button", { name: "Chat link" }).focus();
    navigate("/app/chat");

    expect(screen.getByText("Chat content")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Chat page");
    expect(document.title).toBe("Chat | Dorm Mart");
    expect(document.getElementById(MAIN_CONTENT_ID)).toHaveFocus();
  });

  test("a page that focuses its own field keeps that focus", () => {
    const navigate = renderAt("/app");
    navigate("/app/setting/payments");

    expect(screen.getByRole("status")).toHaveTextContent("Payments page");
    expect(screen.getByLabelText("Field the page focuses")).toHaveFocus();
  });

  test("the announcement region is polite and read as a whole", () => {
    renderAt("/app");
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
  });
});

describe("SkipToContent", () => {
  test("is the first focusable control and jumps to the main content", () => {
    renderAt("/app");
    const skip = screen.getByRole("button", { name: "Skip to main content" });
    expect(document.querySelector("a, button, input")).toBe(skip);

    skip.focus();
    fireEvent.click(skip);
    expect(document.getElementById(MAIN_CONTENT_ID)).toHaveFocus();
  });
});
