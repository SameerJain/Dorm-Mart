import {
  PRICE_FILTER_PATTERN,
  buildSearchPayload,
  buildSearchUrl,
  getSearchTitle,
  normalizeSearchResults,
  readIncludeDescriptionPreference,
  readSearchFilters,
  validateSearchPrices,
} from "../../../../pages/Search/utils/searchResultsUtils";

const q = (string) => new URLSearchParams(string);

describe("PRICE_FILTER_PATTERN", () => {
  test.each(["", "1", "1234", ".", "12.", ".5", "12.34", "9999.99"])("allows %p while typing", (value) => {
    expect(PRICE_FILTER_PATTERN.test(value)).toBe(true);
  });

  test.each(["12345", "1.234", "-1", "1e3", "1,5", "a", " 1", "1 ", "1.2.3"])("rejects %p", (value) => {
    expect(PRICE_FILTER_PATTERN.test(value)).toBe(false);
  });
});

describe("readIncludeDescriptionPreference", () => {
  const storage = (value) => ({ getItem: (key) => (key === "dm_include_desc" ? value : "wrong-key") });

  test("the URL decides when present, in either spelling, whatever storage says", () => {
    expect(readIncludeDescriptionPreference(q("desc=1"), storage(null))).toBe(true);
    expect(readIncludeDescriptionPreference(q("desc=true"), storage(null))).toBe(true);
    expect(readIncludeDescriptionPreference(q("desc=TRUE"), storage(null))).toBe(true);
    expect(readIncludeDescriptionPreference(q("includeDescription=1"), storage(null))).toBe(true);
    expect(readIncludeDescriptionPreference(q("desc=0"), storage("1"))).toBe(false);
    expect(readIncludeDescriptionPreference(q("desc=false"), storage("1"))).toBe(false);
    expect(readIncludeDescriptionPreference(q("includeDescription=no"), storage("1"))).toBe(false);
    // desc wins over the long spelling when both are present.
    expect(readIncludeDescriptionPreference(q("desc=0&includeDescription=1"), storage(null))).toBe(false);
    expect(readIncludeDescriptionPreference(q("desc=1&includeDescription=0"), storage(null))).toBe(true);
  });

  test("an empty desc defers to the long spelling", () => {
    expect(readIncludeDescriptionPreference(q("desc=&includeDescription=1"), storage(null))).toBe(true);
  });

  test("without the URL, the saved preference is used", () => {
    expect(readIncludeDescriptionPreference(q(""), storage("1"))).toBe(true);
    expect(readIncludeDescriptionPreference(q(""), storage("0"))).toBe(false);
    expect(readIncludeDescriptionPreference(q(""), storage(null))).toBe(false);
    expect(readIncludeDescriptionPreference(q(""), undefined)).toBe(false);
    expect(readIncludeDescriptionPreference(q(""), null)).toBe(false);
  });

  test("unreadable storage means off", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readIncludeDescriptionPreference(q(""), blocked)).toBe(false);
  });
});

describe("getSearchTitle", () => {
  test("names the query, the category, both, or neither", () => {
    expect(getSearchTitle({ q: "lamp" })).toBe('Results for "lamp"');
    expect(getSearchTitle({ category: "Decor" })).toBe("Results for Decor");
    expect(getSearchTitle({ q: "lamp", category: "Decor" })).toBe('Results for "lamp" Decor');
    expect(getSearchTitle({})).toBe("All Listings");
    expect(getSearchTitle({ q: "", category: "" })).toBe("All Listings");
  });
});

describe("buildSearchPayload", () => {
  test("an empty query sends nothing", () => {
    expect(buildSearchPayload(q(""), false)).toEqual({});
  });

  test("each field is copied under its own name, and only when non-empty", () => {
    expect(buildSearchPayload(q("q=a&category=b&sort=c&condition=d&location=e&minPrice=1&maxPrice=2&status=f"), false)).toEqual({
      q: "a",
      category: "b",
      sort: "c",
      condition: "d",
      location: "e",
      minPrice: "1",
      maxPrice: "2",
      status: "f",
    });
    expect(buildSearchPayload(q("q=&category=&sort="), false)).toEqual({});
  });

  test("q wins over its search alias", () => {
    expect(buildSearchPayload(q("q=a&search=b"), false).q).toBe("a");
    expect(buildSearchPayload(q("search=b"), false).q).toBe("b");
  });

  test("categories are split, trimmed, and dropped when empty", () => {
    expect(buildSearchPayload(q("categories=%20A%20,,B"), false).categories).toEqual(["A", "B"]);
    expect(buildSearchPayload(q("categories=,%20,"), false)).not.toHaveProperty("categories");
    expect(buildSearchPayload(q(""), false)).not.toHaveProperty("categories");
  });

  test("boolean flags are set only for true-like values", () => {
    expect(buildSearchPayload(q("priceNego=1"), false).priceNego).toBe(true);
    expect(buildSearchPayload(q("priceNegotiable=true"), false).priceNego).toBe(true);
    expect(buildSearchPayload(q("priceNego=0&priceNegotiable=true"), false)).not.toHaveProperty("priceNego");
    expect(buildSearchPayload(q("priceNego=no"), false)).not.toHaveProperty("priceNego");
    expect(buildSearchPayload(q(""), false)).not.toHaveProperty("priceNego");
    expect(buildSearchPayload(q("trades=true"), false).trades).toBe(true);
    expect(buildSearchPayload(q("trades=0"), false)).not.toHaveProperty("trades");
    expect(buildSearchPayload(q(""), false)).not.toHaveProperty("trades");
    expect(buildSearchPayload(q(""), true).includeDescription).toBe(true);
    expect(buildSearchPayload(q(""), false)).not.toHaveProperty("includeDescription");
  });
});

