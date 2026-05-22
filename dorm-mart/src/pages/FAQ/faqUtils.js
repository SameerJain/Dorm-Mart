export const TABS = [
  { id: "home", label: "Home" },
  { id: "wishlist", label: "Wishlist" },
  { id: "chat", label: "Chat" },
  { id: "purchases", label: "Purchases" },
  { id: "reviews", label: "Reviews" },
  { id: "seller", label: "Seller Dashboard" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
  { id: "settings", label: "Settings" },
];

export function getTabForPath(pathname) {
  if (!pathname) return "home";
  if (pathname === "/app" || pathname === "/app/") return "home";
  if (pathname.startsWith("/app/listings")) return "home";
  if (pathname.startsWith("/app/viewProduct") || pathname.startsWith("/app/viewproduct")) return "home";
  if (pathname.startsWith("/app/wishlist")) return "wishlist";
  if (pathname.startsWith("/app/chat")) return "chat";
  if (pathname.startsWith("/app/purchase-history") || pathname.startsWith("/app/viewReceipt") || pathname.startsWith("/app/viewreceipt")) return "purchases";
  // buyer-reviews must come before the generic /app/setting catch-all
  if (pathname.startsWith("/app/setting/buyer-reviews")) return "reviews";
  if (pathname.startsWith("/app/seller-dashboard") || pathname.startsWith("/app/product-listing")) return "seller";
  if (pathname.startsWith("/app/notification")) return "notifications";
  if (pathname.startsWith("/app/profile")) return "profile";
  if (pathname.startsWith("/app/setting")) return "settings";
  return "home";
}
