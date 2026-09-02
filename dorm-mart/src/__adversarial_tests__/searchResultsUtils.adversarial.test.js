import {
  buildSearchPayload,
  buildSearchUrl,
  normalizeSearchResults,
  readSearchFilters,
  validateSearchPrices,
} from "../pages/Search/utils/searchResultsUtils";

describe("search result normalization", () => {
  test("rejects malformed prices, dates, and image values at the API boundary", () => {
    const [item] = normalizeSearchResults(
      [
        {
          product_id: "7",
          product_title: "Desk lamp",
          listing_price: "12 dollars",
          image: { url: "/images/lamp.jpg" },
          seller_id: 3,
          created_at: "not-a-date",
        },
      ],
      { apiBase: "/api", publicBase: "", now: Date.UTC(2026, 7, 19) },
    );

    expect(item).toEqual({
      id: "7",
      title: "Desk lamp",
      price: 0,
      img: "",
      seller: "Seller #3",
      createdAt: null,
      itemCondition: null,
      itemLocation: null,
      status: "AVAILABLE",
    });
  });

  test("maps supported URL aliases to the existing backend request fields", () => {
    const query = new URLSearchParams(
      "search=lamp&category=Decor&categories=Decor,Lighting&sort=newest" +
        "&condition=Good&location=North+Campus&minPrice=5&maxPrice=20" +
        "&status=AVAILABLE&priceNegotiable=true&trades=1",
    );

    expect(buildSearchPayload(query, true)).toEqual({
      q: "lamp",
      category: "Decor",
      categories: ["Decor", "Lighting"],
      sort: "newest",
      condition: "Good",
      location: "North Campus",
      minPrice: "5",
      maxPrice: "20",
      status: "AVAILABLE",
      includeDescription: true,
      priceNego: true,
      trades: true,
    });
  });

  test("hydrates filter state from malformed and aliased URL values", () => {
    const query = new URLSearchParams(
      "categories=Books,Books,,Decor&category=Lighting&sort=relevance" +
        "&minPrice=200&maxPrice=5&location=Other&condition=Fair" +
        "&priceNegotiable=true&trades=1",
    );

    expect(readSearchFilters(query)).toEqual({
      selectedCategories: ["Books", "Decor", "Lighting"],
      sortOrder: "best",
      minPrice: "5",
      maxPrice: "200",
      itemLocation: "Other",
      itemCondition: "Fair",
      priceNegotiable: true,
      acceptingTrades: true,
    });
  });

  test.each([
    [".", "", "Please enter a valid minimum price"],
    ["-1", "", "Minimum price cannot be negative"],
    ["", "10000", "Maximum price cannot exceed $9999.99"],
    ["10", "2", "Minimum price cannot be greater than maximum price"],
  ])("validates the visible price range errors", (min, max, error) => {
    expect(validateSearchPrices(min, max).error).toBe(error);
  });

  test("builds the existing listings URL after valid filters are applied", () => {
    expect(
      buildSearchUrl({
        query: new URLSearchParams("q=desk"),
        filters: {
          selectedCategories: ["Decor", "Lighting"],
          sortOrder: "new",
          minPrice: 5,
          maxPrice: 20,
          itemLocation: "Other",
          itemCondition: "Good",
          priceNegotiable: true,
          acceptingTrades: true,
        },
        includeDescription: true,
      }),
    ).toBe(
      "/app/listings?search=desk&categories=Decor%2CLighting&sort=new" +
        "&minPrice=5&maxPrice=20&location=Other&condition=Good" +
        "&priceNego=1&trades=1&desc=1",
    );
  });
});
