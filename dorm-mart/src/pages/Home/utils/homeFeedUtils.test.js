import {
  HOME_FEED_TAB_SESSION_KEY,
  MIN_EXPLORE_ITEMS,
  buildHomeFeed,
  computeExploreLimit,
  getQuickFilterCategories,
  normalizeLandingItem,
  readStoredFeedTab,
  shuffleArray,
  writeStoredFeedTab,
} from "./homeFeedUtils";
import { FALLBACK_IMAGE_URL } from "../../../utils/imageFallback";

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  sessionStorage.clear();
});

describe("feed tab memory", () => {
  test("remembers only the two real tabs", () => {
    writeStoredFeedTab("explore");
    expect(sessionStorage.getItem(HOME_FEED_TAB_SESSION_KEY)).toBe("explore");
    expect(readStoredFeedTab()).toBe("explore");
    writeStoredFeedTab("forYou");
    expect(readStoredFeedTab()).toBe("forYou");

    writeStoredFeedTab("settings");
    writeStoredFeedTab(undefined);
    expect(readStoredFeedTab()).toBe("forYou");
  });

  test("ignores a stored value that is not a tab", () => {
    sessionStorage.setItem(HOME_FEED_TAB_SESSION_KEY, "settings");
    expect(readStoredFeedTab()).toBeNull();
    sessionStorage.clear();
    expect(readStoredFeedTab()).toBeNull();
  });

  test("never throws when storage is unavailable", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredFeedTab()).toBeNull();
    expect(() => writeStoredFeedTab("explore")).not.toThrow();
  });
});

describe("computeExploreLimit", () => {
  const withWidth = (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    return computeExploreLimit();
  };
  const original = window.innerWidth;
  afterEach(() => withWidth(original));

  test.each([
    [400, MIN_EXPLORE_ITEMS],
    [767, MIN_EXPLORE_ITEMS],
    [768, 30],
    [1023, 30],
    [1024, 32],
    [1279, 32],
    [1280, 36],
    [1535, 36],
    [1536, 42],
    [3000, 42],
  ])("a %ipx window shows %i items", (width, expected) => {
    expect(withWidth(width)).toBe(expected);
  });
});

