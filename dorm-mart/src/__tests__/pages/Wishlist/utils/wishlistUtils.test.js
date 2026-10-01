import {
  filterWishlistItems,
  getWishlistCategories,
  normalizeWishlistItems,
  selectedCategoryAfterRemoval,
} from "../../../../pages/Wishlist/utils/wishlistUtils";

describe("normalizeWishlistItems", () => {
  const NOW = Date.parse("2026-09-30T12:00:00Z");
  const options = { apiBase: "https://api.example.test/api", publicBase: "", now: NOW };
  const hoursAgo = (h) => new Date(NOW - h * 36e5).toISOString();
  const one = (item, opts = options) => normalizeWishlistItems({ success: true, data: [item] }, opts)[0];

  test.each([
    ["no payload", null],
    ["no payload at all", undefined],
    ["an unsuccessful reply", { success: false, data: [{ product_id: 1 }] }],
    ["a missing success flag", { data: [{ product_id: 1 }] }],
    ["a falsy success flag", { success: 0, data: [{ product_id: 1 }] }],
    ["data that is not a list", { success: true, data: { product_id: 1 } }],
    ["missing data", { success: true }],
  ])("%s gives an empty wishlist", (_label, payload) => {
    expect(normalizeWishlistItems(payload, options)).toEqual([]);
  });

  test("a bare record gets every default", () => {
    expect(one({})).toEqual({
      id: undefined,
      title: "Untitled",
      price: 0,
      img: null,
      tags: [],
      status: "AVAILABLE",
      seller: "Unknown Seller",
      sellerUsername: null,
      sellerEmail: null,
    });
  });

  test("keeps the order and count of the list", () => {
    const items = normalizeWishlistItems({ success: true, data: [{ product_id: 3 }, { product_id: 1 }, { product_id: 2 }] }, options);
    expect(items.map((item) => item.id)).toEqual([3, 1, 2]);
  });

  test("tags come from tags, else categories", () => {
    expect(one({ tags: "A, B", categories: "C" }).tags).toEqual(["A", "B"]);
    expect(one({ tags: [], categories: "C" }).tags).toEqual([]);
    expect(one({ categories: ["C", "D"] }).tags).toEqual(["C", "D"]);
    expect(one({ tags: null, categories: "C" }).tags).toEqual(["C"]);
  });

  test("the status is explicit, else JUST POSTED for under 48 hours, else AVAILABLE", () => {
    expect(one({ created_at: hoursAgo(47) }).status).toBe("JUST POSTED");
    expect(one({ created_at: hoursAgo(48) }).status).toBe("AVAILABLE");
    expect(one({ created_at: hoursAgo(49) }).status).toBe("AVAILABLE");
    expect(one({ created_at: hoursAgo(1), status: "SOLD" }).status).toBe("SOLD");
    expect(one({ date_listed: hoursAgo(2) }).status).toBe("JUST POSTED");
    expect(one({ created_at: hoursAgo(100), date_listed: hoursAgo(1) }).status).toBe("AVAILABLE");
    expect(one({ created_at: "bad" }).status).toBe("AVAILABLE");
    expect(one({}).status).toBe("AVAILABLE");
  });

  test("the clock defaults to the current time", () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(NOW);
    try {
      const fresh = normalizeWishlistItems({ success: true, data: [{ created_at: hoursAgo(1) }] }, { apiBase: "/api" });
      const old = normalizeWishlistItems({ success: true, data: [{ created_at: hoursAgo(72) }] }, { apiBase: "/api" });
      expect(fresh[0].status).toBe("JUST POSTED");
      expect(old[0].status).toBe("AVAILABLE");
    } finally {
      jest.useRealTimers();
    }
  });

  test("prices are numeric or zero", () => {
    expect(one({ price: "12.50" }).price).toBe(12.5);
    expect(one({ price: 0 }).price).toBe(0);
    expect(one({ price: "abc" }).price).toBe(0);
  });

  test("images are resolved through the API, and a missing one is null", () => {
    expect(one({ image_url: "/images/lamp.jpg" }).img).toBe(
      "https://api.example.test/api/media/image.php?url=%2Fimages%2Flamp.jpg",
    );
    expect(one({ image_url: "uploads/lamp.jpg" }).img).toBe(
      "https://api.example.test/api/media/image.php?url=uploads%2Flamp.jpg",
    );
    expect(one({ image_url: "https://cdn.example.test/lamp.jpg" }).img).toBe("https://cdn.example.test/lamp.jpg");
    expect(one({ image_url: "" }).img).toBeNull();
    expect(one({ image_url: null }).img).toBeNull();
  });

  test("seller name and email: the first available, with the username from the record or the email", () => {
    expect(one({ seller: "Ava" }).seller).toBe("Ava");
    expect(one({ email: "a@x.edu", seller_email: "b@x.edu" }).sellerEmail).toBe("a@x.edu");
    expect(one({ seller_email: "b@x.edu" }).sellerEmail).toBe("b@x.edu");
    expect(one({ seller_username: "ava", email: "other@x.edu" }).sellerUsername).toBe("ava");
    expect(one({ email: "ava.lee@x.edu" }).sellerUsername).toBe("ava.lee");
    expect(one({ seller_email: "sam@x.edu" }).sellerUsername).toBe("sam");
    expect(one({ email: 12 }).sellerUsername).toBeNull();
    expect(one({ email: 12 }).sellerEmail).toBe(12);
  });
});

