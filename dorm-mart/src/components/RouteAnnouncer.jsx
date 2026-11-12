import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export const MAIN_CONTENT_ID = "main-content";

// First match wins, so longer paths come before the paths they start with.
const PAGE_TITLES = [
  ["/app/product-listing/edit", "Edit listing"],
  ["/app/product-listing", "New listing"],
  ["/app/listings", "Search results"],
  ["/app/viewproduct", "Listing"],
  ["/app/viewreceipt", "Receipt"],
  ["/app/purchase-history/item-detail", "Purchase details"],
  ["/app/purchase-history", "Purchase history"],
  ["/app/notification", "Notifications"],
  ["/app/chat", "Chat"],
  ["/app/wishlist", "Wishlist"],
  ["/app/profile", "Profile"],
  ["/app/seller-dashboard/schedule-purchase", "Schedule a purchase"],
  ["/app/seller-dashboard/confirm-purchase", "Confirm a purchase"],
  ["/app/seller-dashboard/ongoing-purchases", "Ongoing purchases"],
  ["/app/seller-dashboard", "Seller dashboard"],
  ["/app/scheduled-purchases/mark-completed", "Mark purchase completed"],
  ["/app/setting/my-profile", "My profile settings"],
  ["/app/setting/change-password", "Change password"],
  ["/app/setting/buyer-reviews", "How sellers rated you"],
  ["/app/setting/user-preferences", "Preferences"],
  ["/app/setting/personal-information", "Account info"],
  ["/app/setting/security-options", "Logged devices"],
  ["/app/setting/two-factor-authentication", "Two-factor authentication"],
  ["/app/setting/payments", "Payments"],
  ["/app/setting/about-us", "About us"],
  ["/app/setting/delete-account", "Delete account"],
  ["/app/setting", "Settings"],
  ["/app/faq", "Frequently asked questions"],
  ["/app/moderation", "Moderation"],
  ["/login", "Log in"],
  ["/create-account", "Create account"],
  ["/forgot-password/confirmation", "Check your email"],
  ["/forgot-password", "Forgot password"],
  ["/reset-password/confirmation", "Password reset complete"],
  ["/reset-password", "Reset password"],
  ["/privacy-policy", "Privacy Policy"],
  ["/terms-of-service", "Terms of Service"],
  ["/safety", "Safety at Dorm Mart"],
];

export function pageTitleForPath(pathname) {
  const path = String(pathname || "/").toLowerCase();
  if (path === "/") return "Welcome";
  if (path === "/app" || path === "/app/") return "Home";
  const match = PAGE_TITLES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return match ? match[1] : "Page not found";
}

function focusMainContent() {
  document.getElementById(MAIN_CONTENT_ID)?.focus({ preventScroll: true });
}

/** First stop for keyboard users: jumps past the navigation bar. */
export function SkipToContent() {
  return (
    <button
      type="button"
      onClick={focusMainContent}
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded-lg focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:outline-none focus:ring-2 focus:ring-white"
    >
      Skip to main content
    </button>
  );
}

/**
 * Tells screen reader users that the page changed. A single-page app swaps
 * content without a page load, so nothing is announced unless we do it: this
 * sets the tab title, speaks the new page name, and moves focus to the main
 * content so reading continues there instead of at the link that was clicked.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [announcement, setAnnouncement] = useState("");
  const isFirstRender = useRef(true);

  useEffect(() => {
    const title = pageTitleForPath(pathname);
    document.title = `${title} | Dorm Mart`;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setAnnouncement(`${title} page`);
    // A page that already focused one of its own fields keeps that focus.
    const main = document.getElementById(MAIN_CONTENT_ID);
    if (main && !main.contains(document.activeElement)) focusMainContent();
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