describe("readSearchFilters", () => {
  test("an empty query gives empty filters", () => {
    expect(readSearchFilters(q(""))).toEqual({
      selectedCategories: [],
      sortOrder: "",
      minPrice: "",
      maxPrice: "",
      itemLocation: "",
      itemCondition: "",
      priceNegotiable: false,
      acceptingTrades: false,
    });
  });

  test.each([
    ["old", "old"],
    ["oldest", "old"],
    ["OLD", "old"],
    ["new", "new"],
    ["newest", "new"],
    ["best", "best"],
    ["best_match", "best"],
    ["relevance", "best"],
    ["cheapest", ""],
    ["", ""],
  ])("sort=%p is %p", (sort, expected) => {
    expect(readSearchFilters(q(`sort=${sort}`)).sortOrder).toBe(expected);
  });

  test("categories merge without duplicates, in order", () => {
    expect(readSearchFilters(q("categories=A,%20B%20,,A&category=C")).selectedCategories).toEqual(["A", "B", "C"]);
    expect(readSearchFilters(q("categories=A&category=A")).selectedCategories).toEqual(["A"]);
    expect(readSearchFilters(q("category=C")).selectedCategories).toEqual(["C"]);
    expect(readSearchFilters(q("category=")).selectedCategories).toEqual([]);
  });

  test("prices are clamped to 0..9999.99 and given in ascending order", () => {
    const prices = (string) => {
      const { minPrice, maxPrice } = readSearchFilters(q(string));
      return [minPrice, maxPrice];
    };
    expect(prices("minPrice=5&maxPrice=20")).toEqual(["5", "20"]);
    expect(prices("minPrice=20&maxPrice=5")).toEqual(["5", "20"]);
    expect(prices("minPrice=-5&maxPrice=20000")).toEqual(["0", "9999.99"]);
    expect(prices("minPrice=5")).toEqual(["5", ""]);
    expect(prices("maxPrice=5")).toEqual(["", "5"]);
    expect(prices("minPrice=abc&maxPrice=5")).toEqual(["", "5"]);
    expect(prices("minPrice=&maxPrice=")).toEqual(["", ""]);
    expect(prices("minPrice=0&maxPrice=0")).toEqual(["0", "0"]);
    expect(prices("minPrice=12.50")).toEqual(["12.5", ""]);
  });

  test("location, condition and the two yes/no filters", () => {
    const filters = readSearchFilters(q("location=Ellicott&condition=Good&priceNego=1&trades=true"));
    expect(filters).toMatchObject({
      itemLocation: "Ellicott",
      itemCondition: "Good",
      priceNegotiable: true,
      acceptingTrades: true,
    });
    expect(readSearchFilters(q("priceNegotiable=1")).priceNegotiable).toBe(true);
    expect(readSearchFilters(q("priceNego=true")).priceNegotiable).toBe(true);
    expect(readSearchFilters(q("priceNego=0&priceNegotiable=1")).priceNegotiable).toBe(false);
    expect(readSearchFilters(q("priceNego=yes")).priceNegotiable).toBe(false);
    expect(readSearchFilters(q("trades=0")).acceptingTrades).toBe(false);
    expect(readSearchFilters(q("trades=yes")).acceptingTrades).toBe(false);
  });
});