describe("shuffleArray", () => {
  test("returns a permutation and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffleArray(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out).not.toBe(input);
    expect([...out].sort()).toEqual(input);
  });

  test("uses every position, driven by the random source", () => {
    jest.spyOn(Math, "random").mockReturnValue(0);
    // random()=0 always swaps with index 0: a known rotation.
    expect(shuffleArray([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);
    Math.random.mockReturnValue(0.999);
    // random()~1 swaps each element with itself: unchanged.
    expect(shuffleArray([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });

  test("handles empty and single-item lists", () => {
    expect(shuffleArray([])).toEqual([]);
    expect(shuffleArray([9])).toEqual([9]);
  });
});

describe("normalizeLandingItem", () => {
  const NOW = Date.parse("2026-09-30T12:00:00Z");
  const hoursAgo = (h) => new Date(NOW - h * 36e5).toISOString();
  beforeEach(() => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(NOW);
  });

  test("a bare record gets every default", () => {
    expect(normalizeLandingItem({})).toEqual({
      id: 0,
      title: "Untitled",
      price: 0,
      img: FALLBACK_IMAGE_URL,
      tags: [],
      status: "AVAILABLE",
      category: "General",
      createdAtTs: 0,
      seller: "Unknown Seller",
      sellerUsername: null,
      sellerEmail: null,
      rating: 4.7,
      location: "North Campus",
      recommendationScore: 0,
      recommendationReason: null,
      personalized: false,
    });
  });

  test("the index only stands in for a missing id (id 0 is real)", () => {
    expect(normalizeLandingItem({}, 5).id).toBe(5);
    expect(normalizeLandingItem({ id: 0 }, 5).id).toBe(0);
    expect(normalizeLandingItem({ id: 8 }, 5).id).toBe(8);
  });

  test("an empty title is kept; only a missing one becomes Untitled", () => {
    expect(normalizeLandingItem({ title: "" }).title).toBe("");
    expect(normalizeLandingItem({ title: "Lamp" }).title).toBe("Lamp");
  });

  test("the status is JUST POSTED for 48 hours, then AVAILABLE, unless the record says otherwise", () => {
    expect(normalizeLandingItem({ created_at: hoursAgo(47) }).status).toBe("JUST POSTED");
    expect(normalizeLandingItem({ created_at: hoursAgo(48) }).status).toBe("AVAILABLE");
    expect(normalizeLandingItem({ created_at: hoursAgo(100) }).status).toBe("AVAILABLE");
    expect(normalizeLandingItem({ created_at: hoursAgo(1), status: "SOLD" }).status).toBe("SOLD");
    expect(normalizeLandingItem({ created_at: "not a date" }).status).toBe("AVAILABLE");
    expect(normalizeLandingItem({ created_at: hoursAgo(1) }).createdAtTs).toBe(NOW - 36e5);
  });

  test("the category is explicit, else the first tag, else General", () => {
    expect(normalizeLandingItem({ category: "Books", tags: "Dorm" }).category).toBe("Books");
    expect(normalizeLandingItem({ tags: "Dorm, Kitchen" }).category).toBe("Dorm");
    expect(normalizeLandingItem({ tags: "" }).category).toBe("General");
  });

  test("seller name and location fall back through their alternate fields", () => {
    expect(normalizeLandingItem({ seller: "A", sold_by: "B", seller_name: "C" }).seller).toBe("A");
    expect(normalizeLandingItem({ sold_by: "B", seller_name: "C" }).seller).toBe("B");
    expect(normalizeLandingItem({ seller_name: "C" }).seller).toBe("C");
    expect(normalizeLandingItem({ location: "Ellicott", campus: "South" }).location).toBe("Ellicott");
    expect(normalizeLandingItem({ campus: "South" }).location).toBe("South");
  });

  test("the seller username comes from the record, else the email's local part", () => {
    expect(
      normalizeLandingItem({ seller_username: "ava", email: "other@buffalo.edu" }).sellerUsername,
    ).toBe("ava");
    const fromEmail = normalizeLandingItem({ email: " ava.lee@buffalo.edu ", seller_email: "x@y.z" });
    expect(fromEmail.sellerUsername).toBe("ava.lee");
    expect(fromEmail.sellerEmail).toBe(" ava.lee@buffalo.edu ");
    expect(normalizeLandingItem({ seller_email: "sam@buffalo.edu" }).sellerEmail).toBe("sam@buffalo.edu");
    expect(normalizeLandingItem({ email: "@buffalo.edu" }).sellerUsername).toBeNull();
    expect(normalizeLandingItem({ email: "" }).sellerUsername).toBeNull();
  });

  test("the rating is used only when it is a number", () => {
    expect(normalizeLandingItem({ rating: 3 }).rating).toBe(3);
    expect(normalizeLandingItem({ rating: 0 }).rating).toBe(0);
    expect(normalizeLandingItem({ rating: "3" }).rating).toBe(4.7);
    expect(normalizeLandingItem({ rating: null }).rating).toBe(4.7);
  });

  test("recommendation fields and the personalized flag", () => {
    const item = normalizeLandingItem({
      recommendation_score: "2.5",
      recommendation_reason: "Because you liked Books",
      personalized: 1,
    });
    expect(item.recommendationScore).toBe(2.5);
    expect(item.recommendationReason).toBe("Because you liked Books");
    expect(item.personalized).toBe(true);
    expect(normalizeLandingItem({ personalized: true }).personalized).toBe(true);
    expect(normalizeLandingItem({ personalized: "1" }).personalized).toBe(false);
    expect(normalizeLandingItem({ personalized: 0 }).personalized).toBe(false);
    expect(normalizeLandingItem({ recommendation_score: "abc" }).recommendationScore).toBe(0);
  });

  test("the price is numeric, and an image is resolved or replaced by the placeholder", () => {
    expect(normalizeLandingItem({ price: "12.5" }).price).toBe(12.5);
    expect(normalizeLandingItem({ price: "abc" }).price).toBe(0);
    expect(normalizeLandingItem({ image: "https://cdn.example.test/a.jpg" }).img).toBe(
      "https://cdn.example.test/a.jpg",
    );
    expect(normalizeLandingItem({ image_url: "https://cdn.example.test/b.jpg" }).img).toBe(
      "https://cdn.example.test/b.jpg",
    );
    expect(
      normalizeLandingItem({ image: "https://cdn.example.test/a.jpg", image_url: "https://cdn.example.test/b.jpg" })
        .img,
    ).toBe("https://cdn.example.test/a.jpg");
    expect(normalizeLandingItem({ image: "/images/lamp.jpg" }).img).toMatch(
      /\/media\/image\.php\?url=%2Fimages%2Flamp\.jpg$/,
    );
    // A script URL is wrapped into the image proxy's query string, so it can
    // never be used as a script source.
    const script = normalizeLandingItem({ image: "javascript:alert(1)" }).img;
    expect(script).toMatch(/^\/api\/media\/image\.php\?url=javascript%3Aalert\(1\)$/);
    expect(script.startsWith("javascript:")).toBe(false);
  });
});

describe("getQuickFilterCategories", () => {
  test("API categories win", () => {
    expect(getQuickFilterCategories(["Books"], [{ category: "Tech" }])).toEqual(["Books"]);
  });

  test("otherwise derive from items: categories then tags, no duplicates, no blanks, as strings", () => {
    expect(
      getQuickFilterCategories(
        [],
        [
          { category: "Books", tags: ["Textbooks", "", null, "Books"] },
          { category: "", tags: "not-a-list" },
          { category: 7, tags: [8] },
        ],
      ),
    ).toEqual(["Books", "Textbooks", "7", "8"]);
  });

  test("with nothing to derive, offer the starter categories", () => {
    const starter = ["Electronics", "Kitchen", "Furniture", "Dorm Essentials"];
    expect(getQuickFilterCategories([], [])).toEqual(starter);
    expect(getQuickFilterCategories([], [{ category: "", tags: [] }])).toEqual(starter);
  });
});

describe("buildHomeFeed", () => {
  const many = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

  test("For You ranks by score, then newest, treating missing values as zero", () => {
    const items = [
      { id: "oldest-no-score" },
      { id: "score2-new", recommendationScore: 2, createdAtTs: 9 },
      { id: "score2-old", recommendationScore: 2, createdAtTs: 1 },
      { id: "score5", recommendationScore: 5 },
      { id: "no-score-new", createdAtTs: 4 },
    ];
    // A three-way tie, oldest first, so a comparator that ignores age cannot pass.
    items.push(
      { id: "tie-1", recommendationScore: 7, createdAtTs: 1 },
      { id: "tie-3", recommendationScore: 7, createdAtTs: 3 },
      { id: "tie-2", recommendationScore: 7, createdAtTs: 2 },
    );
    const before = items.map((item) => item.id);
    expect(buildHomeFeed(items, 30).forYouItems.map((item) => item.id)).toEqual([
      "tie-3",
      "tie-2",
      "tie-1",
      "score5",
      "score2-new",
      "score2-old",
      "no-score-new",
      "oldest-no-score",
    ]);
    expect(items.map((item) => item.id)).toEqual(before);
  });

  test("For You is capped at 50; Explore at the window's limit within 30 to 50", () => {
    const items = many(80);
    expect(buildHomeFeed(items, 30).forYouItems).toHaveLength(50);
    expect(buildHomeFeed(items, 10).exploreItems).toHaveLength(30);
    expect(buildHomeFeed(items, 42).exploreItems).toHaveLength(42);
    expect(buildHomeFeed(items, 500).exploreItems).toHaveLength(50);
    expect(buildHomeFeed(many(5), 42).exploreItems).toHaveLength(5);
  });

  test("Explore uses the supplied order only when it matches the item count", () => {
    const items = many(40);
    const reversed = [...items].reverse();
    expect(buildHomeFeed(items, 30, reversed).exploreItems[0].id).toBe(40);

    jest.spyOn(Math, "random").mockReturnValue(0);
    const shorter = reversed.slice(0, 39);
    const fromShuffle = buildHomeFeed(items, 30, shorter).exploreItems.map((item) => item.id);
    expect(fromShuffle).not.toEqual(shorter.slice(0, 30).map((item) => item.id));
    expect(fromShuffle).toEqual(shuffleArray(items).slice(0, 30).map((item) => item.id));
    Math.random.mockRestore();

    const fromNull = buildHomeFeed(items, 30, null).exploreItems;
    expect(fromNull).toHaveLength(30);
  });
});
