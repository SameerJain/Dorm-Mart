import {
  EMPTY_SUMMARY_METRICS,
  calculateSummaryMetrics,
  filterListings,
  listingStatusClass,
  normalizeSellerListing,
  readRatingValue,
  sortListings,
  truncateProductTitle,
} from "../../../../pages/SellerDashboard/utils/sellerDashboardUtils";

const ids = (list) => list.map((listing) => listing.id);

describe("truncateProductTitle", () => {
  test("short titles are untouched; long ones are cut with an ellipsis", () => {
    expect(truncateProductTitle("Lamp")).toBe("Lamp");
    expect(truncateProductTitle("a".repeat(50))).toBe("a".repeat(50));
    expect(truncateProductTitle("a".repeat(51))).toBe(`${"a".repeat(50)}...`);
    expect(truncateProductTitle("abcdef", 3)).toBe("abc...");
    expect(truncateProductTitle("abc", 3)).toBe("abc");
  });

  test("missing titles pass through", () => {
    expect(truncateProductTitle("")).toBe("");
    expect(truncateProductTitle(null)).toBeNull();
    expect(truncateProductTitle(undefined)).toBeUndefined();
  });
});

describe("listingStatusClass", () => {
  test("each status has its own style, ignoring case", () => {
    const styles = ["active", "pending", "draft", "sold", "unknown"].map(listingStatusClass);
    expect(new Set(styles).size).toBe(5);
    expect(listingStatusClass("ACTIVE")).toBe(listingStatusClass("active"));
    expect(listingStatusClass("Sold")).toBe(listingStatusClass("sold"));
    expect(listingStatusClass(null)).toBe(listingStatusClass("unknown"));
    expect(listingStatusClass(undefined)).toBe(listingStatusClass("something else"));
  });
});

describe("normalizeSellerListing", () => {
  test("a bare record gets every default", () => {
    expect(normalizeSellerListing({})).toEqual({
      id: undefined,
      title: undefined,
      price: 0,
      status: "Active",
      createdAt: undefined,
      image: null,
      sold_by: undefined,
      seller_user_id: undefined,
      buyer_user_id: undefined,
      wishlisted: 0,
      views: 0,
      categories: [],
      has_accepted_scheduled_purchase: false,
    });
  });

  test("copies the fields it keeps, renaming created_at", () => {
    expect(
      normalizeSellerListing({
        id: 4,
        title: "Lamp",
        price: 12,
        status: "Sold",
        created_at: "2026-01-02",
        sold_by: "Ava",
        seller_user_id: 3,
        buyer_user_id: 8,
        categories: ["Decor"],
      }),
    ).toMatchObject({
      id: 4,
      title: "Lamp",
      price: 12,
      status: "Sold",
      createdAt: "2026-01-02",
      sold_by: "Ava",
      seller_user_id: 3,
      buyer_user_id: 8,
      categories: ["Decor"],
    });
  });

  test("image_url wins over image, and both go through the image proxy", () => {
    expect(normalizeSellerListing({ image_url: "/images/a.jpg", image: "/images/b.jpg" }).image).toMatch(
      /url=%2Fimages%2Fa\.jpg$/,
    );
    expect(normalizeSellerListing({ image: "/images/b.jpg" }).image).toMatch(/url=%2Fimages%2Fb\.jpg$/);
    expect(normalizeSellerListing({ image_url: "" }).image).toBeNull();
  });

  test("counts are whole, non-negative numbers", () => {
    expect(normalizeSellerListing({ views: "7", wishlisted: 2.9 })).toMatchObject({ views: 7, wishlisted: 2 });
    expect(normalizeSellerListing({ views: -1, wishlisted: "abc" })).toMatchObject({ views: 0, wishlisted: 0 });
    expect(normalizeSellerListing({ views: 0 }).views).toBe(0);
    expect(normalizeSellerListing({ views: Infinity }).views).toBe(0);
  });

  test("accepted-scheduled-purchase is true only for true or 1", () => {
    for (const [value, expected] of [[true, true], [1, true], ["1", false], [0, false], [false, false], [null, false]]) {
      expect(normalizeSellerListing({ has_accepted_scheduled_purchase: value }).has_accepted_scheduled_purchase).toBe(
        expected,
      );
    }
  });
});

