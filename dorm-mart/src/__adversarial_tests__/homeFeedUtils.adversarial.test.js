import {
  buildHomeFeed,
  getQuickFilterCategories,
  normalizeLandingItem,
} from "../pages/Home/utils/homeFeedUtils";

describe("home feed utility boundaries", () => {
  test("normalizes landing items with safe defaults", () => {
    const item = normalizeLandingItem(
      {
        id: 9,
        title: "",
        price: "abc123",
        tags: "Electronics, Dorm",
        seller_email: "seller@example.com",
        created_at: "bad-date",
      },
      0,
    );

    expect(item.price).toBe(0);
    expect(item.tags).toEqual(["Electronics", "Dorm"]);
    expect(item.category).toBe("Electronics");
    expect(item.sellerUsername).toBe("seller");
    expect(item.createdAtTs).toBe(0);
  });

  test("groups interested-category feed without duplicating visible items into explore", () => {
    const items = [
      { id: 1, category: "Books", tags: ["Books"], createdAtTs: 3 },
      { id: 2, category: "Tech", tags: ["Tech"], createdAtTs: 2 },
      { id: 3, category: "Kitchen", tags: ["Kitchen"], createdAtTs: 1 },
    ];

    const feed = buildHomeFeed(items, ["Books"], 30);

    expect(feed.itemsByInterest.Books.map((item) => item.id)).toEqual([1]);
    expect(feed.exploreItems.map((item) => item.id)).not.toContain(1);
  });

  test("ranks the For You feed by recommendation score without requiring interests", () => {
    const items = [
      { id: 1, recommendationScore: 2, createdAtTs: 3 },
      { id: 2, recommendationScore: 8, createdAtTs: 1 },
      { id: 3, recommendationScore: 8, createdAtTs: 4 },
    ];

    const feed = buildHomeFeed(items, [], 30);

    expect(feed.forYouItems.map((item) => item.id)).toEqual([3, 2, 1]);
  });

  test("derives quick filters from items when category API is empty", () => {
    expect(
      getQuickFilterCategories([], [
        { category: "Books", tags: ["Textbooks"] },
        { category: "Books", tags: ["Dorm"] },
      ]),
    ).toEqual(["Books", "Textbooks", "Dorm"]);
  });
});