describe("validateSearchPrices", () => {
  test("valid or blank values produce numbers and no error", () => {
    expect(validateSearchPrices("5", "20")).toEqual({ error: "", minPrice: 5, maxPrice: 20 });
    expect(validateSearchPrices("", "")).toEqual({ error: "", minPrice: null, maxPrice: null });
    expect(validateSearchPrices(null, null)).toEqual({ error: "", minPrice: null, maxPrice: null });
    expect(validateSearchPrices(" 5 ", "")).toEqual({ error: "", minPrice: 5, maxPrice: null });
    expect(validateSearchPrices("5", "5")).toEqual({ error: "", minPrice: 5, maxPrice: 5 });
    expect(validateSearchPrices("0", "9999.99")).toEqual({ error: "", minPrice: 0, maxPrice: 9999.99 });
  });

  test.each([
    [" ", "", "Please enter a valid minimum price"],
    [".", "", "Please enter a valid minimum price"],
    ["-", "", "Please enter a valid minimum price"],
    ["", ".", "Please enter a valid maximum price"],
    ["", "-", "Please enter a valid maximum price"],
    ["abc", "", "Minimum price must be a valid number"],
    ["", "abc", "Maximum price must be a valid number"],
    ["-1", "", "Minimum price cannot be negative"],
    ["", "-1", "Maximum price cannot be negative"],
    ["10000", "", "Minimum price cannot exceed $9999.99"],
    ["", "10000", "Maximum price cannot exceed $9999.99"],
    ["10", "2", "Minimum price cannot be greater than maximum price"],
  ])("min %p, max %p: %s", (min, max, error) => {
    expect(validateSearchPrices(min, max).error).toBe(error);
  });

  test("the maximum's problem is reported before the minimum's", () => {
    expect(validateSearchPrices("-1", "10000").error).toBe("Maximum price cannot exceed $9999.99");
  });

  test("a range error does not hide the parsed values, and the exact boundary is allowed", () => {
    expect(validateSearchPrices("10", "2")).toEqual({
      error: "Minimum price cannot be greater than maximum price",
      minPrice: 10,
      maxPrice: 2,
    });
    expect(validateSearchPrices("9999.99", "9999.99").error).toBe("");
    expect(validateSearchPrices("0", "").error).toBe("");
  });
});

describe("buildSearchUrl", () => {
  const none = {
    selectedCategories: [],
    sortOrder: "",
    minPrice: null,
    maxPrice: null,
    itemLocation: "",
    itemCondition: "",
    priceNegotiable: false,
    acceptingTrades: false,
  };

  test("no filters gives the bare listings page", () => {
    expect(buildSearchUrl({ query: q(""), filters: none })).toBe("/app/listings?");
  });

  test("the search term comes from q or its alias", () => {
    expect(buildSearchUrl({ query: q("q=desk"), filters: none })).toBe("/app/listings?search=desk");
    expect(buildSearchUrl({ query: q("search=lamp"), filters: none })).toBe("/app/listings?search=lamp");
    expect(buildSearchUrl({ query: q("q=desk&search=lamp"), filters: none })).toBe("/app/listings?search=desk");
  });

  test("only known sort orders are written", () => {
    for (const sort of ["new", "old", "best"]) {
      expect(buildSearchUrl({ query: q(""), filters: { ...none, sortOrder: sort } })).toBe(`/app/listings?sort=${sort}`);
    }
    expect(buildSearchUrl({ query: q(""), filters: { ...none, sortOrder: "cheapest" } })).toBe("/app/listings?");
  });

  test("a price of zero is kept, and a missing price is left out", () => {
    expect(buildSearchUrl({ query: q(""), filters: { ...none, minPrice: 0, maxPrice: 0 } })).toBe(
      "/app/listings?minPrice=0&maxPrice=0",
    );
    expect(buildSearchUrl({ query: q(""), filters: { ...none, maxPrice: 20 } })).toBe("/app/listings?maxPrice=20");
  });

  test("each yes/no filter and the description flag appear only when on", () => {
    expect(buildSearchUrl({ query: q(""), filters: { ...none, priceNegotiable: true } })).toBe("/app/listings?priceNego=1");
    expect(buildSearchUrl({ query: q(""), filters: { ...none, acceptingTrades: true } })).toBe("/app/listings?trades=1");
    expect(buildSearchUrl({ query: q(""), filters: none, includeDescription: true })).toBe("/app/listings?desc=1");
    expect(buildSearchUrl({ query: q(""), filters: { ...none, itemLocation: "A", itemCondition: "B" } })).toBe(
      "/app/listings?location=A&condition=B",
    );
  });
});