describe("calculateSummaryMetrics", () => {
  test("no listings gives the empty summary, without changing the shared one", () => {
    expect(calculateSummaryMetrics([])).toEqual(EMPTY_SUMMARY_METRICS);
    calculateSummaryMetrics([{ status: "Active", views: 5, wishlisted: 5 }]);
    expect(EMPTY_SUMMARY_METRICS).toEqual({
      totalPosts: 0,
      activeListings: 0,
      pendingSales: 0,
      itemsSold: 0,
      totalViews: 0,
      totalWishlists: 0,
    });
  });

  test("counts each status separately and totals only the three live ones", () => {
    expect(
      calculateSummaryMetrics([
        { status: "Active", views: 1, wishlisted: 10 },
        { status: "ACTIVE", views: 2, wishlisted: 20 },
        { status: "pending", views: 4, wishlisted: 40 },
        { status: "Sold", views: 8, wishlisted: 80 },
        { status: "Draft", views: 100, wishlisted: 100 },
        { status: "", views: 100, wishlisted: 100 },
        { views: 100, wishlisted: 100 },
      ]),
    ).toEqual({
      totalPosts: 4,
      activeListings: 2,
      pendingSales: 1,
      itemsSold: 1,
      totalViews: 15,
      totalWishlists: 150,
    });
  });
});

describe("filterListings", () => {
  const listings = [
    { id: 1, status: "Active", categories: ["Books"] },
    { id: 2, status: "Sold", categories: ["Books", "Decor"] },
    { id: 3, status: "sold", categories: ["Decor"] },
    { id: 4, status: "Sold", categories: "not-a-list" },
    { id: 5, categories: null },
  ];

  test("the All options let everything through", () => {
    expect(ids(filterListings(listings, "All Status", "All Categories"))).toEqual([1, 2, 3, 4, 5]);
  });

  test("status matches ignoring case", () => {
    expect(ids(filterListings(listings, "Sold", "All Categories"))).toEqual([2, 3, 4]);
    expect(ids(filterListings(listings, "active", "All Categories"))).toEqual([1]);
    expect(ids(filterListings(listings, "Draft", "All Categories"))).toEqual([]);
  });

  test("category must be in the listing's list; a malformed list matches nothing", () => {
    expect(ids(filterListings(listings, "All Status", "Decor"))).toEqual([2, 3]);
    expect(ids(filterListings(listings, "All Status", "Missing"))).toEqual([]);
  });

  test("both filters must match", () => {
    expect(ids(filterListings(listings, "Sold", "Decor"))).toEqual([2, 3]);
    expect(ids(filterListings(listings, "Active", "Decor"))).toEqual([]);
    expect(ids(filterListings(listings, "Sold", "Books"))).toEqual([2]);
  });
});

describe("sortListings", () => {
  const listings = [
    { id: "b", price: 20, createdAt: "2026-01-02" },
    { id: "c", price: 5, createdAt: "2026-01-03" },
    { id: "a", price: 30, createdAt: "2026-01-01" },
    { id: "u", price: 10, createdAt: "not a date" },
  ];

  test("newest and oldest first, with undated listings treated as oldest", () => {
    expect(ids(sortListings(listings, "Newest First"))).toEqual(["c", "b", "a", "u"]);
    expect(ids(sortListings(listings, "Oldest First"))).toEqual(["u", "a", "b", "c"]);
  });

  test("price sorts run in both directions", () => {
    expect(ids(sortListings(listings, "Price: Low to High"))).toEqual(["c", "u", "b", "a"]);
    expect(ids(sortListings(listings, "Price: High to Low"))).toEqual(["a", "b", "u", "c"]);
  });

  test("review sorts group by review, then newest first within each group", () => {
    const reviews = { a: {}, b: {}, u: null };
    expect(ids(sortListings(listings, "Reviewed Items On Top", reviews))).toEqual(["b", "a", "c", "u"]);
    expect(ids(sortListings(listings, "Reviewed Items On Bottom", reviews))).toEqual(["c", "u", "b", "a"]);
    // With no reviews at all it is simply newest first.
    expect(ids(sortListings(listings, "Reviewed Items On Top"))).toEqual(["c", "b", "a", "u"]);
    expect(ids(sortListings(listings, "Reviewed Items On Bottom"))).toEqual(["c", "b", "a", "u"]);
  });

  test("an unknown sort keeps the order; the input is never modified", () => {
    const original = ids(listings);
    expect(ids(sortListings(listings, "Random"))).toEqual(original);
    expect(sortListings(listings, "Random")).not.toBe(listings);
    sortListings(listings, "Price: Low to High");
    sortListings(listings, "Newest First");
    expect(ids(listings)).toEqual(original);
  });
});

describe("readRatingValue", () => {
  test("reads a rating from a number, a numeric string, or a {rating} object", () => {
    expect(readRatingValue(4.5)).toBe(4.5);
    expect(readRatingValue("4")).toBe(4);
    expect(readRatingValue({ rating: "3.5" })).toBe(3.5);
    expect(readRatingValue({ rating: 5 })).toBe(5);
  });

  test("zero, negative, non-numeric and missing ratings are null", () => {
    for (const value of [0, -1, "abc", NaN, Infinity, null, undefined, {}, { rating: 0 }, { rating: "x" }, { product_rating: 4 }]) {
      expect(readRatingValue(value)).toBeNull();
    }
  });
});