describe("getWishlistCategories", () => {
  test("collects each tag once, sorted, ignoring blanks and non-text", () => {
    expect(
      getWishlistCategories([
        { tags: ["Decor", "Books", ""] },
        { tags: ["Books", 7, null, "Art"] },
        { tags: "not-a-list" },
        { tags: null },
        {},
      ]),
    ).toEqual(["Art", "Books", "Decor"]);
    expect(getWishlistCategories([])).toEqual([]);
  });

  test("categories that differ only by case stay separate", () => {
    expect(getWishlistCategories([{ tags: ["decor", "Decor"] }])).toEqual(["Decor", "decor"]);
  });
});

describe("filterWishlistItems", () => {
  const items = [
    { id: 1, tags: ["Decor", "Lighting"] },
    { id: 2, tags: ["Books"] },
    { id: 3, tags: null },
    { id: 4 },
    { id: 5, tags: [7, "decor"] },
  ];
  const ids = (list) => list.map((item) => item.id);

  test("no category keeps everything, and it is the same list", () => {
    expect(filterWishlistItems(items, "")).toBe(items);
    expect(filterWishlistItems(items, null)).toBe(items);
    expect(filterWishlistItems(items, undefined)).toBe(items);
  });

  test("matches a tag whole, ignoring case", () => {
    expect(ids(filterWishlistItems(items, "decor"))).toEqual([1, 5]);
    expect(ids(filterWishlistItems(items, "DECOR"))).toEqual([1, 5]);
    expect(ids(filterWishlistItems(items, "Books"))).toEqual([2]);
    expect(ids(filterWishlistItems(items, "Dec"))).toEqual([]);
    expect(ids(filterWishlistItems(items, "7"))).toEqual([5]);
    expect(ids(filterWishlistItems(items, "Nope"))).toEqual([]);
  });
});

describe("selectedCategoryAfterRemoval", () => {
  const items = [{ id: 1, tags: ["Decor"] }, { id: 2, tags: ["Books"] }];

  test("keeps the selection while some item still has it", () => {
    expect(selectedCategoryAfterRemoval(items, "Decor")).toBe("Decor");
    expect(selectedCategoryAfterRemoval(items, "decor")).toBe("decor");
  });

  test("drops it once no item has it, or when nothing was selected", () => {
    expect(selectedCategoryAfterRemoval(items.slice(1), "Decor")).toBeNull();
    expect(selectedCategoryAfterRemoval([], "Decor")).toBeNull();
    expect(selectedCategoryAfterRemoval(items, "")).toBeNull();
    expect(selectedCategoryAfterRemoval(items, null)).toBeNull();
    expect(selectedCategoryAfterRemoval(items, undefined)).toBeNull();
  });
});