describe("normalizeSearchResults", () => {
  const NOW = Date.parse("2026-09-30T12:00:00Z");
  const options = { apiBase: "https://api.example.test/api", publicBase: "", now: NOW };
  const one = (result, opts = options) => normalizeSearchResults([result], opts)[0];
  const hoursAgo = (h) => new Date(NOW - h * 36e5).toISOString();

  test("accepts a bare list, an {items} wrapper, or nothing", () => {
    expect(normalizeSearchResults([{ id: 1 }], options)).toHaveLength(1);
    expect(normalizeSearchResults({ items: [{ id: 1 }, { id: 2 }] }, options)).toHaveLength(2);
    expect(normalizeSearchResults({ items: "nope" }, options)).toEqual([]);
    expect(normalizeSearchResults(null, options)).toEqual([]);
    expect(normalizeSearchResults(undefined)).toEqual([]);
    expect(normalizeSearchResults({}, options)).toEqual([]);
  });

  test("a bare record gets every default; the position stands in for a missing id", () => {
    expect(normalizeSearchResults([{}, {}], options)[1]).toEqual({
      id: 1,
      title: "Untitled",
      price: 0,
      img: null,
      seller: "Unknown Seller",
      createdAt: null,
      itemCondition: null,
      itemLocation: null,
      status: "AVAILABLE",
    });
  });

  test("id, title and price take the first available alias; a real 0 is kept", () => {
    expect(one({ id: 0, product_id: 9 }).id).toBe(0);
    expect(one({ product_id: 9 }).id).toBe(9);
    expect(one({ title: "A", product_title: "B" }).title).toBe("A");
    expect(one({ product_title: "B" }).title).toBe("B");
    expect(one({ price: 0, listing_price: 9 }).price).toBe(0);
    expect(one({ listing_price: "9.5" }).price).toBe(9.5);
    expect(one({ price: "12" }).price).toBe(12);
  });

  test("seller falls back through name aliases, then the seller id, then unknown", () => {
    expect(one({ seller: "A", seller_name: "B", sold_by: "C", seller_id: 1 }).seller).toBe("A");
    expect(one({ seller_name: "B", sold_by: "C", seller_id: 1 }).seller).toBe("B");
    expect(one({ sold_by: "C", seller_id: 1 }).seller).toBe("C");
    expect(one({ seller_id: 7 }).seller).toBe("Seller #7");
    expect(one({ seller_id: 0 }).seller).toBe("Seller #0");
    expect(one({ seller_id: null }).seller).toBe("Unknown Seller");
  });

  test("condition and location take the first available alias", () => {
    expect(one({ item_condition: "A", condition: "B" }).itemCondition).toBe("A");
    expect(one({ condition: "B" }).itemCondition).toBe("B");
    expect(one({ item_location: "A", meet_location: "B", location: "C" }).itemLocation).toBe("A");
    expect(one({ meet_location: "B", location: "C" }).itemLocation).toBe("B");
    expect(one({ location: "C" }).itemLocation).toBe("C");
  });

  test("images take the first alias and are resolved through the API", () => {
    expect(one({ image: "https://cdn.example.test/a.jpg", image_url: "/images/b.jpg" }).img).toBe(
      "https://cdn.example.test/a.jpg",
    );
    expect(one({ image_url: "https://cdn.example.test/b.jpg", photo: "/images/c.jpg" }).img).toBe(
      "https://cdn.example.test/b.jpg",
    );
    expect(one({ photo: "/images/c.jpg" }).img).toBe(
      "https://api.example.test/api/media/image.php?url=%2Fimages%2Fc.jpg",
    );
    expect(one({ photo: "uploads/d.jpg" }).img).toBe(
      "https://api.example.test/api/media/image.php?url=uploads%2Fd.jpg",
    );
    expect(one({ image: "" }).img).toBeNull();
  });

  test("dates: created_at wins, then date_listed; bad dates are null", () => {
    expect(one({ created_at: hoursAgo(1), date_listed: hoursAgo(100) }).createdAt.getTime()).toBe(NOW - 36e5);
    expect(one({ date_listed: hoursAgo(2) }).createdAt.getTime()).toBe(NOW - 2 * 36e5);
    expect(one({ created_at: "bad" }).createdAt).toBeNull();
  });

  test("status is explicit, else JUST POSTED for under 48 hours, else AVAILABLE", () => {
    expect(one({ created_at: hoursAgo(47) }).status).toBe("JUST POSTED");
    expect(one({ created_at: hoursAgo(48) }).status).toBe("AVAILABLE");
    expect(one({ created_at: hoursAgo(1), status: "SOLD" }).status).toBe("SOLD");
    expect(one({}).status).toBe("AVAILABLE");
  });

  test("the clock defaults to the current time", () => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(NOW);
    try {
      expect(normalizeSearchResults([{ created_at: hoursAgo(1) }])[0].status).toBe("JUST POSTED");
      expect(normalizeSearchResults([{ created_at: hoursAgo(72) }])[0].status).toBe("AVAILABLE");
    } finally {
      jest.useRealTimers();
    }
  });
});
