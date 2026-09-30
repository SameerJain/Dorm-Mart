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

  test("explore includes every listing, including ones matching the user's interests", () => {
    const items = [
      { id: 1, category: "Books", tags: ["Books"], createdAtTs: 3 },
      { id: 2, category: "Tech", tags: ["Tech"], createdAtTs: 2 },
      { id: 3, category: "Kitchen", tags: ["Kitchen"], createdAtTs: 1 },
    ];

    const feed = buildHomeFeed(items, 30);

    expect(feed.exploreItems.map((item) => item.id).sort()).toEqual([1, 2, 3]);
  });

  test("explore keeps the given order when only the limit changes", () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
    const order = [...items].reverse();

    const small = buildHomeFeed(items, 30, order).exploreItems.map((item) => item.id);
    const large = buildHomeFeed(items, 40, order).exploreItems.map((item) => item.id);

    expect(large.slice(0, small.length)).toEqual(small);
    expect(small[0]).toBe(40);
  });

  test("ranks the For You feed by recommendation score without requiring interests", () => {
    const items = [
      { id: 1, recommendationScore: 2, createdAtTs: 3 },
      { id: 2, recommendationScore: 8, createdAtTs: 1 },
      { id: 3, recommendationScore: 8, createdAtTs: 4 },
    ];

    const feed = buildHomeFeed(items, 30);

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
