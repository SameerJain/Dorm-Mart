import {
  calculateSummaryMetrics,
  filterListings,
  normalizeSellerListing,
  readRatingValue,
  sortListings,
} from "../pages/SellerDashboard/utils/sellerDashboardUtils";

describe("seller dashboard utility boundaries", () => {
  test("normalizes listing shape without trusting nullable API fields", () => {
    const listing = normalizeSellerListing({
      id: 1,
      title: "Lamp",
      image_url: "/images/lamp.jpg",
      has_accepted_scheduled_purchase: 1,
      categories: "not-array",
      wishlisted: -2,
      views: "7",
    });

    expect(listing.categories).toEqual([]);
    expect(listing.has_accepted_scheduled_purchase).toBe(true);
    expect(listing.image).toContain("/media/image.php");
    expect(listing.wishlisted).toBe(0);
    expect(listing.views).toBe(7);
  });

  test("calculates metrics from status values", () => {
    expect(
      calculateSummaryMetrics([
        { status: "Active", views: "4", wishlisted: 2 },
        { status: "pending", views: 3, wishlisted: -1 },
        { status: "Sold", views: "bad", wishlisted: 5 },
        { status: "draft", views: 100, wishlisted: 100 },
      ]),
    ).toEqual({
      totalPosts: 3,
      activeListings: 1,
      pendingSales: 1,
      itemsSold: 1,
      totalViews: 7,
      totalWishlists: 7,
    });
  });

  test("filters and sorts without leaking invalid dates into comparisons", () => {
    const listings = [
      { id: 1, status: "Sold", categories: ["Books"], createdAt: "bad", price: 20 },
      { id: 2, status: "Sold", categories: ["Books"], createdAt: "2026-01-02", price: 10 },
      { id: 3, status: "Active", categories: ["Tech"], createdAt: "2026-01-03", price: 30 },
    ];

    const filtered = filterListings(listings, "Sold", "Books");
    expect(filtered.map((listing) => listing.id)).toEqual([1, 2]);
    expect(sortListings(filtered, "Newest First").map((listing) => listing.id)).toEqual([2, 1]);
    expect(sortListings(filtered, "Price: Low to High").map((listing) => listing.id)).toEqual([2, 1]);
  });

  test("reads rating values from object, scalar, and malformed payloads", () => {
    expect(readRatingValue({ rating: "4.5" })).toBe(4.5);
    expect(readRatingValue(3)).toBe(3);
    expect(readRatingValue("2")).toBe(2);
    expect(readRatingValue({ rating: "bad" })).toBeNull();
    expect(readRatingValue({ product_rating: 5 })).toBeNull();
    expect(readRatingValue(null)).toBeNull();
  });
});
