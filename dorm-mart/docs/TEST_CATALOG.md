# Dorm Mart test catalog

Generated from first-party test files with `node scripts/generate-test-catalog.js` from `dorm-mart/`. Each test file is enclosed in a collapsed section with its complete source. Edit the original test file, then regenerate this document.

This is an inventory, not a test-run result. See [TESTING_AND_RELIABILITY.md](TESTING_AND_RELIABILITY.md) for execution and test-strength guidance, and [api/tests/README.md](../api/tests/README.md) for backend prerequisites.

## Commands

Run from `dorm-mart/`:

| Command | Scope |
| --- | --- |
| `npm test -- --watchAll=false` | All frontend Jest tests |
| `npm test -- --watchAll=false --runTestsByPath src/__tests__/utils/apiClient.test.js` | One frontend test file; replace the path as needed |
| `npm run test:backend` | Five offline PHP scripts named in package.json |
| `npm run test:backend:integration` | Disposable local database and HTTP purchase lifecycle |
| `npm run lint:php` | PHP syntax checks, not behavioral tests |
| `npm run test:mutation -- --mutate src/pages/Settings/userPreferencesUtils.js` | Targeted mutation audit; requires installed Stryker |

HTTP scenario scripts require a running local API and may require `API_TEST_LOGIN_EMAIL`, `API_TEST_LOGIN_PASSWORD`, and `API_TEST_BASE_URL`. Inspect them before execution: some send email or affect lockouts/data, and some report verdicts in JSON/HTML rather than a failing process exit. The Bash rate-limit script prints requests and has historical threshold comments; verify current policy in source. Its output alone is not an automated pass/fail verdict.

The XSS encoding file is a manual HTML demonstration; the router blocks direct HTTP access to `api/tests`. Do not weaken that guard to run it. `db_connection_test.php` needs the configured database. Neither is part of the five offline checks.

Excluded: vendor tests, SQL seed data, images, test support `api/tests/bootstrap.php`, and `api/payments/*webhook*test.php` (Stripe test-mode endpoint handlers).

## Inventory

### Frontend Jest tests (54 files)

<details>
<summary>src/__tests__/adversarial/apiClient.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/apiClient.adversarial.test.js)

```javascript
import {
  apiGetJson,
  apiPostJson,
  csrfPostJson,
  readApiError,
  readJsonResponse,
} from "../../utils/apiClient";
import { csrfFetch } from "../../utils/csrfFetch";

jest.mock("../../utils/csrfFetch", () => ({
  csrfFetch: jest.fn(),
}));

function response(body, init = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers || { "content-type": "application/json" }),
    text: jest.fn().mockResolvedValue(text),
  };
}

describe("apiClient adversarial boundaries", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    csrfFetch.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("readJsonResponse parses valid JSON and rejects malformed JSON deliberately", async () => {
    await expect(readJsonResponse(response({ ok: true }))).resolves.toEqual({
      ok: true,
    });
    await expect(readJsonResponse(response("{bad json"))).rejects.toThrow(
      "Invalid JSON response",
    );
  });

  test("readApiError prefers JSON error fields and falls back to non-JSON body text", async () => {
    await expect(
      readApiError(
        response({ error: "Specific failure" }, { ok: false, status: 400 }),
      ),
    ).resolves.toBe("Specific failure");

    await expect(
      readApiError(
        response("Plain failure", {
          ok: false,
          status: 500,
          headers: { "content-type": "text/plain" },
        }),
        "Fallback failure",
      ),
    ).resolves.toBe("Plain failure");
  });

  test("apiGetJson throws parsed API errors instead of leaking raw status handling", async () => {
    global.fetch.mockResolvedValueOnce(
      response({ message: "Nope" }, { ok: false, status: 403 }),
    );

    await expect(apiGetJson("/api/nope")).rejects.toThrow("Nope");
  });

  test("apiPostJson sends non-mutating JSON searches through the shared boundary", async () => {
    global.fetch.mockResolvedValueOnce(response([{ id: 7 }]));

    await expect(apiPostJson("/api/search", { q: "lamp" })).resolves.toEqual([
      { id: 7 },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ q: "lamp" }),
      }),
    );
  });

  test("csrfPostJson sends a JSON CSRF request and returns parsed JSON", async () => {
    csrfFetch.mockResolvedValueOnce(response({ success: true }));

    await expect(csrfPostJson("/api/save", { title: "Lamp" })).resolves.toEqual(
      { success: true },
    );

    expect(csrfFetch).toHaveBeenCalledWith(
      "/api/save",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title: "Lamp" }),
      }),
    );
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/csrfFetch.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/csrfFetch.adversarial.test.js)

```javascript
import { clearCsrfToken, csrfFetch } from "../../utils/csrfFetch";

function jsonResponse(body, init = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers || { "content-type": "application/json" }),
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
  response.clone = () => jsonResponse(body, init);
  return response;
}

describe("csrfFetch adversarial boundaries", () => {
  beforeEach(() => {
    clearCsrfToken();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    clearCsrfToken();
    jest.restoreAllMocks();
  });

  test("reports malformed JSON request bodies with a deliberate boundary error", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ csrf_token: "token-1" }));

    await expect(
      csrfFetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"broken"',
      }),
    ).rejects.toThrow("Invalid JSON request body");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("refreshes the CSRF token once after a mutating request is rejected for CSRF", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "stale-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "CSRF token validation failed", code: "csrf_invalid" }, { ok: false, status: 403 }),
      )
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const response = await csrfFetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lamp" }),
    });

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(global.fetch.mock.calls[1][1].body).toContain("stale-token");
    expect(global.fetch.mock.calls[3][1].body).toContain("fresh-token");
  });

  test("does not retry a 403 that is a permission denial rather than a CSRF failure", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "token-1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { ok: false, status: 403 }));

    const response = await csrfFetch("/api/moderation/ban_user.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: 7 }),
    });

    expect(response.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/formatters.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/formatters.adversarial.test.js)

```javascript
import {
  coerceNumber,
  compareDateAsc,
  compareDateDesc,
  dateTimestamp,
  parseDateValue,
} from "../../utils/formatters";

describe("formatter adversarial boundaries", () => {
  test("coerceNumber accepts currency-like numbers without extracting numbers from prose", () => {
    expect(coerceNumber("$1,234.50")).toBe(1234.5);
    expect(coerceNumber(" 99.95 ")).toBe(99.95);
    expect(coerceNumber("abc123")).toBeNull();
    expect(coerceNumber("12 dollars")).toBeNull();
    expect(coerceNumber(Infinity)).toBeNull();
  });

  test("parseDateValue returns null for invalid date-like strings", () => {
    expect(parseDateValue("not-a-date")).toBeNull();
    expect(parseDateValue(new Date("bad date"))).toBeNull();
  });

  test("date timestamp and comparators handle invalid dates without leaking NaN", () => {
    expect(dateTimestamp("not-a-date", 0)).toBe(0);
    expect(Number.isFinite(dateTimestamp("2026-01-02T00:00:00Z"))).toBe(true);

    const values = ["2026-01-02T00:00:00Z", "bad", "2026-01-01T00:00:00Z"];
    expect([...values].sort(compareDateAsc)).toEqual([
      "2026-01-01T00:00:00Z",
      "2026-01-02T00:00:00Z",
      "bad",
    ]);
    expect([...values].sort(compareDateDesc)).toEqual([
      "2026-01-02T00:00:00Z",
      "2026-01-01T00:00:00Z",
      "bad",
    ]);
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/homeFeedUtils.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/homeFeedUtils.adversarial.test.js)

```javascript
import {
  buildHomeFeed,
  getQuickFilterCategories,
  normalizeLandingItem,
} from "../../pages/Home/utils/homeFeedUtils";

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
```

</details>

<details>
<summary>src/__tests__/adversarial/imageFallback.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/imageFallback.adversarial.test.js)

```javascript
import {
  FALLBACK_IMAGE_URL,
  isVideoMediaUrl,
  resolveProductPhotoUrl,
  resolveProductPhotoUrls,
  withFallbackImage,
} from "../../utils/imageFallback";

describe("image fallback adversarial boundaries", () => {
  const apiBase = "https://api.example.test/api";

  test("does not proxy external absolute image URLs through the local PHP image endpoint", () => {
    const externalUrl = "https://cdn.example.test/products/chair.jpg";

    expect(resolveProductPhotoUrl(externalUrl, { apiBase })).toBe(externalUrl);
  });

  test("proxies absolute URLs only when their path is a locally stored image path", () => {
    expect(
      resolveProductPhotoUrl("https://app.example.test/images/chair.jpg", {
        apiBase,
      }),
    ).toBe(`${apiBase}/media/image.php?url=%2Fimages%2Fchair.jpg`);
  });

  test("drops object-shaped photo entries instead of stringifying them", () => {
    expect(
      resolveProductPhotoUrls(
        JSON.stringify(["/images/good.jpg", { url: "/images/bad.jpg" }, null]),
        { apiBase },
      ),
    ).toEqual([`${apiBase}/media/image.php?url=%2Fimages%2Fgood.jpg`]);
  });

  test("rejects executable image sources while keeping safe placeholders", () => {
    expect(withFallbackImage("javascript:alert(1)")).toBe(FALLBACK_IMAGE_URL);
    expect(withFallbackImage(" data:image/png;base64,abcd ")).toBe(
      "data:image/png;base64,abcd",
    );
  });

  test("recognizes stored and proxied product video URLs", () => {
    expect(isVideoMediaUrl("/images/item-demo.mp4")).toBe(true);
    expect(
      isVideoMediaUrl(
        `${apiBase}/media/image.php?url=%2Fimages%2Fitem-demo.webm`,
      ),
    ).toBe(true);
    expect(isVideoMediaUrl("/images/item-photo.jpg")).toBe(false);
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/numericInputKeyHandlers.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/numericInputKeyHandlers.adversarial.test.js)

```javascript
import {
  decimalNumericKeyDownHandler,
  integerNumericKeyDownHandler,
} from "../../utils/numericInputKeyHandlers";

function keyEvent(key, value = "", overrides = {}) {
  return {
    key,
    currentTarget: { value },
    preventDefault: jest.fn(),
    ...overrides,
  };
}

describe("numeric input key guards", () => {
  test("integer guard allows navigation, shortcuts, and digits while blocking signs/exponents", () => {
    const arrow = keyEvent("ArrowLeft");
    const shortcut = keyEvent("a", "", { ctrlKey: true });
    const digit = keyEvent("7");
    const exponent = keyEvent("e");
    const sign = keyEvent("-");

    integerNumericKeyDownHandler(arrow);
    integerNumericKeyDownHandler(shortcut);
    integerNumericKeyDownHandler(digit);
    integerNumericKeyDownHandler(exponent);
    integerNumericKeyDownHandler(sign);

    expect(arrow.preventDefault).not.toHaveBeenCalled();
    expect(shortcut.preventDefault).not.toHaveBeenCalled();
    expect(digit.preventDefault).not.toHaveBeenCalled();
    expect(exponent.preventDefault).toHaveBeenCalledTimes(1);
    expect(sign.preventDefault).toHaveBeenCalledTimes(1);
  });

  test("decimal guard allows one decimal separator and blocks a second", () => {
    const firstDecimal = keyEvent(".", "12");
    const secondDecimal = keyEvent(".", "12.3");
    const processKey = keyEvent("Process");

    decimalNumericKeyDownHandler(firstDecimal);
    decimalNumericKeyDownHandler(secondDecimal);
    decimalNumericKeyDownHandler(processKey);

    expect(firstDecimal.preventDefault).not.toHaveBeenCalled();
    expect(secondDecimal.preventDefault).toHaveBeenCalledTimes(1);
    expect(processKey.preventDefault).not.toHaveBeenCalled();
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/productDetails.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/productDetails.adversarial.test.js)

```javascript
import { normalizeProductDetail } from "../../utils/productDetails";

describe("product detail adversarial normalization", () => {
  test("uses canonical coercion for booleans and invalid dates", () => {
    const product = normalizeProductDetail({
      product_id: "p1",
      title: "Desk lamp",
      listing_price: "$12.50",
      trades: " TRUE ",
      price_nego: "yes",
      sold: "0",
      date_listed: "not-a-date",
      date_sold: new Date("bad date"),
    });

    expect(product.price).toBe(12.5);
    expect(product.trades).toBe(true);
    expect(product.priceNego).toBe(true);
    expect(product.sold).toBe(false);
    expect(product.dateListed).toBeNull();
    expect(product.dateSold).toBeNull();
  });

  test("does not derive blank seller usernames from malformed emails", () => {
    const product = normalizeProductDetail({
      product_id: "p2",
      seller_id: 7,
      email: "   @buffalo.edu",
    });

    expect(product.sellerName).toBe("Seller #7");
    expect(product.sellerUsername).toBeNull();
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/scheduledPurchases.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/scheduledPurchases.adversarial.test.js)

```javascript
import {
  getCardTone,
  getRequestState,
} from "../../pages/ScheduledPurchases/utils/ongoingPurchaseViewUtils";
import {
  getScheduleBucket,
  groupScheduledPurchasesByItem,
} from "../../pages/ScheduledPurchases/utils/scheduledPurchaseUtils";

describe("scheduled purchase architecture helpers", () => {
  test("status helpers prioritize confirm-state flags over raw status", () => {
    expect(getRequestState({ status: "accepted", has_completed_confirm: true })).toBe(
      "completed",
    );
    expect(
      getCardTone({ status: "accepted", has_unsuccessful_confirm: true }, true)
        .inactive,
    ).toBe(true);
  });

  test("bucket helper handles invalid and relative meeting states", () => {
    const now = Date.parse("2026-01-02T12:00:00Z");

    expect(getScheduleBucket({ status: "pending" }, now)).toBe("needsResponse");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T12:10:00Z" },
        now,
      ),
    ).toBe("upcoming");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T11:45:00Z" },
        now,
      ),
    ).toBe("active");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T12:00:00Z" },
        now,
      ),
    ).toBe("active");
    expect(
      getScheduleBucket(
        { status: "accepted", meeting_at: "2026-01-02T11:30:00Z" },
        now,
      ),
    ).toBe("past");
  });

  test("groups buyer and seller requests by item with perspective attached", () => {
    const groups = groupScheduledPurchasesByItem(
      [{ request_id: 1, inventory_product_id: 7, status: "pending", item: { title: "Lamp" } }],
      [{ request_id: 2, inventory_product_id: 7, status: "accepted", item: { title: "Lamp" } }],
      Date.parse("2026-01-02T12:00:00Z"),
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].purchases.map((request) => request.perspective)).toEqual([
      "buyer",
      "seller",
    ]);
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/schedulePurchaseFormUtils.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/schedulePurchaseFormUtils.adversarial.test.js)

```javascript
import {
  normalizeScheduleListing,
  resolveMeetLocation,
  validateNegotiatedPrice,
} from "../../pages/ScheduledPurchases/utils/schedulePurchaseFormUtils";
import { getMaxDayForMeetingMonth } from "../../pages/ScheduledPurchases/utils/scheduleDateTimeUtils";

describe("schedule purchase form utility boundaries", () => {
  test("normalizes listing booleans from mixed API shapes", () => {
    expect(
      normalizeScheduleListing({
        price_nego: "1",
        trades: "true",
      }),
    ).toEqual(
      expect.objectContaining({
        priceNegotiable: true,
        acceptTrades: true,
      }),
    );
    // Falsy and unrecognised values must come out false, not merely "not false".
    expect(
      normalizeScheduleListing({ price_nego: "maybe", trades: "0" }),
    ).toEqual(
      expect.objectContaining({ priceNegotiable: false, acceptTrades: false }),
    );
    // The camelCase field wins when both shapes are present and disagree.
    expect(
      normalizeScheduleListing({ priceNegotiable: false, price_nego: "1" })
        .priceNegotiable,
    ).toBe(false);
  });

  test("resolves custom meet location only for Other", () => {
    expect(resolveMeetLocation("Other", "  Student Union  ")).toBe(
      "Student Union",
    );
    expect(resolveMeetLocation("North Campus", "Student Union")).toBe(
      "North Campus",
    );
  });

  test("passes missing listings and blank meet locations through as null", () => {
    expect(normalizeScheduleListing(null)).toBeNull();
    expect(normalizeScheduleListing({ meet_location: "" }).meet_location).toBeNull();
    expect(normalizeScheduleListing({ meet_location: "Ellicott" }).meet_location).toBe("Ellicott");
  });

  test("accepts valid negotiated prices with no error", () => {
    expect(validateNegotiatedPrice("12.50")).toEqual({ value: 12.5, error: "" });
    expect(validateNegotiatedPrice("  12.50  ")).toEqual({ value: 12.5, error: "" });
    expect(validateNegotiatedPrice("   ")).toEqual({ value: null, error: "" });
    // The ceiling itself is allowed; only amounts above it are rejected.
    expect(validateNegotiatedPrice("9999.99")).toEqual({ value: 9999.99, error: "" });
    // Only the literal digits count as a meme: $4.20 is not "420".
    expect(validateNegotiatedPrice("4.20")).toEqual({ value: 4.2, error: "" });
  });

  test("rejects invalid negotiated prices with explicit reasons", () => {
    expect(validateNegotiatedPrice("420").error).toMatch(/meme input/);
    expect(validateNegotiatedPrice("10", { isTrade: true }).error).toMatch(
      /Cannot enter a price/,
    );
    expect(validateNegotiatedPrice("10000").error).toMatch(/9999.99/);
    expect(validateNegotiatedPrice("1abc").error).toMatch(/valid price/);
    expect(validateNegotiatedPrice("1e3").error).toMatch(/valid price/);
    expect(validateNegotiatedPrice("1.999").error).toMatch(/valid price/);
  });

  test("calculates month day limits without component-local date math", () => {
    const leapYear = new Date(2024, 0, 15);
    const commonYear = new Date(2025, 0, 15);

    expect(getMaxDayForMeetingMonth("02", leapYear)).toBe(29);
    expect(getMaxDayForMeetingMonth("02", commonYear)).toBe(28);
    expect(getMaxDayForMeetingMonth("13", commonYear)).toBe(31);
  });
});
```

</details>

<details>
<summary>src/__tests__/adversarial/searchResultsUtils.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/searchResultsUtils.adversarial.test.js)

```javascript
import {
  buildSearchPayload,
  buildSearchUrl,
  normalizeSearchResults,
  readSearchFilters,
  validateSearchPrices,
} from "../../pages/Search/utils/searchResultsUtils";

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
```

</details>

<details>
<summary>src/__tests__/adversarial/sellerDashboardUtils.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/sellerDashboardUtils.adversarial.test.js)

```javascript
import {
  calculateSummaryMetrics,
  filterListings,
  normalizeSellerListing,
  readRatingValue,
  sortListings,
} from "../../pages/SellerDashboard/utils/sellerDashboardUtils";

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
    expect(listing.image).toMatch(/\/media\/image\.php\?url=%2Fimages%2Flamp\.jpg$/);
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
      // Input order, newest-first and price-low-to-high all differ, so a sort
      // that does nothing or uses the wrong key cannot pass.
      { id: 1, status: "Sold", categories: ["Books"], createdAt: "bad", price: 5 },
      { id: 2, status: "Sold", categories: ["Books"], createdAt: "2026-01-02", price: 10 },
      { id: 4, status: "Sold", categories: ["Books"], createdAt: "2026-01-01", price: 7 },
      { id: 3, status: "Active", categories: ["Tech"], createdAt: "2026-01-03", price: 30 },
    ];

    const filtered = filterListings(listings, "Sold", "Books");
    expect(filtered.map((listing) => listing.id)).toEqual([1, 2, 4]);
    expect(sortListings(filtered, "Newest First").map((listing) => listing.id)).toEqual([2, 4, 1]);
    expect(sortListings(filtered, "Price: Low to High").map((listing) => listing.id)).toEqual([1, 4, 2]);
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
```

</details>

<details>
<summary>src/__tests__/adversarial/wishlistUtils.adversarial.test.js</summary>

[Open source](../src/__tests__/adversarial/wishlistUtils.adversarial.test.js)

```javascript
import {
  filterWishlistItems,
  getWishlistCategories,
  normalizeWishlistItems,
  selectedCategoryAfterRemoval,
} from "../../pages/Wishlist/utils/wishlistUtils";

describe("wishlist normalization", () => {
  test("normalizes API-shaped and malformed listing fields", () => {
    expect(
      normalizeWishlistItems(
        {
          success: true,
          data: [
            {
              product_id: 7,
              title: "Desk lamp",
              price: "12 dollars",
              image_url: { url: "/images/lamp.jpg" },
              categories: "Decor, Lighting",
              created_at: "not-a-date",
              seller_email: "seller@example.edu",
            },
          ],
        },
        { apiBase: "/api", publicBase: "", now: Date.UTC(2026, 7, 19) },
      ),
    ).toEqual([
      {
        id: 7,
        title: "Desk lamp",
        price: 0,
        img: "",
        tags: ["Decor", "Lighting"],
        status: "AVAILABLE",
        seller: "Unknown Seller",
        sellerUsername: "seller",
        sellerEmail: "seller@example.edu",
      },
    ]);
  });

  test("keeps category filtering stable after an item is removed", () => {
    const items = [
      { id: 1, tags: ["Decor", "Lighting"] },
      { id: 2, tags: ["Books"] },
      { id: 3, tags: null },
    ];

    expect(getWishlistCategories(items)).toEqual([
      "Books",
      "Decor",
      "Lighting",
    ]);
    expect(filterWishlistItems(items, "decor")).toEqual([items[0]]);
    expect(selectedCategoryAfterRemoval(items.slice(1), "Decor")).toBeNull();
    expect(selectedCategoryAfterRemoval(items.slice(0, 2), "Books")).toBe(
      "Books",
    );
  });
});
```

</details>

<details>
<summary>src/__tests__/context/chatContextApi.test.js</summary>

[Open source](../src/__tests__/context/chatContextApi.test.js)

```javascript
import {
  chatSendErrorMessage,
  createImageMessageApi,
  createMessageApi,
  deleteMessageApi,
  editLastMessageApi,
  envBool,
  fetchConversationApi,
  fetchConversations,
  fetchNewMessages,
  fetchUnreadMessages,
  fetchUnreadNotifications,
  tickFetchNewMessages,
  tickFetchUnreadMessages,
  upsertMessage,
} from "../../context/chatContextUtils";
import { csrfFetch } from "../../utils/csrfFetch";
import logger from "../../utils/logger";

jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));
jest.mock("../../utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const fail = (status, body) => ({ ok: false, status, json: async () => body });

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

describe("polling requests", () => {
  test.each([
    ["fetchConversations", () => fetchConversations(), /\/chat\/fetch_conversations\.php$/],
    ["fetchConversationApi", () => fetchConversationApi(42), /\/chat\/fetch_conversation\.php\?conv_id=42$/],
    ["fetchNewMessages", () => fetchNewMessages(42, 1700), /\/chat\/fetch_new_messages\.php\?conv_id=42&ts=1700$/],
    ["fetchUnreadMessages", () => fetchUnreadMessages(), /\/chat\/fetch_unread_messages\.php$/],
    [
      "fetchUnreadNotifications",
      () => fetchUnreadNotifications(),
      /\/wishlist\/fetch_unread_notifications\.php$/,
    ],
  ])("%s calls the right endpoint with the session cookie", async (_name, call, url) => {
    global.fetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;
    await call();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, options] = global.fetch.mock.calls[0];
    expect(calledUrl).toMatch(url);
    expect(options).toMatchObject({
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    expect(signal).toBeDefined();
  });

  test("the abort signal reaches fetch", async () => {
    global.fetch.mockResolvedValue(ok({}));
    const signal = new AbortController().signal;
    await fetchConversations(signal);
    expect(global.fetch.mock.calls[0][1].signal).toBe(signal);
  });

  test("a failed poll rejects with its HTTP status", async () => {
    global.fetch.mockResolvedValue(fail(503, {}));
    await expect(fetchConversations()).rejects.toThrow("HTTP 503");
  });
});

describe("editLastMessageApi and deleteMessageApi", () => {
  test("edit posts the message id and new text, and returns the updated message", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message: { message_id: 5, content: "new" } }));
    await expect(editLastMessageApi(5, "new")).resolves.toEqual({ message_id: 5, content: "new" });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/edit_last_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ message_id: 5, content: "new" });
  });

  test("delete posts only the message id and returns the response", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message_id: 5 }));
    await expect(deleteMessageApi(5)).resolves.toEqual({ success: true, message_id: 5 });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/delete_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include" });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ message_id: 5 });
  });

  test.each([
    ["edit", () => editLastMessageApi(5, "x"), "Unable to edit message"],
    ["delete", () => deleteMessageApi(5), "Unable to delete message"],
  ])("%s surfaces the server's reason, or a default", async (_name, call, fallback) => {
    csrfFetch.mockResolvedValue(fail(409, { success: false, error: "Message is locked" }));
    await expect(call()).rejects.toThrow("Message is locked");

    csrfFetch.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("not json"); } });
    await expect(call()).rejects.toThrow(fallback);

    // HTTP 200 with success:false is still a failure.
    csrfFetch.mockResolvedValue(ok({ success: false }));
    await expect(call()).rejects.toThrow(fallback);

    // HTTP error with success:true in the body is still a failure.
    csrfFetch.mockResolvedValue(fail(500, { success: true }));
    await expect(call()).rejects.toThrow(fallback);

    // HTTP 200 whose body is not JSON: the deliberate error, not a TypeError.
    csrfFetch.mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("html"); } });
    await expect(call()).rejects.toThrow(fallback);
  });
});

describe("createMessageApi", () => {
  test("posts the receiver and text, adding the conversation only when known", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;

    await createMessageApi({ receiverId: 3, convId: 9, content: "hi", signal });
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/create_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include", signal });
    expect(options.headers).toEqual({ "Content-Type": "application/json", Accept: "application/json" });
    expect(JSON.parse(options.body)).toEqual({ receiver_id: 3, content: "hi", conv_id: 9 });

    await createMessageApi({ receiverId: 3, content: "hi" });
    expect(JSON.parse(csrfFetch.mock.calls[1][1].body)).toEqual({ receiver_id: 3, content: "hi" });
  });

  test("returns the parsed response", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true, message: { message_id: 1 } }));
    await expect(createMessageApi({ receiverId: 3, content: "hi" })).resolves.toEqual({
      success: true,
      message: { message_id: 1 },
    });
  });

  test("a rejected send throws the friendly message and keeps the status", async () => {
    csrfFetch.mockResolvedValue(fail(400, { error: "content_too_long" }));
    await expect(createMessageApi({ receiverId: 3, content: "x" })).rejects.toMatchObject({
      message: chatSendErrorMessage(400, { error: "content_too_long" }),
      status: 400,
    });
    expect(chatSendErrorMessage(400, { error: "content_too_long" })).toBe("Messages can be at most 500 characters.");

    // An unreadable error body still produces the generic message.
    csrfFetch.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error("html"); } });
    await expect(createMessageApi({ receiverId: 3, content: "x" })).rejects.toMatchObject({
      message: "Your message couldn't be sent. Please try again.",
      status: 502,
    });
  });
});

describe("createImageMessageApi", () => {
  const image = new File(["bits"], "lamp.png", { type: "image/png" });

  test("uploads multipart form data without forcing a content type", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    const signal = new AbortController().signal;
    await createImageMessageApi({ receiverId: 3, convId: 9, content: "look", image, signal });

    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toMatch(/\/chat\/create_image_message\.php$/);
    expect(options).toMatchObject({ method: "POST", credentials: "include", signal });
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get("receiver_id")).toBe("3");
    expect(options.body.get("conv_id")).toBe("9");
    expect(options.body.get("content")).toBe("look");
    expect(options.body.get("image").name).toBe("lamp.png");
  });

  test("leaves out the conversation when unknown and sends an empty caption", async () => {
    csrfFetch.mockResolvedValue(ok({ success: true }));
    await createImageMessageApi({ receiverId: 3, image });
    const body = csrfFetch.mock.calls[0][1].body;
    expect(body.has("conv_id")).toBe(false);
    expect(body.get("content")).toBe("");
  });

  test("a rejected upload throws the friendly message and keeps the status", async () => {
    csrfFetch.mockResolvedValue(fail(413, null));
    await expect(createImageMessageApi({ receiverId: 3, image })).rejects.toMatchObject({
      message: "That file is too large to send.",
      status: 413,
    });
  });
});

describe("chatSendErrorMessage", () => {
  test.each([
    ["missing_fields", "Type a message before sending."],
    ["missing_image", "Choose a photo or video to send."],
    ["content_too_long", "Messages can be at most 500 characters."],
    ["file_too_large", "That file is too large to send. Videos can be up to 25 MB."],
    ["image_too_large", "Photos can be up to 2 MB."],
    ["unsupported_type", "That file type isn't supported. Send a JPG, PNG, WebP, MP4, WebM, or MOV file."],
  ])("maps the code %s", (code, message) => {
    expect(chatSendErrorMessage(400, { error: code })).toBe(message);
    expect(chatSendErrorMessage(400, { error: `  ${code}  ` })).toBe(message);
  });

  test("a rate limit without a readable message gets the generic one", () => {
    const generic = "You're sending messages too quickly. Wait a moment and try again.";
    expect(chatSendErrorMessage(429, { error: "rate_limited" })).toBe(generic);
    expect(chatSendErrorMessage(429, null)).toBe(generic);
    expect(chatSendErrorMessage(429, {})).toBe(generic);
  });

  test("offline and unreadable errors", () => {
    expect(chatSendErrorMessage(0, null)).toBe("You appear to be offline. Your message was not sent.");
    expect(chatSendErrorMessage(0, { error: "Server error" })).toBe(
      "You appear to be offline. Your message was not sent.",
    );
    expect(chatSendErrorMessage(500, { error: 12 })).toBe("Your message couldn't be sent. Please try again.");
    // A readable server sentence is kept for any other status.
    expect(chatSendErrorMessage(403, { error: "Item has been deleted." })).toBe("Item has been deleted.");
    // A one-word code is not a sentence.
    expect(chatSendErrorMessage(500, { error: "oops" })).toBe("Your message couldn't be sent. Please try again.");
  });
});

describe("tickFetchNewMessages", () => {
  const reply = (body) => global.fetch.mockResolvedValue(ok(body));

  test("normalizes messages, senders, timestamps, images and optional fields", async () => {
    reply({
      cursor_ts: "77",
      messages: [
        {
          message_id: 1,
          sender_id: "5",
          content: "mine",
          created_at: "2026-01-01T10:00:00Z",
          edited_at: "2026-01-01T10:05:00Z",
          deleted_at: "2026-01-01T10:10:00Z",
          activity_at: "2026-01-01T10:20:00Z",
          metadata: { card: "x" },
          image_url: "/img/a.png",
          raw_content: "mine raw",
        },
        { message_id: 2, sender_id: 6, created_at: "2026-01-01T11:00:00Z", metadata: '{"k":1}', image_path: "/img/b.png" },
        { message_id: 3, sender_id: 6, created_at: "2026-01-01T12:00:00Z", metadata: "{not json", imagePath: "/img/c.png" },
        { message_id: 4, sender_id: 0, content: null, created_at: "2026-01-01T13:00:00Z", edited_at: "2026-01-01T13:30:00Z" },
        { message_id: 5, sender_id: "x", created_at: "2026-01-01T14:00:00Z", raw_content: 12 },
        { message_id: 6, sender_id: -5, created_at: "2026-01-01T15:00:00Z", metadata: "" },
      ],
    });

    const { messages, cursorTs } = await tickFetchNewMessages(2, 5, 0);
    expect(cursorTs).toBe(77);
    expect(messages).toHaveLength(6);

    expect(messages[0]).toEqual({
      message_id: 1,
      sender: "me",
      content: "mine",
      ts: Date.parse("2026-01-01T10:00:00Z"),
      editedAt: Date.parse("2026-01-01T10:05:00Z"),
      deletedAt: Date.parse("2026-01-01T10:10:00Z"),
      activityTs: Date.parse("2026-01-01T10:20:00Z"),
      metadata: { card: "x" },
      image_url: "/img/a.png",
      rawContent: "mine raw",
    });

    // Other people's messages, JSON-string metadata, and the alternate image keys.
    expect(messages[1]).toMatchObject({ sender: "them", metadata: { k: 1 }, image_url: "/img/b.png", content: "" });
    expect(messages[1].editedAt).toBeNull();
    expect(messages[1].deletedAt).toBeNull();
    expect(messages[1]).not.toHaveProperty("rawContent");
    expect(messages[2]).toMatchObject({ sender: "them", metadata: null, image_url: "/img/c.png" });

    // A missing or invalid sender is never "me"; content defaults to "".
    expect(messages[3]).toMatchObject({ sender: "them", content: "" });
    expect(messages[3].activityTs).toBe(Date.parse("2026-01-01T13:30:00Z"));
    expect(messages[4].sender).toBe("them");
    expect(messages[5].sender).toBe("them");
    expect(messages[5].metadata).toBeNull();

    // Only present fields are added.
    expect(messages[2]).not.toHaveProperty("rawContent");
    expect(messages[3]).not.toHaveProperty("image_url");
    expect(messages[4]).not.toHaveProperty("rawContent");
  });

  test("defaults typing status, cursor and listing status when absent", async () => {
    reply({ messages: [] });
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toEqual({
      messages: [],
      typingStatus: { is_typing: false, typing_user_first_name: null },
      cursorTs: 0,
      conversationStatus: null,
    });
    reply(null);
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toMatchObject({ messages: [], cursorTs: 0 });
  });

  test("passes typing and listing status through", async () => {
    reply({
      messages: [],
      typing_status: { is_typing: true, typing_user_first_name: "Ava" },
      conversation_status: { product_status: "", item_deleted: 1 },
    });
    await expect(tickFetchNewMessages(2, 5, 0)).resolves.toMatchObject({
      typingStatus: { is_typing: true, typing_user_first_name: "Ava" },
      conversationStatus: { productStatus: null, itemDeleted: true },
    });
  });

  test("refuses to label senders without a valid own id, but keeps typing and cursor", async () => {
    reply({
      cursor_ts: 9,
      typing_status: { is_typing: true, typing_user_first_name: "Ava" },
      messages: [{ message_id: 1, sender_id: 5, created_at: "2026-01-01T10:00:00Z" }],
    });
    for (const badId of [0, -1, 1.5, "abc", null, undefined]) {
      logger.error.mockClear();
      await expect(tickFetchNewMessages(2, badId, 0)).resolves.toEqual({
        messages: [],
        typingStatus: { is_typing: true, typing_user_first_name: "Ava" },
        cursorTs: 9,
        conversationStatus: null,
      });
      expect(logger.error).toHaveBeenCalledTimes(1);
    }
  });

  test("asks for messages after the given timestamp", async () => {
    reply({ messages: [] });
    await tickFetchNewMessages(42, 5, 1700);
    expect(global.fetch.mock.calls[0][0]).toMatch(/fetch_new_messages\.php\?conv_id=42&ts=1700$/);
  });
});

describe("tickFetchUnreadMessages", () => {
  test("builds per-conversation counts and a total, skipping unusable rows", async () => {
    global.fetch.mockResolvedValue(
      ok({
        unreads: [
          { conv_id: "3", unread_count: "2" },
          { conv_id: 4, unread_count: 5 },
          { conv_id: 0, unread_count: 9 },
          { conv_id: -1, unread_count: 9 },
          { conv_id: 6, unread_count: 0 },
          { conv_id: 7, unread_count: -3 },
          { conv_id: 8, unread_count: "many" },
          { conv_id: "x", unread_count: 4 },
        ],
      }),
    );
    await expect(tickFetchUnreadMessages()).resolves.toEqual({ unreads: { 3: 2, 4: 5 }, total: 7 });
  });

  test("no unreads is an empty result", async () => {
    global.fetch.mockResolvedValue(ok({}));
    await expect(tickFetchUnreadMessages()).resolves.toEqual({ unreads: {}, total: 0 });
  });
});

describe("upsertMessage", () => {
  test("keeps a message without a usable id instead of merging it", () => {
    const list = [{ message_id: 0, content: "zero" }, { content: "no id" }];
    expect(upsertMessage(list, { content: "x" })).toEqual([...list, { content: "x" }]);
    expect(upsertMessage(list, undefined)).toEqual([...list, undefined]);
    expect(upsertMessage(list, { message_id: "abc" })).toHaveLength(3);
  });

  test("merges by numeric id at any position, without mutating the input", () => {
    const list = [{ message_id: 1, a: 1 }, { message_id: 2, a: 2 }, { message_id: 3, a: 3 }];
    const snapshot = JSON.parse(JSON.stringify(list));
    const next = upsertMessage(list, { message_id: 2, b: 9 });
    expect(next).toEqual([{ message_id: 1, a: 1 }, { message_id: 2, a: 2, b: 9 }, { message_id: 3, a: 3 }]);
    expect(list).toEqual(snapshot);
    expect(next).not.toBe(list);
    expect(upsertMessage(list, { message_id: 3 })[2]).toEqual({ message_id: 3, a: 3 });
  });
});

describe("envBool", () => {
  test.each([
    ["true", false, true],
    [" TRUE ", false, true],
    ["False", true, false],
    ["false", true, false],
    ["yes", true, true],
    ["yes", false, false],
    ["", true, true],
    [undefined, true, true],
    [null, true, true],
  ])("envBool(%p, %p) is %p", (value, fallback, expected) => {
    expect(envBool(value, fallback)).toBe(expected);
  });

  test("the fallback defaults to false", () => {
    expect(envBool(undefined)).toBe(false);
    expect(envBool("maybe")).toBe(false);
  });
});
```

</details>

<details>
<summary>src/__tests__/context/chatContextUtils.test.js</summary>

[Open source](../src/__tests__/context/chatContextUtils.test.js)

```javascript
import { tickFetchNewMessages, tickFetchUnreadNotifications } from "../../context/chatContextUtils";

test("returns the server polling cursor even when there are no new messages", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, messages: [], cursor_ts: 1234 }),
  });

  await expect(tickFetchNewMessages(2, 1, 1200)).resolves.toMatchObject({
    messages: [],
    cursorTs: 1234,
  });
  jest.restoreAllMocks();
});

test("returns listing status while polling even when there are no new messages", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      messages: [],
      conversation_status: { product_status: "Draft", item_deleted: false },
    }),
  });

  await expect(tickFetchNewMessages(2, 1, 1200)).resolves.toMatchObject({
    conversationStatus: { productStatus: "Draft", itemDeleted: false },
  });
  jest.restoreAllMocks();
});

describe("notification polling", () => {
  afterEach(() => jest.restoreAllMocks());

  test("returns ordered notification records and the server unread total", async () => {
    const notifications = [
      { notification_id: 9, type: "price_reduced", is_read: false },
      { notification_id: 7, type: "item_deleted", is_read: true },
    ];
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ notifications, unread_total: 1 }),
    });

    await expect(tickFetchUnreadNotifications()).resolves.toEqual({
      notifications,
      total: 1,
    });
  });

  test("uses safe defaults for malformed optional response fields", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: null, unread_total: "bad" }),
    });

    await expect(tickFetchUnreadNotifications()).resolves.toEqual({
      notifications: [],
      total: 0,
    });
  });
});
```

</details>

<details>
<summary>src/__tests__/context/chatSend.test.js</summary>

[Open source](../src/__tests__/context/chatSend.test.js)

```javascript
import {
  chatSendErrorMessage,
  tickFetchNewMessages,
  upsertMessage,
} from "../../context/chatContextUtils";

describe("chatSendErrorMessage", () => {
  it("keeps a readable server message such as a rate limit", () => {
    expect(
      chatSendErrorMessage(429, {
        error: "You are sending messages too quickly. Please wait a moment and try again.",
      }),
    ).toBe("You are sending messages too quickly. Please wait a moment and try again.");
  });

  it("keeps the closed-chat reason", () => {
    expect(
      chatSendErrorMessage(403, { error: "Item has been deleted. Cannot send messages." }),
    ).toBe("Item has been deleted. Cannot send messages.");
  });

  it("maps machine codes to sentences", () => {
    expect(chatSendErrorMessage(400, { error: "content_too_long" })).toBe(
      "Messages can be at most 500 characters.",
    );
    expect(chatSendErrorMessage(400, { error: "missing_image" })).toBe(
      "Choose a photo or video to send.",
    );
  });

  it("explains oversized uploads", () => {
    expect(chatSendErrorMessage(413, null)).toBe("That file is too large to send.");
  });

  it("falls back to a generic retry hint for opaque errors", () => {
    expect(chatSendErrorMessage(500, { error: "Server error" })).toBe(
      "Your message couldn't be sent. Please try again.",
    );
    expect(chatSendErrorMessage(502, null)).toBe(
      "Your message couldn't be sent. Please try again.",
    );
  });
});

describe("upsertMessage", () => {
  it("appends a new message", () => {
    expect(upsertMessage([{ message_id: 1 }], { message_id: 2 })).toEqual([
      { message_id: 1 },
      { message_id: 2 },
    ]);
  });

  it("replaces a message the poll already delivered instead of duplicating it", () => {
    const list = [{ message_id: 7, content: "from poll", sender: "me" }];
    const next = upsertMessage(list, { message_id: "7", content: "from POST" });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ content: "from POST", sender: "me" });
  });

  it("handles an empty conversation", () => {
    expect(upsertMessage(undefined, { message_id: 3 })).toEqual([{ message_id: 3 }]);
  });
});

test("carries the sender's uncensored text for editing", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      cursor_ts: 10,
      messages: [
        {
          message_id: 5,
          sender_id: 1,
          content: "what the ****",
          raw_content: "what the heck",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
  });

  const { messages } = await tickFetchNewMessages(2, 1, 0);
  expect(messages[0]).toMatchObject({
    content: "what the ****",
    rawContent: "what the heck",
    sender: "me",
  });
  jest.restoreAllMocks();
});
```

</details>

<details>
<summary>src/__tests__/hooks/useCategories.test.js</summary>

[Open source](../src/__tests__/hooks/useCategories.test.js)

```javascript
import { renderHook, waitFor } from "@testing-library/react";
import useCategories from "../../hooks/useCategories";

const reply = (status, body) =>
  Promise.resolve({
    ok: status < 400,
    status,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
  });

afterEach(() => jest.restoreAllMocks());

test("loads the category list", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(200, ["Books", "Kitchen"]));
  const { result } = renderHook(() => useCategories());

  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.categories).toEqual(["Books", "Kitchen"]);
  expect(result.current.error).toBeNull();
});

test("reports a response that is not a list", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(200, { ok: true }));
  const { result } = renderHook(() => useCategories());

  await waitFor(() => expect(result.current.error).toBe("Invalid categories format"));
  expect(result.current.categories).toEqual([]);
});

test("reports the server's error message", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(500, { error: "Server error" }));
  const { result } = renderHook(() => useCategories());

  await waitFor(() => expect(result.current.error).toBe("Server error"));
  expect(result.current.loading).toBe(false);
});
```

</details>

<details>
<summary>src/__tests__/pages/AccountCreation/accountCreationRequest.test.js</summary>

[Open source](../src/__tests__/pages/AccountCreation/accountCreationRequest.test.js)

```javascript
import {
  ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  applyAccountRequestLockout,
  consumeAccountRequestAttempt,
  getAccountRequestRateLimit,
  submitAccountRequest,
} from "../../../pages/AccountCreation/accountCreationRequest";

const formData = {
  firstName: "Test",
  lastName: "User",
  gradMonth: 5,
  gradYear: 2027,
  email: "test@example.com",
  terms: true,
  promos: false,
};

test("accepts the generic account-request response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: true,
  });
});

test("returns safe validation errors from an HTTP response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Invalid graduation date" }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: false,
    error: "Invalid graduation date",
  });
});

test("preserves network failures so the UI can distinguish them", async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

  await expect(submitAccountRequest(formData, fetchImpl)).rejects.toThrow(
    "Failed to fetch",
  );
});

test("sends the terms acceptance required by the backend", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });

  await submitAccountRequest(formData, fetchImpl);

  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
    terms: true,
    promos: false,
  });
});

test("recognizes backend account-request throttling without exposing email details", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ retry_after_seconds: 90 }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: false,
    rateLimited: true,
    retryAfterSeconds: 90,
    error: ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  });
});

test("blocks the browser after four account-request attempts", () => {
  const storage = {
    value: null,
    getItem: jest.fn(() => storage.value),
    setItem: jest.fn((key, value) => {
      storage.value = value;
    }),
  };
  const now = 1_000_000;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    expect(consumeAccountRequestAttempt(storage, now + attempt).allowed).toBe(true);
  }

  expect(getAccountRequestRateLimit(storage, now + 4).blocked).toBe(true);
  expect(consumeAccountRequestAttempt(storage, now + 4).allowed).toBe(false);
});

test("applies a backend lockout to browser state", () => {
  const storage = {
    value: null,
    getItem: jest.fn(() => storage.value),
    setItem: jest.fn((key, value) => {
      storage.value = value;
    }),
  };

  applyAccountRequestLockout(90, storage, 1_000_000);

  expect(getAccountRequestRateLimit(storage, 1_089_999).blocked).toBe(true);
  expect(getAccountRequestRateLimit(storage, 1_090_000).blocked).toBe(false);
});

describe("browser-side account request throttle", () => {
  const WINDOW = 10 * 60 * 1000;
  const LOCKOUT = 3 * 60 * 1000;
  const KEY = "dormMartAccountRequestRateLimit";
  const T = 5_000_000;
  const fakeStorage = (initial = null) => {
    const storage = {
      value: initial,
      getItem: jest.fn(() => storage.value),
      setItem: jest.fn((key, value) => {
        storage.key = key;
        storage.value = value;
      }),
    };
    return storage;
  };
  const saved = (storage) => JSON.parse(storage.value);

  test("the first three attempts are allowed and leave no block; the fourth starts a three-minute lockout", () => {
    const storage = fakeStorage();
    for (let i = 1; i <= 3; i += 1) {
      expect(consumeAccountRequestAttempt(storage, T + i)).toEqual({ allowed: true, blockedUntil: 0 });
      expect(getAccountRequestRateLimit(storage, T + i)).toEqual({ blocked: false, blockedUntil: 0 });
    }
    expect(consumeAccountRequestAttempt(storage, T + 4)).toEqual({ allowed: true, blockedUntil: T + 4 + LOCKOUT });
    expect(getAccountRequestRateLimit(storage, T + 5)).toEqual({ blocked: true, blockedUntil: T + 4 + LOCKOUT });
    expect(storage.key).toBe(KEY);
    expect(saved(storage)).toEqual({ attempts: 4, lastAttempt: T + 4, blockedUntil: T + 4 + LOCKOUT });
  });

  test("each attempt is recorded with its count and time", () => {
    const storage = fakeStorage();
    consumeAccountRequestAttempt(storage, T);
    expect(saved(storage)).toEqual({ attempts: 1, lastAttempt: T, blockedUntil: 0 });
    consumeAccountRequestAttempt(storage, T + 1000);
    expect(saved(storage)).toEqual({ attempts: 2, lastAttempt: T + 1000, blockedUntil: 0 });
  });

  test("while locked out, attempts are refused and nothing is rewritten", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 4, lastAttempt: T, blockedUntil: T + LOCKOUT }));
    expect(consumeAccountRequestAttempt(storage, T + 1)).toEqual({ allowed: false, blockedUntil: T + LOCKOUT });
    expect(consumeAccountRequestAttempt(storage, T + LOCKOUT - 1)).toEqual({ allowed: false, blockedUntil: T + LOCKOUT });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("the lockout ends exactly at its deadline and the count starts again", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 4, lastAttempt: T, blockedUntil: T + LOCKOUT }));
    expect(getAccountRequestRateLimit(storage, T + LOCKOUT - 1).blocked).toBe(true);
    expect(getAccountRequestRateLimit(storage, T + LOCKOUT)).toEqual({ blocked: false, blockedUntil: 0 });
    expect(consumeAccountRequestAttempt(storage, T + LOCKOUT)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(storage).attempts).toBe(1);
  });

  test("attempts older than ten minutes stop counting, exactly at the boundary", () => {
    const stale = (attempts = 3) => fakeStorage(JSON.stringify({ attempts, lastAttempt: T, blockedUntil: 0 }));

    const justInside = stale();
    consumeAccountRequestAttempt(justInside, T + WINDOW - 1);
    expect(saved(justInside).attempts).toBe(4);

    const atBoundary = stale();
    expect(consumeAccountRequestAttempt(atBoundary, T + WINDOW)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(atBoundary).attempts).toBe(1);

    const wellPast = stale();
    consumeAccountRequestAttempt(wellPast, T + 2 * WINDOW);
    expect(saved(wellPast).attempts).toBe(1);
  });

  test("a recent attempt count carries over from earlier ones", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 2, lastAttempt: T, blockedUntil: 0 }));
    consumeAccountRequestAttempt(storage, T + 1000);
    expect(saved(storage).attempts).toBe(3);
  });

  test.each([
    ["nothing saved", null],
    ["the text null", "null"],
    ["a number", "5"],
    ["a string", '"blocked"'],
    ["broken JSON", "{oops"],
    ["an empty string", ""],
  ])("saved state that is %s means a fresh start", (_label, value) => {
    const storage = fakeStorage(value);
    expect(getAccountRequestRateLimit(storage, T)).toEqual({ blocked: false, blockedUntil: 0 });
    expect(consumeAccountRequestAttempt(storage, T)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(storage).attempts).toBe(1);
  });

  test("unreadable or unwritable storage never blocks or breaks the form", () => {
    const unreadable = { getItem: () => { throw new Error("denied"); }, setItem: jest.fn() };
    expect(getAccountRequestRateLimit(unreadable, T).blocked).toBe(false);
    expect(consumeAccountRequestAttempt(unreadable, T).allowed).toBe(true);

    const unwritable = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(consumeAccountRequestAttempt(unwritable, T)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(() => applyAccountRequestLockout(60, unwritable, T)).not.toThrow();
  });

  test("without a storage argument the browser's localStorage is used", () => {
    window.localStorage.removeItem(KEY);
    consumeAccountRequestAttempt(undefined, T);
    expect(JSON.parse(window.localStorage.getItem(KEY)).attempts).toBe(1);
    for (let i = 1; i < 4; i += 1) consumeAccountRequestAttempt(undefined, T + i);
    expect(getAccountRequestRateLimit(undefined, T + 5).blocked).toBe(true);
    window.localStorage.removeItem(KEY);
  });

  test("with localStorage itself unavailable, requests are still allowed", () => {
    const spy = jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      expect(getAccountRequestRateLimit(undefined, T).blocked).toBe(false);
      expect(consumeAccountRequestAttempt(undefined, T).allowed).toBe(true);
      expect(applyAccountRequestLockout(60, undefined, T)).toBe(T + 60_000);
    } finally {
      spy.mockRestore();
    }
  });

  test("the current time is the default clock", () => {
    const storage = fakeStorage();
    const before = Date.now();
    consumeAccountRequestAttempt(storage);
    const { lastAttempt } = saved(storage);
    expect(lastAttempt).toBeGreaterThanOrEqual(before);
    expect(lastAttempt).toBeLessThanOrEqual(Date.now());
    expect(getAccountRequestRateLimit(fakeStorage()).blocked).toBe(false);
    const locked = fakeStorage();
    const until = applyAccountRequestLockout(60, locked);
    expect(until).toBeGreaterThan(Date.now());
    expect(getAccountRequestRateLimit(locked).blocked).toBe(true);
  });

  describe("applyAccountRequestLockout", () => {
    test("blocks for the number of seconds the server asked for, and records a full set of attempts", () => {
      const storage = fakeStorage();
      expect(applyAccountRequestLockout(90, storage, T)).toBe(T + 90_000);
      expect(saved(storage)).toEqual({ attempts: 4, lastAttempt: T, blockedUntil: T + 90_000 });
      expect(consumeAccountRequestAttempt(storage, T + 1).allowed).toBe(false);
    });

    test("uses three minutes when the server gave no usable number, and at least one second otherwise", () => {
      const seconds = (value) => applyAccountRequestLockout(value, fakeStorage(), T) - T;
      expect(seconds(undefined)).toBe(180_000);
      expect(seconds(null)).toBe(180_000);
      expect(seconds("abc")).toBe(180_000);
      expect(seconds(0)).toBe(180_000);
      expect(seconds("45")).toBe(45_000);
      expect(seconds(1)).toBe(1_000);
      expect(seconds(0.2)).toBe(1_000);
      expect(seconds(-30)).toBe(1_000);
    });
  });
});

describe("submitAccountRequest details", () => {
  test("posts the trimmed details as JSON to the account endpoint", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await submitAccountRequest(
      { firstName: "  Ava ", lastName: " Lee  ", gradMonth: 5, gradYear: 2027, email: "  ava@buffalo.edu ", terms: true, promos: true },
      fetchImpl,
    );
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/auth\/create_account\.php$/);
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(options.body)).toEqual({
      firstName: "Ava",
      lastName: "Lee",
      gradMonth: 5,
      gradYear: 2027,
      email: "ava@buffalo.edu",
      terms: true,
      promos: true,
    });
  });

  test("uses the global fetch when none is supplied", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    try {
      await expect(submitAccountRequest(formData)).resolves.toEqual({ accepted: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = original;
    }
  });

  test("a throttled reply falls back to three minutes when the server gives no usable wait", async () => {
    for (const payload of [{}, { retry_after_seconds: 0 }, { retry_after_seconds: "soon" }]) {
      const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => payload });
      await expect(submitAccountRequest(formData, fetchImpl)).resolves.toMatchObject({
        rateLimited: true,
        retryAfterSeconds: 180,
      });
    }
    const unreadable = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => { throw new Error("html"); } });
    await expect(submitAccountRequest(formData, unreadable)).resolves.toMatchObject({ rateLimited: true, retryAfterSeconds: 180 });
  });

  test("other failures use the server's message, or a default when there is none", async () => {
    const unreadable = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("html"); } });
    await expect(submitAccountRequest(formData, unreadable)).resolves.toEqual({
      accepted: false,
      error: "Unable to submit your request.",
    });
    const empty = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "" }) });
    await expect(submitAccountRequest(formData, empty)).resolves.toEqual({
      accepted: false,
      error: "Unable to submit your request.",
    });
  });

  test("a success is accepted even when the body is unreadable", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("empty"); } });
    await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({ accepted: true });
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Chat/components/ChatHeader.test.jsx</summary>

[Open source](../src/__tests__/pages/Chat/components/ChatHeader.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import ChatHeader from "../../../../pages/Chat/components/ChatHeader";

const baseProps = {
  activeConvId: 4,
  activeConversation: {},
  activeFirstName: "Seller",
  activeLabel: "Seller Name",
  activeLabelFirstName: "Seller",
  activeLastName: "Name",
  activeReceiverId: 2,
  clearActiveConversation: jest.fn(),
  handleProfileHeaderClick: jest.fn(),
  headerBgColor: "bg-blue-50 border-blue-200",
  isSellerPerspective: false,
  navigate: jest.fn(),
  setIsMobileList: jest.fn(),
};

test("shows contact information shared by the seller", () => {
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{
        sharedContactEmail: "seller@buffalo.edu",
        sharedContactPhone: "(716) 555-0123",
      }}
    />,
  );

  expect(screen.getByText("Seller contact")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "seller@buffalo.edu" }).getAttribute("href"),
  ).toBe("mailto:seller@buffalo.edu");
  expect(
    screen.getByRole("link", { name: "(716) 555-0123" }).getAttribute("href"),
  ).toBe("tel:7165550123");
});

test("does not render contact information when the seller has not shared it", () => {
  render(<ChatHeader {...baseProps} />);

  expect(screen.queryByText("Seller contact")).toBeNull();
});

test("shows an unavailable banner and hides View Item for a draft", () => {
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{ productId: 12, productStatus: "Draft" }}
    />,
  );

  expect(screen.getByRole("status").textContent).toContain(
    "currently unavailable",
  );
  expect(screen.queryByRole("button", { name: "View item" })).toBeNull();
});

test("gives the seller an edit and publish shortcut for a draft", () => {
  const navigate = jest.fn();
  render(
    <ChatHeader
      {...baseProps}
      activeConversation={{ productId: 12, productStatus: "Draft" }}
      isSellerPerspective
      navigate={navigate}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Edit / Publish" }));
  expect(navigate).toHaveBeenCalledWith("/app/product-listing/edit/12", {
    state: { returnTo: "/app/chat?conv=4" },
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Chat/utils/chatPageUtils.test.js</summary>

[Open source](../src/__tests__/pages/Chat/utils/chatPageUtils.test.js)

```javascript
import fmtTime, {
  buildDisplayMessages,
  parseChatMetadata,
} from "../../../../pages/Chat/utils/chatPageUtils";

test("parses chat metadata safely", () => {
  expect(parseChatMetadata('{"type":"text"}')).toEqual({ type: "text" });
  expect(parseChatMetadata({ type: "text" })).toEqual({ type: "text" });
  expect(parseChatMetadata("bad json")).toBeNull();
});

test("missing chat metadata is null, not undefined or an empty value", () => {
  for (const value of [null, undefined, "", 0, false]) {
    expect(parseChatMetadata(value)).toBeNull();
  }
  const object = { type: "text" };
  expect(parseChatMetadata(object)).toBe(object);
});

describe("fmtTime", () => {
  // Local-time dates throughout: the function compares calendar days in the
  // viewer's own zone, so these hold wherever the tests run.
  const NOW = new Date(2026, 8, 30, 15, 45, 0); // Sept 30 2026, 3:45 PM local
  beforeEach(() => {
    jest.useFakeTimers("modern");
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  test("today shows just the time", () => {
    const text = fmtTime(new Date(2026, 8, 30, 9, 5).getTime());
    expect(text).toMatch(/^0?9:05\s?AM$/i);
    expect(fmtTime(new Date(2026, 8, 30, 0, 0).getTime())).toMatch(/^12:00\s?AM$/i);
    expect(fmtTime(new Date(2026, 8, 30, 23, 59).getTime())).toMatch(/^11:59\s?PM$/i);
  });

  test("yesterday is labelled, with the time", () => {
    expect(fmtTime(new Date(2026, 8, 29, 18, 30).getTime())).toMatch(/^yesterday 0?6:30\s?PM$/i);
    expect(fmtTime(new Date(2026, 8, 29, 0, 1).getTime())).toMatch(/^yesterday 12:01\s?AM$/i);
  });

  test("yesterday works across a month boundary", () => {
    jest.setSystemTime(new Date(2026, 9, 1, 8, 0));
    expect(fmtTime(new Date(2026, 8, 30, 20, 0).getTime())).toMatch(/^yesterday 0?8:00\s?PM$/i);
  });

  test("older messages show the full date and time", () => {
    const text = fmtTime(new Date(2026, 8, 28, 14, 7).getTime());
    expect(text).not.toMatch(/yesterday/i);
    expect(text).toContain("2026");
    expect(text).toMatch(/09.28.2026|28.09.2026|2026.09.28/);
    expect(text).toMatch(/0?2:07\s?PM/i);
    // Same day, different year, is not "today".
    expect(fmtTime(new Date(2025, 8, 30, 15, 45).getTime())).toContain("2025");
    // Same day and month, different year, and the reverse: other months.
    expect(fmtTime(new Date(2026, 7, 30, 15, 45).getTime())).not.toMatch(/yesterday/i);
    expect(fmtTime(new Date(2026, 7, 30, 15, 45).getTime())).toMatch(/08.30.2026|30.08.2026|2026.08.30/);
  });
});

describe("buildDisplayMessages", () => {
  const ids = (list) => list.map((message) => message.message_id);
  const request = (id, ts, requestId) => ({
    message_id: id,
    ts,
    metadata: { type: "confirm_request", confirm_request_id: requestId },
  });
  const response = (id, ts, requestId, type = "confirm_accepted", extra = {}) => ({
    message_id: id,
    ts,
    metadata: { type, confirm_request_id: requestId, ...extra },
  });

  test("no messages gives an empty list", () => {
    expect(buildDisplayMessages({ messages: [], hasAcceptedConfirm: true, productId: 1 })).toEqual([]);
  });

  test("ordinary messages pass through, gaining parsed metadata", () => {
    const result = buildDisplayMessages({
      messages: [
        { message_id: 1, ts: 1, metadata: '{"type":"text"}' },
        { message_id: 2, ts: 2, metadata: "not json" },
        { message_id: 3, ts: 3 },
      ],
    });
    expect(ids(result)).toEqual([1, 2, 3]);
    expect(result[0].parsedMetadata).toEqual({ type: "text" });
    expect(result[1].parsedMetadata).toBeNull();
    expect(result[2].parsedMetadata).toBeNull();
  });

  test("replaces a confirm request with only its latest response", () => {
    const messages = [request(1, 1, 9), response(2, 2, 9, "confirm_denied"), response(3, 3, 9, "confirm_accepted")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([3]);
    // Same answer whatever order the messages arrive in.
    expect(ids(buildDisplayMessages({ messages: [...messages].reverse() }))).toEqual([3]);
  });

  test("a request without a response yet stays visible", () => {
    expect(ids(buildDisplayMessages({ messages: [request(1, 1, 9)] }))).toEqual([1]);
  });

  test("each confirm request is settled on its own", () => {
    const messages = [request(1, 1, 9), request(2, 2, 10), response(3, 3, 9, "confirm_denied")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2, 3]);
  });

  test("an auto-accepted answer counts, and ties keep the first response seen", () => {
    const messages = [request(1, 1, 9), response(2, 5, 9, "confirm_auto_accepted"), response(3, 5, 9, "confirm_denied")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2]);
  });

  test("a response with no timestamp yields to one that has one", () => {
    const messages = [response(1, undefined, 9, "confirm_denied"), response(2, 4, 9, "confirm_accepted")];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([2]);
    expect(ids(buildDisplayMessages({ messages: [...messages].reverse() }))).toEqual([2]);
  });

  test("a terminal status on the request itself also hides the request", () => {
    const settled = { message_id: 1, ts: 1, metadata: { type: "confirm_request", confirm_request_id: 9, confirm_purchase_status: "buyer_declined" } };
    const open = { message_id: 2, ts: 2, metadata: { type: "confirm_request", confirm_request_id: 10, confirm_purchase_status: "pending" } };
    expect(ids(buildDisplayMessages({ messages: [settled, open] }))).toEqual([2]);
    const autoAccepted = { ...settled, metadata: { ...settled.metadata, confirm_purchase_status: "auto_accepted" } };
    expect(ids(buildDisplayMessages({ messages: [autoAccepted] }))).toEqual([]);
    const buyerAccepted = { ...settled, metadata: { ...settled.metadata, confirm_purchase_status: "buyer_accepted" } };
    expect(ids(buildDisplayMessages({ messages: [buyerAccepted] }))).toEqual([]);
  });

  test("messages without a confirm id are never hidden", () => {
    const messages = [
      { message_id: 1, ts: 1, metadata: { type: "confirm_request" } },
      { message_id: 2, ts: 2, metadata: { type: "confirm_accepted" } },
      { message_id: 3, ts: 3, metadata: { type: "confirm_denied" } },
    ];
    expect(ids(buildDisplayMessages({ messages }))).toEqual([1, 2, 3]);
  });

  describe("review prompts", () => {
    const accepted = response(1, 10, 9, "confirm_accepted");
    const base = { messages: [accepted], hasAcceptedConfirm: true, productId: 12 };

    test("the review prompt lands just after the latest accepted confirmation", () => {
      const result = buildDisplayMessages({ ...base, shouldShowReviewPrompt: true });
      expect(ids(result)).toEqual([1, "review_prompt_12"]);
      expect(result[1]).toMatchObject({
        sender: "system",
        content: "",
        ts: 11,
        metadata: { type: "review_prompt" },
        parsedMetadata: { type: "review_prompt" },
      });
    });

    test("the buyer rating prompt needs a receiver and lands after the review prompt", () => {
      const both = buildDisplayMessages({
        ...base,
        shouldShowReviewPrompt: true,
        shouldShowBuyerRatingPrompt: true,
        activeReceiverId: 5,
      });
      expect(ids(both)).toEqual([1, "review_prompt_12", "buyer_rating_prompt_12_5"]);
      expect(both[2]).toMatchObject({
        sender: "system",
        content: "",
        ts: 12,
        metadata: { type: "buyer_rating_prompt" },
        parsedMetadata: { type: "buyer_rating_prompt" },
      });

      const onlyRating = buildDisplayMessages({ ...base, shouldShowBuyerRatingPrompt: true, activeReceiverId: 5 });
      expect(ids(onlyRating)).toEqual([1, "buyer_rating_prompt_12_5"]);
      expect(ids(buildDisplayMessages({ ...base, shouldShowBuyerRatingPrompt: true }))).toEqual([1]);
    });

    test("a real message sent in the same millisecond as a prompt stays above it", () => {
      const sameTimeAsReview = { message_id: 2, ts: 11 };
      const sameTimeAsRating = { message_id: 3, ts: 12 };
      const result = buildDisplayMessages({
        ...base,
        messages: [accepted, sameTimeAsRating, sameTimeAsReview],
        shouldShowReviewPrompt: true,
        shouldShowBuyerRatingPrompt: true,
        activeReceiverId: 5,
      });
      expect(ids(result)).toEqual([1, 2, "review_prompt_12", 3, "buyer_rating_prompt_12_5"]);
    });

    test("no prompts when the flags are off", () => {
      expect(ids(buildDisplayMessages(base))).toEqual([1]);
    });

    test("no prompts without an accepted confirm flag, a product, or an accepted message", () => {
      const flags = { shouldShowReviewPrompt: true, shouldShowBuyerRatingPrompt: true, activeReceiverId: 5 };
      expect(ids(buildDisplayMessages({ ...base, ...flags, hasAcceptedConfirm: false }))).toEqual([1]);
      expect(ids(buildDisplayMessages({ ...base, ...flags, productId: 0 }))).toEqual([1]);
      expect(ids(buildDisplayMessages({ ...base, ...flags, productId: undefined }))).toEqual([1]);
      const denied = [response(1, 10, 9, "confirm_denied")];
      expect(ids(buildDisplayMessages({ ...base, ...flags, messages: denied }))).toEqual([1]);
    });

    test("an accepted message with no confirm request id does not anchor a prompt", () => {
      const stray = { message_id: 1, ts: 10, metadata: { type: "confirm_accepted" } };
      const strayStatus = { message_id: 2, ts: 10, metadata: { confirm_purchase_status: "buyer_accepted" } };
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      expect(ids(buildDisplayMessages({ ...flags, messages: [stray, strayStatus] }))).toEqual([1, 2]);
    });

    test("an unsuccessful or timeless accepted message does not anchor a prompt", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const unsuccessful = response(1, 10, 9, "confirm_accepted", { is_successful: false });
      expect(ids(buildDisplayMessages({ ...flags, messages: [unsuccessful] }))).toEqual([1]);
      const timeless = response(1, 0, 9, "confirm_accepted");
      expect(ids(buildDisplayMessages({ ...flags, messages: [timeless] }))).toEqual([1]);
      const explicitlySuccessful = response(1, 10, 9, "confirm_accepted", { is_successful: true });
      expect(ids(buildDisplayMessages({ ...flags, messages: [explicitlySuccessful] }))).toEqual([1, "review_prompt_12"]);
    });

    test("the latest accepted confirmation anchors the prompt, whichever way it was accepted", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const messages = [
        response(1, 10, 9, "confirm_accepted"),
        { message_id: 2, ts: 30, metadata: { type: "confirm_request", confirm_request_id: 20, confirm_purchase_status: "auto_accepted" } },
        response(3, 20, 21, "confirm_auto_accepted"),
      ];
      const result = buildDisplayMessages({ ...flags, messages });
      // Message 2 is a settled request, so it is hidden, but its status still
      // marks the accepted moment (ts 30) the prompt hangs from.
      expect(ids(result)).toEqual([1, 3, "review_prompt_12"]);
      expect(result[result.length - 1]).toMatchObject({ message_id: "review_prompt_12", ts: 31 });

      const byStatus = [{ message_id: 1, ts: 40, metadata: { confirm_request_id: 5, confirm_purchase_status: "buyer_accepted" } }];
      expect(buildDisplayMessages({ ...flags, messages: byStatus }).pop()).toMatchObject({ ts: 41 });
    });

    test("messages are ordered by time, and a real message goes before a prompt at the same time", () => {
      const flags = { hasAcceptedConfirm: true, productId: 12, shouldShowReviewPrompt: true };
      const messages = [
        { message_id: "late", ts: 50 },
        { message_id: "same-time", ts: 11 },
        response(1, 10, 9, "confirm_accepted"),
        { message_id: "untimed" },
      ];
      expect(ids(buildDisplayMessages({ ...flags, messages }))).toEqual([
        "untimed",
        1,
        "same-time",
        "review_prompt_12",
        "late",
      ]);
      // Reversed input gives the same order.
      expect(ids(buildDisplayMessages({ ...flags, messages: [...messages].reverse() }))).toEqual([
        "untimed",
        1,
        "same-time",
        "review_prompt_12",
        "late",
      ]);
    });
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Home/utils/homeFeedUtils.test.js</summary>

[Open source](../src/__tests__/pages/Home/utils/homeFeedUtils.test.js)

```javascript
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
} from "../../../../pages/Home/utils/homeFeedUtils";
import { FALLBACK_IMAGE_URL } from "../../../../utils/imageFallback";

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
```

</details>

<details>
<summary>src/__tests__/pages/ItemDetails/components/ItemFactsPanel.test.jsx</summary>

[Open source](../src/__tests__/pages/ItemDetails/components/ItemFactsPanel.test.jsx)

```jsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ItemFactsPanel from "../../../../pages/ItemDetails/components/ItemFactsPanel";

test("renders a clickable mailto link for the seller email", () => {
  render(
    <ItemFactsPanel
      normalized={{
        itemLocation: "North Campus",
        itemCondition: "Good",
        priceNego: false,
        trades: false,
        sellerEmail: "seller@buffalo.edu",
        dateListed: "2026-01-01",
      }}
    />,
  );

  const link = screen.getByRole("link", { name: "seller@buffalo.edu" });
  expect(link).toHaveAttribute("href", "mailto:seller@buffalo.edu");
});

test("shows a placeholder instead of a link when there is no seller email", () => {
  render(
    <ItemFactsPanel
      normalized={{
        itemLocation: "North Campus",
        itemCondition: "Good",
        priceNego: false,
        trades: false,
        sellerEmail: "",
        dateListed: "2026-01-01",
      }}
    />,
  );

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
```

</details>

<details>
<summary>src/__tests__/pages/ItemDetails/components/ProductImageGallery.test.jsx</summary>

[Open source](../src/__tests__/pages/ItemDetails/components/ProductImageGallery.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductImageGallery from "../../../../pages/ItemDetails/components/ProductImageGallery";

const photoUrls = ["/first.jpg", "/second.jpg", "/third.jpg"];

function device(userAgent, maxTouchPoints = 0) {
  jest.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: maxTouchPoints });
}

afterEach(() => jest.restoreAllMocks());

test("desktop end arrows disappear, including on touch desktops", () => {
  device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 10);
  render(<ProductImageGallery photoUrls={photoUrls} title="Desk" />);
  expect(screen.queryByRole("button", { name: "Previous media" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next media" }));
  expect(screen.getByRole("button", { name: "Previous media" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next media" }));
  expect(screen.queryByRole("button", { name: "Next media" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show media 1" })).not.toBeInTheDocument();
});

test.each(["iPhone", "Android", "Macintosh"])("%s supports dots and bounded swipes", (agent) => {
  device(agent, 5);
  render(<ProductImageGallery photoUrls={photoUrls} title="Desk" />);
  const media = screen.getByAltText("Desk");
  const swipe = (x, y = 100) => {
    fireEvent.touchStart(media, { touches: [{ clientX: 150, clientY: 100 }] });
    fireEvent.touchEnd(media, { changedTouches: [{ clientX: x, clientY: y }] });
  };
  expect(screen.queryByRole("button", { name: "Next media" })).not.toBeInTheDocument();
  swipe(250);
  expect(media).toHaveAttribute("src", "/first.jpg");
  swipe(50, 300);
  expect(media).toHaveAttribute("src", "/first.jpg");
  swipe(50);
  expect(media).toHaveAttribute("src", "/second.jpg");
  expect(screen.getByRole("button", { name: "Show media 2" })).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("button", { name: "Show media 2" }).firstChild).toHaveClass("bg-blue-600");
  fireEvent.click(screen.getByRole("button", { name: "Show media 3" }));
  swipe(50);
  expect(media).toHaveAttribute("src", "/third.jpg");
  swipe(250);
  expect(media).toHaveAttribute("src", "/second.jpg");
});

test("single image has no navigation", () => {
  device("iPhone", 5);
  render(<ProductImageGallery photoUrls={[photoUrls[0]]} title="Desk" />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("videos use the site-styled player instead of native controls", () => {
  device("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
  const play = jest.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  render(<ProductImageGallery photoUrls={["/clip.mp4", "/first.jpg"]} title="Desk" />);
  const video = screen.getByLabelText("Desk");
  expect(video.tagName).toBe("VIDEO");
  expect(video).not.toHaveAttribute("controls");
  expect(screen.getByRole("slider", { name: "Seek video" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Play video" })[0]);
  expect(play).toHaveBeenCalled();
});
```

</details>

<details>
<summary>src/__tests__/pages/ItemDetails/components/ReportListingButton.test.jsx</summary>

[Open source](../src/__tests__/pages/ItemDetails/components/ReportListingButton.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReportListingButton from "../../../../pages/ItemDetails/components/ReportListingButton";
import { csrfPostJson } from "../../../../utils/apiClient";

jest.mock("../../../../utils/apiClient", () => ({ csrfPostJson: jest.fn() }));

beforeEach(() => jest.spyOn(window, "scrollTo").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());
afterEach(() => jest.clearAllMocks());

function openDialog() {
  render(<ReportListingButton productId={12} title="Mini fridge" />);
  fireEvent.click(screen.getByRole("button", { name: "Report this listing" }));
  return screen.getByRole("dialog");
}

test("locks background scrolling while open and restores it on close", () => {
  const previousBodyOverflow = document.body.style.overflow;
  const previousRootOverflow = document.documentElement.style.overflow;
  openDialog();

  expect(document.body.style.overflow).toBe("hidden");
  expect(document.documentElement.style.overflow).toBe("hidden");

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe(previousBodyOverflow);
  expect(document.documentElement.style.overflow).toBe(previousRootOverflow);
});

test("submits a preset reason with optional details", async () => {
  csrfPostJson.mockResolvedValue({ success: true, report_id: 1 });
  openDialog();

  const submit = screen.getByRole("button", { name: "Submit report" });
  expect(submit).toBeDisabled();

  fireEvent.click(screen.getByLabelText("Scam or fraud"));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Wants Venmo up front  " } });
  fireEvent.click(submit);

  expect(await screen.findByText("Thanks for letting us know")).toBeInTheDocument();
  expect(csrfPostJson).toHaveBeenCalledWith(
    expect.stringContaining("/moderation/report_listing.php"),
    { product_id: 12, reason: "scam", details: "Wants Venmo up front" },
  );
});

test("'Something else' requires a description", () => {
  openDialog();
  fireEvent.click(screen.getByLabelText("Something else"));
  expect(screen.getByRole("button", { name: "Submit report" })).toBeDisabled();

  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Selling a lease, not an item" } });
  expect(screen.getByRole("button", { name: "Submit report" })).toBeEnabled();
});

test("shows the server's error and keeps the form open", async () => {
  csrfPostJson.mockRejectedValue(new Error("You cannot report your own listing"));
  openDialog();
  fireEvent.click(screen.getByLabelText("Spam or duplicate listing"));
  fireEvent.click(screen.getByRole("button", { name: "Submit report" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("You cannot report your own listing");
  expect(screen.getByRole("button", { name: "Submit report" })).toBeInTheDocument();
});
```

</details>

<details>
<summary>src/__tests__/pages/ItemForms/components/ListingActions.test.jsx</summary>

[Open source](../src/__tests__/pages/ItemForms/components/ListingActions.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import ListingActions from "../../../../pages/ItemForms/components/ListingActions";

const baseProps = {
  atListingCap: false,
  catFetchError: null,
  catLoading: false,
  isEdit: false,
  isNew: true,
  loadingExisting: false,
  listingStatus: null,
  location: { state: null },
  navigate: jest.fn(),
  publishListing: jest.fn(),
  saveDraft: jest.fn(),
  submitting: false,
};

test("publishes a completed draft from the edit form", () => {
  const publishListing = jest.fn();
  render(
    <ListingActions
      {...baseProps}
      isEdit
      isNew={false}
      listingStatus="Draft"
      publishListing={publishListing}
    />,
  );

  const publishButton = screen.getByRole("button", {
    name: "Publish Listing",
  });
  expect(publishButton.disabled).toBe(false);
  fireEvent.click(publishButton);
  expect(publishListing).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Save as Draft" }).disabled,
  ).toBe(false);
});

test("still allows saving a draft at the active listing limit", () => {
  render(<ListingActions {...baseProps} atListingCap />);

  expect(
    screen.getByRole("button", { name: "Listing Limit Reached" }).disabled,
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Save as Draft" }).disabled,
  ).toBe(false);
});
```

</details>

<details>
<summary>src/__tests__/pages/ItemForms/utils/listingFormConfig.test.js</summary>

[Open source](../src/__tests__/pages/ItemForms/utils/listingFormConfig.test.js)

```javascript
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
  CATEGORIES_MAX,
  DEFAULT_FORM,
  getPreviewBoxSize,
  hasListingPhoto,
  isAllowedListingMedia,
  isListingVideo,
  LIMITS,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  PRICE_INPUT_PATTERN,
} from "../../../../pages/ItemForms/utils/listingFormConfig";
import { MAX_LISTING_PRICE } from "../../../../utils/priceValidation";

test("requires an image instead of accepting a video-only listing", () => {
  expect(hasListingPhoto([{ type: "video" }])).toBe(false);
  expect(hasListingPhoto([{ type: "video" }, { type: "image" }])).toBe(true);
});

test("keeps the combined listing media limit at six", () => {
  expect(LIMITS.images).toBe(6);
});

test("recognizes listing media by MIME type or file extension", () => {
  expect(isAllowedListingMedia({ type: "image/webp" })).toBe(true);
  expect(isAllowedListingMedia({ name: "clip.MOV" })).toBe(true);
  expect(isAllowedListingMedia({ name: "notes.txt" })).toBe(false);
  expect(isListingVideo({ name: "clip.webm" })).toBe(true);
  expect(isListingVideo({ type: "image/png" })).toBe(false);
});

test("the media limits and the accepted formats are exactly the documented ones", () => {
  expect(CATEGORIES_MAX).toBe(3);
  expect(MAX_IMAGE_BYTES).toBe(2 * 1024 * 1024);
  expect(MAX_VIDEO_BYTES).toBe(25 * 1024 * 1024);
  expect([...ALLOWED_IMAGE_MIME_TYPES].sort()).toEqual(["image/jpeg", "image/png", "image/webp"]);
  expect([...ALLOWED_IMAGE_EXTENSIONS].sort()).toEqual([".jpeg", ".jpg", ".png", ".webp"]);
  expect([...ALLOWED_VIDEO_MIME_TYPES].sort()).toEqual(["video/mp4", "video/quicktime", "video/webm"]);
  expect([...ALLOWED_VIDEO_EXTENSIONS].sort()).toEqual([".mov", ".mp4", ".webm"]);
  expect(LIMITS).toEqual({
    title: 50,
    description: 1000,
    price: MAX_LISTING_PRICE,
    priceMin: 0.01,
    images: 6,
    maxActiveListings: 25,
  });
});

test("a new listing form starts empty and unchecked", () => {
  expect(DEFAULT_FORM).toEqual({
    title: "",
    categories: [],
    itemLocation: "",
    condition: "",
    description: "",
    price: "",
    acceptTrades: false,
    priceNegotiable: false,
    images: [],
  });
});

test("the price box accepts up to four whole digits and two decimals while typing", () => {
  for (const value of ["", "1", "9999", ".", "12.", ".5", "12.34", "9999.99"]) {
    expect(PRICE_INPUT_PATTERN.test(value)).toBe(true);
  }
  for (const value of ["12345", "1.234", "-1", "1e3", "a", " 1", "1 ", "1.2.3"]) {
    expect(PRICE_INPUT_PATTERN.test(value)).toBe(false);
  }
});

test("a listing photo must be an actual image entry", () => {
  expect(hasListingPhoto([])).toBe(false);
  expect(hasListingPhoto([{ type: "image" }])).toBe(true);
  expect(hasListingPhoto([null, undefined, {}])).toBe(false);
  expect(hasListingPhoto(null)).toBe(false);
  expect(hasListingPhoto(undefined)).toBe(false);
  expect(hasListingPhoto("image")).toBe(false);
});

describe("media type detection", () => {
  test.each([
    ["image/jpeg", true],
    ["image/png", true],
    ["image/webp", true],
    ["video/mp4", true],
    ["video/webm", true],
    ["video/quicktime", true],
    ["image/gif", false],
    ["application/pdf", false],
  ])("a file typed %s is allowed: %s", (type, allowed) => {
    expect(isAllowedListingMedia({ type })).toBe(allowed);
  });

  test("the MIME type wins over the file name when both are present", () => {
    expect(isAllowedListingMedia({ type: "application/pdf", name: "photo.jpg" })).toBe(false);
    expect(isAllowedListingMedia({ type: "image/png", name: "notes.txt" })).toBe(true);
    expect(isListingVideo({ type: "image/png", name: "clip.mp4" })).toBe(false);
    expect(isListingVideo({ type: "video/mp4", name: "clip.txt" })).toBe(true);
  });

  test.each(["a.jpg", "a.JPEG", "a.png", "a.webp", "a.mp4", "a.WEBM", "a.mov", "my.photo.v2.jpg"])(
    "an untyped file named %s is allowed",
    (name) => {
      expect(isAllowedListingMedia({ name })).toBe(true);
    },
  );

  test.each(["a.gif", "a.txt", "jpg", "a.jpg.exe", "", "a.", ".jpg.bak"])("an untyped file named %p is not", (name) => {
    expect(isAllowedListingMedia({ name })).toBe(false);
  });

  test("a file with neither type nor name, or nothing at all, is not allowed", () => {
    for (const file of [{}, null, undefined, { name: "" }, { type: "" }]) {
      expect(isAllowedListingMedia(file)).toBe(false);
      expect(isListingVideo(file)).toBe(false);
    }
  });

  test("videos are recognised by MIME type or, when untyped, by extension only", () => {
    expect(isListingVideo({ type: "video/quicktime" })).toBe(true);
    expect(isListingVideo({ name: "a.MP4" })).toBe(true);
    expect(isListingVideo({ name: "a.mov" })).toBe(true);
    expect(isListingVideo({ name: "a.jpg" })).toBe(false);
    expect(isListingVideo({ name: "a.mp4.jpg" })).toBe(false);
  });
});

describe("getPreviewBoxSize", () => {
  const original = window.innerWidth;
  const at = (width) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    return getPreviewBoxSize();
  };
  afterEach(() => at(original));

  test("desktop windows use the full 480px box", () => {
    expect(at(768)).toBe(480);
    expect(at(1440)).toBe(480);
  });

  test("phones shrink the box to leave an 80px margin, never above 480", () => {
    expect(at(767)).toBe(480);
    expect(at(360)).toBe(280);
    expect(at(500)).toBe(420);
    expect(at(600)).toBe(480);
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Legal/LegalDocumentPage.test.jsx</summary>

[Open source](../src/__tests__/pages/Legal/LegalDocumentPage.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import LegalDocumentPage, { sectionId } from "../../../pages/Legal/LegalDocumentPage";
import { legalDocuments } from "../../../pages/Legal/legalDocuments";

const mockNavigate = jest.fn();
jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  }),
  { virtual: true },
);

describe("LegalDocumentPage", () => {
  test("sets the tab title and restores it on unmount", () => {
    document.title = "Dorm Mart";
    const { unmount } = render(<LegalDocumentPage documentKey="privacy" />);
    expect(document.title).toBe("Privacy Policy | Dorm Mart");
    unmount();
    expect(document.title).toBe("Dorm Mart");
  });

  test("lists every section in the table of contents", () => {
    render(<LegalDocumentPage documentKey="terms" />);
    const nav = screen.getByRole("navigation", { name: "Contents" });
    const sections = legalDocuments.terms.sections;
    expect(nav.querySelectorAll("li")).toHaveLength(sections.length);
    expect(document.getElementById(sectionId(sections[0].title))).toBeInTheDocument();
  });

  test("offers a PDF download through the print dialog", () => {
    const print = jest.spyOn(window, "print").mockImplementation(() => {});
    render(<LegalDocumentPage documentKey="privacy" />);
    fireEvent.click(screen.getByRole("button", { name: /download or print/i }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  test("shows a message instead of crashing for an unknown document", () => {
    render(<LegalDocumentPage documentKey="nope" />);
    expect(screen.getByText(/could not be found/i)).toBeInTheDocument();
  });

  test("policy text matches how account deletion actually works", () => {
    const text = JSON.stringify(legalDocuments);
    expect(text).not.toMatch(/DELETE MY ACCOUNT/);
    expect(text).toMatch(/typing your account email/);
  });
});

test("section ids are stable slugs", () => {
  expect(sectionId("1. What this covers")).toBe("legal-1-what-this-covers");
});
```

</details>

<details>
<summary>src/__tests__/pages/Legal/SafetySummaryPage.test.jsx</summary>

[Open source](../src/__tests__/pages/Legal/SafetySummaryPage.test.jsx)

```jsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SafetySummaryPage from "../../../pages/Legal/SafetySummaryPage";
import { apiGetJson } from "../../../utils/apiClient";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("../../../utils/apiClient", () => ({ apiGetJson: jest.fn() }));

const summary = {
  message_reports: { total: 12, open: 1, action_taken: 7, dismissed: 4 },
  listing_reports: {
    total: 5,
    open: 2,
    listings_removed: 2,
    dismissed: 1,
    top_reasons: [{ reason: "Scam or fraud", count: 3 }],
  },
  response_time: { window_days: 90, reports_handled: 14, avg_hours_to_decision: 5.2 },
  banned_accounts: 2,
  flagged_messages: 9,
  generated_at: "2026-09-27T12:00:00Z",
};

test("shows anonymous safety totals", async () => {
  apiGetJson.mockResolvedValue({ success: true, data: summary });
  render(<SafetySummaryPage />);

  expect(await screen.findByText("5 hours")).toBeInTheDocument();
  expect(screen.getByText("Scam or fraud: 3")).toBeInTheDocument();
  // Open reports from both queues are summed.
  expect(screen.getByText("Reports waiting for review").nextSibling).toHaveTextContent("3");
  expect(document.title).toBe("Safety at Dorm Mart");
});

test("explains when the numbers can't load", async () => {
  apiGetJson.mockRejectedValue(new Error("offline"));
  render(<SafetySummaryPage />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be loaded/i);
});
```

</details>

<details>
<summary>src/__tests__/pages/LoginPage.test.jsx</summary>

[Open source](../src/__tests__/pages/LoginPage.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import LoginPage from "../../pages/LoginPage";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));
jest.mock("../../hooks/useEmailPolicy", () => ({
  useEmailPolicy: () => ({ allowAllEmails: true, emailPolicyLoading: false }),
}));

test("does not replace the email field value with pasted text", () => {
  render(<LoginPage />);

  const emailInput = screen.getByRole("textbox");
  fireEvent.change(emailInput, { target: { value: "sameer" } });

  fireEvent.paste(emailInput, {
    clipboardData: { getData: () => "@buffalo.edu" },
  });

  expect(emailInput).toHaveProperty("value", "sameer");
});

test("labels the sign-in fields for assistive technology", () => {
  render(<LoginPage />);
  expect(screen.getByLabelText("University Email Address")).toHaveProperty("type", "email");
  expect(screen.getByLabelText("Password")).toHaveProperty("type", "password");
});

test("lets the user leave the verification-code step", async () => {
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, requires_two_factor: true, email: "s***@buffalo.edu" }),
  });
  render(<LoginPage />);

  fireEvent.change(screen.getByLabelText("University Email Address"), {
    target: { value: "sameer@buffalo.edu" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Login" }));

  expect(await screen.findByLabelText("Verification code")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /sign in again or use a different account/i }));

  expect(screen.getByLabelText("University Email Address")).toBeTruthy();
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  global.fetch.mockRestore();
});
```

</details>

<details>
<summary>src/__tests__/pages/Moderator/ModeratorDashboard.test.jsx</summary>

[Open source](../src/__tests__/pages/Moderator/ModeratorDashboard.test.jsx)

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ModeratorDashboard from "../../../pages/Moderator/ModeratorDashboard.jsx";

jest.mock("react-router-dom", () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock("../../../utils/csrfFetch.js", () => ({ csrfFetch: jest.fn() }));
// eslint-disable-next-line import/first
import { csrfFetch } from "../../../utils/csrfFetch.js";

describe("ModeratorDashboard", () => {
  afterEach(() => jest.restoreAllMocks());

  test("shows moderation stats and uncensored flagged content", async () => {
    jest.spyOn(global, "fetch").mockImplementation((url) => {
      const body = String(url).includes("profanity_words")
        ? { success: true, words: ["blockedword"] }
        : {
            success: true,
            stats: { flagged_messages: 1, open_reports: 0, total_reports: 0, banned_users: 0 },
            reports: [],
            flagged_messages: [{
              message_id: 9,
              conv_id: 4,
              sender_id: 2,
              sender_fname: "Test User",
              sender_email: "test@buffalo.edu",
              sender_role: "user",
              sender_is_banned: 0,
              content: "raw blockedword message",
              created_at: "2026-08-14T12:00:00Z",
            }],
          };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });

    render(<ModeratorDashboard />);

    expect(await screen.findByText("raw blockedword message")).toBeInTheDocument();
    expect(screen.getByText("Flagged messages").nextSibling).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms of Service" })).toBeInTheDocument();
  });

  test("removes a reported listing with the moderator's chosen reason and note", async () => {
    jest.spyOn(global, "fetch").mockImplementation((url) => {
      const body = String(url).includes("profanity_words")
        ? { success: true, words: [] }
        : {
            success: true,
            stats: { flagged_messages: 0, open_reports: 0, total_reports: 0, banned_users: 0, open_listing_reports: 2 },
            reports: [],
            flagged_messages: [],
            listing_reports: [{
              report_id: 5,
              product_id: 12,
              seller_id: 3,
              listing_title: "Mini fridge",
              reason: "scam",
              details: "Asked me to pay outside the app",
              status: "open",
              created_at: "2026-09-20T12:00:00Z",
              item_status: "Active",
              listing_price: 40,
              open_reports_for_listing: 2,
              seller_name: "Sam Seller",
              seller_role: "user",
              seller_is_banned: 0,
              reporter_name: "Rita Reporter",
            }],
          };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    });
    csrfFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });

    render(<ModeratorDashboard />);

    expect(await screen.findByRole("link", { name: "Mini fridge" })).toHaveAttribute("href", "/app/viewProduct/12");
    expect(screen.getByText("Asked me to pay outside the app")).toBeInTheDocument();
    expect(screen.getByText("+1 other open report")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Reason shown to seller"), { target: { value: "prohibited" } });
    fireEvent.change(screen.getByPlaceholderText("Optional note to the seller"), { target: { value: "  No weapons  " } });
    fireEvent.click(screen.getByRole("button", { name: "Remove listing" }));
    // Confirmed in the in-page dialog instead of window.confirm.
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));

    await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toContain("/moderation/resolve_listing_report.php");
    expect(JSON.parse(options.body)).toEqual({
      report_id: 5,
      action: "remove",
      removal_reason: "prohibited",
      note: "No weapons",
    });
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Notification/NotificationPage.test.jsx</summary>

[Open source](../src/__tests__/pages/Notification/NotificationPage.test.jsx)

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotificationPage, {
  formatNotificationTime,
  isSafeNotificationDestination,
} from "../../../pages/Notification/NotificationPage";
import { ChatContext } from "../../../context/ChatContext";
import { csrfFetch } from "../../../utils/csrfFetch";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock("../../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

test("only allows internal app notification destinations", () => {
  expect(isSafeNotificationDestination("/app/viewProduct/4")).toBe(true);
  expect(isSafeNotificationDestination("https://evil.example/phish")).toBe(false);
  expect(isSafeNotificationDestination("//evil.example/phish")).toBe(false);
  expect(isSafeNotificationDestination("javascript:alert(1)")).toBe(false);
});

test("marks an unread notification as read before opening it", async () => {
  const markNotificationReadLocal = jest.fn();
  csrfFetch.mockResolvedValue({ ok: true });

  render(
    <ChatContext.Provider value={{
      unreadNotificationsByProduct: [{
        notification_id: 12,
        title: "Price reduced",
        message: "A saved item is cheaper.",
        destination: "/app/viewProduct/4",
        severity: "success",
        is_read: false,
        created_at: "2026-08-14T12:00:00Z",
      }],
      markNotificationReadLocal,
    }}>
      <NotificationPage />
    </ChatContext.Provider>,
  );

  fireEvent.click(screen.getByRole("button", { name: /^price reduced/i }));

  await waitFor(() => expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("mark_item_read.php"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ notification_id: 12 }),
    }),
  ));
  expect(markNotificationReadLocal).toHaveBeenCalledWith(12);
  expect(mockNavigate).toHaveBeenCalledWith("/app/viewProduct/4");
});

function renderWith(value) {
  return render(
    <ChatContext.Provider value={value}>
      <NotificationPage />
    </ChatContext.Provider>,
  );
}

const soldNotice = {
  notification_id: 30,
  title: "Desk lamp sold",
  message: "An item on your wishlist sold.",
  destination: null,
  severity: "info",
  is_read: false,
  created_at: "2026-08-14T12:00:00Z",
};

test("a notification without a link can still be marked read", async () => {
  csrfFetch.mockReset();
  mockNavigate.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const markNotificationReadLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], markNotificationReadLocal });

  fireEvent.click(screen.getByRole("button", { name: /^desk lamp sold/i }));

  await waitFor(() => expect(markNotificationReadLocal).toHaveBeenCalledWith(30));
  expect(mockNavigate).not.toHaveBeenCalled();
});

test("mark all read calls the endpoint and updates local state", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const markAllNotificationsReadLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], markAllNotificationsReadLocal });

  fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));

  await waitFor(() => expect(markAllNotificationsReadLocal).toHaveBeenCalled());
  expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("mark_all_items_read.php"),
    expect.objectContaining({ method: "POST" }),
  );
});

test("clear all asks for confirmation first", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: true });
  const clearNotificationsLocal = jest.fn();
  renderWith({ unreadNotificationsByProduct: [soldNotice], clearNotificationsLocal });

  fireEvent.click(screen.getByRole("button", { name: "Clear All" }));
  expect(csrfFetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Delete all" }));

  await waitFor(() => expect(clearNotificationsLocal).toHaveBeenCalled());
});

test("a failed delete shows an inline error instead of an alert", async () => {
  csrfFetch.mockReset();
  csrfFetch.mockResolvedValue({ ok: false, status: 500 });
  renderWith({ unreadNotificationsByProduct: [soldNotice], removeNotificationLocal: jest.fn() });

  fireEvent.click(screen.getByRole("button", { name: /delete notification: desk lamp sold/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t delete/i);
});

test("shows a loading state instead of the empty state before the first fetch", () => {
  renderWith({ unreadNotificationsByProduct: [], notificationsStatus: "loading" });
  expect(screen.getByText(/loading notifications/i)).toBeInTheDocument();
  expect(screen.queryByText(/you have no notifications/i)).not.toBeInTheDocument();
});

test("treats timestamps as UTC whatever shape they arrive in", () => {
  const iso = formatNotificationTime("2026-08-14T12:00:00Z");
  expect(formatNotificationTime("2026-08-14 12:00:00")).toBe(iso);
  expect(iso).toBe(new Date(Date.UTC(2026, 7, 14, 12)).toLocaleString());
  expect(formatNotificationTime("not a date")).toBe("");
  expect(formatNotificationTime(null)).toBe("");
});
```

</details>

<details>
<summary>src/__tests__/pages/Reviews/components/ReviewVideo.test.jsx</summary>

[Open source](../src/__tests__/pages/Reviews/components/ReviewVideo.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import ReviewVideo from "../../../../pages/Reviews/components/ReviewVideo";

beforeEach(() => {
  jest.spyOn(window, "scrollTo").mockImplementation(() => {});
  jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("opens a review video popup and removes the player on close", () => {
  const { container } = render(<ReviewVideo url="/media/review-images/review_u2_test.webm" />);
  expect(container.querySelector("video")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Play review video" }));
  expect(screen.getByRole("dialog", { name: "Review video" })).toBeTruthy();
  expect(container.querySelector("video").src).toContain("media/image.php?url=");
  fireEvent.click(screen.getByRole("button", { name: "Close video" }));
  expect(container.querySelector("video")).toBeNull();
});

test("Escape closes the popup and returns focus to its opener", () => {
  render(<ReviewVideo url="/media/review-images/review_u2_test.webm" />);
  const opener = screen.getByRole("button", { name: "Play review video" });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});
```

</details>

<details>
<summary>src/__tests__/pages/ScheduledPurchases/components/BucketSection.test.jsx</summary>

[Open source](../src/__tests__/pages/ScheduledPurchases/components/BucketSection.test.jsx)

```jsx
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import BucketSection from "../../../../pages/ScheduledPurchases/components/BucketSection";

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, ...props }) => {
      const anchorProps = { ...props };
      delete anchorProps.state;
      return (
        <a href={to} {...anchorProps}>
          {children}
        </a>
      );
    },
  }),
  { virtual: true },
);

const purchaseCardProps = {
  actionError: "",
  busyRequestId: 0,
  onAction: jest.fn(),
  onCancel: jest.fn(),
  onOpenPurchaseHistory: jest.fn(),
};

function renderSection(request, bucketKey) {
  render(
    <BucketSection
      title="Purchases"
      bucketKey={bucketKey}
      groupedByItem={[
        {
          productId: 42,
          item: { title: "Desk Lamp", photos: [] },
          buckets: { [bucketKey]: [request] },
        },
      ]}
      purchaseCardProps={purchaseCardProps}
    />,
  );
}

test("links a completed purchase image and title to its receipt", () => {
  renderSection(
    {
      request_id: 7,
      inventory_product_id: 42,
      perspective: "buyer",
      status: "accepted",
      has_completed_confirm: true,
      has_unsuccessful_confirm: false,
      item: {},
    },
    "past",
  );

  expect(screen.getByRole("link", { name: "Desk Lamp" })).toHaveAttribute(
    "href",
    "/app/viewReceipt?id=42",
  );
});

test("keeps an incomplete purchase image and title non-clickable", () => {
  renderSection(
    {
      request_id: 8,
      inventory_product_id: 42,
      perspective: "buyer",
      status: "pending",
      has_completed_confirm: false,
      has_unsuccessful_confirm: false,
      item: {},
    },
    "upcoming",
  );

  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
```

</details>

<details>
<summary>src/__tests__/pages/ScheduledPurchases/utils/ongoingPurchaseViewUtils.test.js</summary>

[Open source](../src/__tests__/pages/ScheduledPurchases/utils/ongoingPurchaseViewUtils.test.js)

```javascript
import {
  BADGE_BASE,
  CARD_TONES,
  formatPersonName,
  formatPurchaseDateTime,
  getCardTone,
  getRequestState,
  getStatusBadgeClass,
  getStatusLabel,
} from "../../../../pages/ScheduledPurchases/utils/ongoingPurchaseViewUtils";
import { formatDateTime } from "../../../../utils/formatters";

// These check which style entry a request gets, not the CSS text inside it.

describe("getRequestState", () => {
  test("a failed exchange outranks a completed one, which outranks status", () => {
    expect(
      getRequestState({ status: "accepted", has_completed_confirm: true, has_unsuccessful_confirm: true }),
    ).toBe("unsuccessful");
    expect(getRequestState({ status: "accepted", has_completed_confirm: true })).toBe("completed");
    expect(getRequestState({ status: "accepted" })).toBe("accepted");
    expect(getRequestState({})).toBe("default");
  });
});

describe("getStatusLabel", () => {
  test.each([
    [{ status: "accepted", has_unsuccessful_confirm: true }, "Unsuccessful"],
    [{ status: "accepted", has_completed_confirm: true }, "Completed"],
    [{ status: "pending" }, "Pending"],
    [{ status: "cancelled" }, "Cancelled"],
  ])("%p is labelled %p", (req, label) => {
    expect(getStatusLabel(req)).toBe(label);
  });
});

describe("getStatusBadgeClass", () => {
  test("every badge starts from the shared base", () => {
    expect(getStatusBadgeClass({ status: "pending" }).startsWith(`${BADGE_BASE} `)).toBe(true);
  });

  test("known states get their own colour and unknown ones the default", () => {
    const pending = getStatusBadgeClass({ status: "pending" });
    const accepted = getStatusBadgeClass({ status: "accepted" });
    const fallback = getStatusBadgeClass({});
    expect(new Set([pending, accepted, fallback]).size).toBe(3);
    expect(getStatusBadgeClass({ status: "renegotiating" })).toBe(fallback);
    expect(getStatusBadgeClass({ status: "accepted", has_completed_confirm: true })).not.toBe(accepted);
  });
});

describe("getCardTone", () => {
  test.each([
    [{ status: "declined" }, "negative"],
    [{ status: "cancelled" }, "negative"],
    [{ status: "accepted", has_unsuccessful_confirm: true }, "negative"],
    [{ status: "expired" }, "expired"],
    [{ status: "accepted", has_completed_confirm: true }, "completed"],
  ])("%p uses the %s tone for either party", (req, tone) => {
    expect(getCardTone(req, true)).toBe(CARD_TONES[tone]);
    expect(getCardTone(req, false)).toBe(CARD_TONES[tone]);
  });

  test("closed cards are greyed out and only failed ones show the cost in red", () => {
    const flags = (name) => [!!CARD_TONES[name].inactive, !!CARD_TONES[name].redCost];
    expect(flags("negative")).toEqual([true, true]);
    expect(flags("expired")).toEqual([true, true]);
    expect(flags("completed")).toEqual([true, false]);
    expect(flags("buyer")).toEqual([false, false]);
    expect(flags("seller")).toEqual([false, false]);
  });

  test("open requests are coloured by the viewer's side", () => {
    expect(getCardTone({ status: "accepted" }, true)).toBe(CARD_TONES.buyer);
    expect(getCardTone({ status: "pending" }, false)).toBe(CARD_TONES.seller);
  });
});

describe("formatPersonName", () => {
  test("joins the parts that exist without stray spaces", () => {
    expect(formatPersonName({ first_name: "Ava", last_name: "Lee" })).toBe("Ava Lee");
    expect(formatPersonName({ first_name: "Ava" })).toBe("Ava");
    expect(formatPersonName({ last_name: "Lee" })).toBe("Lee");
    expect(formatPersonName(null)).toBe("");
  });
});

describe("formatPurchaseDateTime", () => {
  test("formats a value and leaves a missing one blank", () => {
    expect(formatPurchaseDateTime("2026-01-02T12:00:00Z")).toBe(formatDateTime("2026-01-02T12:00:00Z"));
    expect(formatPurchaseDateTime("2026-01-02T12:00:00Z")).not.toBe("");
    expect(formatPurchaseDateTime(null)).toBe("");
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/ScheduledPurchases/utils/scheduleDateTimeUtils.test.js</summary>

[Open source](../src/__tests__/pages/ScheduledPurchases/utils/scheduleDateTimeUtils.test.js)

```javascript
import {
  combineScheduleDateTime,
  convertTo24Hour,
  getDateRangeMessage,
  getEasternTime,
  getMaxDayForMeetingMonth,
  getScheduleDayOptions,
  getScheduleMonthOptions,
  getScheduleWindowBounds,
  getScheduleYearOptions,
  validateScheduleDateTime,
} from "../../../../pages/ScheduledPurchases/utils/scheduleDateTimeUtils";

// Expectations are Eastern wall-clock values or UTC instants, so these pass
// whatever time zone the machine running Jest is in.
function freezeNow(isoInstant) {
  jest.useFakeTimers("modern");
  jest.setSystemTime(new Date(isoInstant));
}

afterEach(() => {
  jest.useRealTimers();
});

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe("convertTo24Hour", () => {
  test.each([
    ["12", "AM", 0],
    ["1", "AM", 1],
    ["11", "AM", 11],
    ["12", "PM", 12],
    ["1", "PM", 13],
    ["11", "PM", 23],
  ])("%s %s is hour %i", (hour, amPm, expected) => {
    expect(convertTo24Hour(hour, amPm)).toBe(expected);
  });
});

describe("combineScheduleDateTime", () => {
  const meeting = {
    meetingMonth: "01",
    meetingDay: "15",
    meetingYear: "2026",
    meetingHour: "3",
    meetingMinute: "30",
    meetingAmPm: "PM",
  };

  test("reads the form as Eastern time in both standard and daylight time", () => {
    expect(combineScheduleDateTime(meeting)).toBe("2026-01-15T20:30:00.000Z");
    expect(combineScheduleDateTime({ ...meeting, meetingMonth: "07" })).toBe(
      "2026-07-15T19:30:00.000Z",
    );
    expect(
      combineScheduleDateTime({ ...meeting, meetingHour: "12", meetingMinute: "05", meetingAmPm: "AM" }),
    ).toBe("2026-01-15T05:05:00.000Z");
  });

  test("resolves the clock-change hours deterministically", () => {
    // 2:30 AM on the spring-forward day does not exist; it falls back to EST.
    expect(
      combineScheduleDateTime({ ...meeting, meetingMonth: "03", meetingDay: "08", meetingHour: "2", meetingAmPm: "AM" }),
    ).toBe("2026-03-08T07:30:00.000Z");
    // 1:30 AM happens twice on the fall-back day; the EST (second) one is used.
    expect(
      combineScheduleDateTime({ ...meeting, meetingMonth: "11", meetingDay: "01", meetingHour: "1", meetingAmPm: "AM" }),
    ).toBe("2026-11-01T06:30:00.000Z");
  });

  test.each([
    "meetingMonth",
    "meetingDay",
    "meetingYear",
    "meetingHour",
    "meetingMinute",
    "meetingAmPm",
  ])("returns null without %s", (field) => {
    expect(combineScheduleDateTime({ ...meeting, [field]: "" })).toBeNull();
  });

  test("returns null for a partly typed year", () => {
    expect(combineScheduleDateTime({ ...meeting, meetingYear: "202" })).toBeNull();
  });
});

describe("getEasternTime", () => {
  test("returns Eastern wall-clock fields in daylight and standard time", () => {
    // Every field differs (month 09, day 30, hour 10, minute 07, second 41), so
    // reading the wrong part cannot pass.
    freezeNow("2026-09-30T14:07:41Z");
    const summer = getEasternTime();
    expect([summer.getFullYear(), summer.getMonth(), summer.getDate()]).toEqual([2026, 8, 30]);
    expect([summer.getHours(), summer.getMinutes(), summer.getSeconds()]).toEqual([10, 7, 41]);

    jest.setSystemTime(new Date("2026-01-01T03:00:00Z"));
    const winter = getEasternTime();
    // Still New Year's Eve in Buffalo.
    expect([winter.getFullYear(), winter.getMonth(), winter.getDate(), winter.getHours()]).toEqual([
      2025, 11, 31, 22,
    ]);
  });
});

describe("getMaxDayForMeetingMonth", () => {
  const ref = new Date(2025, 0, 15);

  // "13" is not enough: it rolls over to January, which also has 31 days.
  test.each([
    ["14", "rolls to February without the guard"],
    ["-1", "rolls to November without the guard"],
    ["abc", "is NaN without the guard"],
  ])("month %p falls back to 31 (%s)", (month) => {
    expect(getMaxDayForMeetingMonth(month, ref)).toBe(31);
  });
});

describe("getDateRangeMessage", () => {
  beforeEach(() => freezeNow("2026-09-30T14:00:00Z")); // 10:00 AM Eastern

  test("waits for a fully typed date", () => {
    expect(getDateRangeMessage("9", "01", "2026")).toBe("");
    expect(getDateRangeMessage("09", "1", "2026")).toBe("");
    expect(getDateRangeMessage("09", "01", "202")).toBe("");
    expect(getDateRangeMessage("", "01", "2026")).toBe("");
  });

  test("allows today through exactly three months out", () => {
    expect(getDateRangeMessage("09", "30", "2026")).toBe("");
    expect(getDateRangeMessage("12", "30", "2026")).toBe("");
  });

  test("rejects dates outside the window", () => {
    expect(getDateRangeMessage("09", "29", "2026")).toBe("Meeting date cannot be in the past.");
    expect(getDateRangeMessage("12", "31", "2026")).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
  });
});

describe("schedule window options", () => {
  const sameYear = getScheduleWindowBounds(new Date(2026, 8, 30));
  const crossesYear = getScheduleWindowBounds(new Date(2026, 10, 15));

  test("bounds run from today to three months out", () => {
    expect(sameYear).toEqual({
      currentYear: 2026,
      currentMonth: 9,
      currentDay: 30,
      maxYear: 2026,
      maxMonth: 12,
      maxDay: 30,
    });
    expect(crossesYear).toEqual({
      currentYear: 2026,
      currentMonth: 11,
      currentDay: 15,
      maxYear: 2027,
      maxMonth: 2,
      maxDay: 15,
    });
  });

  test("years include next year only when the window reaches it", () => {
    expect(getScheduleYearOptions(sameYear)).toEqual([2026]);
    expect(getScheduleYearOptions(crossesYear)).toEqual([2026, 2027]);
  });

  test("months are clipped at both ends of the window", () => {
    expect(getScheduleMonthOptions(2026, sameYear)).toEqual([9, 10, 11, 12]);
    expect(getScheduleMonthOptions(2026, crossesYear)).toEqual([11, 12]);
    expect(getScheduleMonthOptions(2027, crossesYear)).toEqual([1, 2]);
  });

  test("days are clipped to today, the last day, and the month length", () => {
    expect(getScheduleDayOptions(2026, 9, sameYear)).toEqual([30]);
    expect(getScheduleDayOptions(2026, 10, sameYear)).toEqual(range(1, 31));
    expect(getScheduleDayOptions(2026, 12, sameYear)).toEqual(range(1, 30));
    expect(getScheduleDayOptions(2026, 11, crossesYear)).toEqual(range(15, 30));
    expect(getScheduleDayOptions(2027, 2, crossesYear)).toEqual(range(1, 15));
  });

  test("February length follows the year being scheduled", () => {
    const leap = { currentYear: 2027, currentMonth: 12, currentDay: 10, maxYear: 2028, maxMonth: 3, maxDay: 10 };
    expect(getScheduleDayOptions(2028, 2, leap)).toEqual(range(1, 29));
    const common = { currentYear: 2026, currentMonth: 12, currentDay: 10, maxYear: 2027, maxMonth: 3, maxDay: 10 };
    expect(getScheduleDayOptions(2027, 2, common)).toEqual(range(1, 28));
  });
});

describe("validateScheduleDateTime", () => {
  const at = (month, day, year, hour, minute, amPm) => ({
    meetingMonth: month,
    meetingDay: day,
    meetingYear: year,
    meetingHour: hour,
    meetingMinute: minute,
    meetingAmPm: amPm,
  });

  beforeEach(() => freezeNow("2026-09-30T14:00:00Z")); // 10:00 AM Eastern

  test("names every missing field in a readable list", () => {
    expect(validateScheduleDateTime(at("", "", "", "", "", ""))).toBe(
      "Please select meeting date, meeting hour, meeting minute, and AM/PM.",
    );
    expect(validateScheduleDateTime(at("10", "01", "2026", "", "00", ""))).toBe(
      "Please select meeting hour and AM/PM.",
    );
    expect(validateScheduleDateTime(at("10", "01", "2026", "3", "", "PM"))).toBe(
      "Please select a meeting minute.",
    );
    expect(validateScheduleDateTime(at("10", "01", "202", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
    expect(validateScheduleDateTime(at("", "01", "2026", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
    expect(validateScheduleDateTime(at("10", "", "2026", "3", "00", "PM"))).toBe(
      "Please select a meeting date.",
    );
  });

  test("the same month and day next year is too far ahead, not past", () => {
    const tooFar = "Meeting date cannot be more than 3 months in advance.";
    expect(validateScheduleDateTime(at("09", "29", "2027", "3", "00", "PM"))).toBe(tooFar);
    expect(validateScheduleDateTime(at("09", "30", "2027", "9", "00", "AM"))).toBe(tooFar);
  });

  test("an earlier hour on a later day this month is fine", () => {
    jest.setSystemTime(new Date("2026-09-15T14:00:00Z")); // Sept 15, 10:00 AM Eastern
    expect(validateScheduleDateTime(at("09", "20", "2026", "9", "00", "AM"))).toBe("");
  });

  test.each([
    ["yesterday", at("09", "29", "2026", "3", "00", "PM")],
    ["an earlier month this year", at("08", "31", "2026", "3", "00", "PM")],
    ["last year", at("12", "31", "2025", "3", "00", "PM")],
  ])("rejects %s as past", (_label, meeting) => {
    expect(validateScheduleDateTime(meeting)).toBe("Meeting date cannot be in the past.");
  });

  test("requires a time after now today, to the minute", () => {
    const future = "Meeting time must be in the future.";
    expect(validateScheduleDateTime(at("09", "30", "2026", "9", "59", "AM"))).toBe(future);
    expect(validateScheduleDateTime(at("09", "30", "2026", "10", "00", "AM"))).toBe(future);
    expect(validateScheduleDateTime(at("09", "30", "2026", "10", "01", "AM"))).toBe("");
    // An earlier hour with a later minute is still in the past.
    expect(validateScheduleDateTime(at("09", "30", "2026", "9", "30", "AM"))).toBe(future);
    // A later hour with an earlier minute is fine.
    expect(validateScheduleDateTime(at("09", "30", "2026", "11", "00", "AM"))).toBe("");
    // An earlier hour on a later day is fine.
    expect(validateScheduleDateTime(at("10", "01", "2026", "8", "00", "AM"))).toBe("");
  });

  test("allows up to exactly three months ahead", () => {
    expect(validateScheduleDateTime(at("12", "30", "2026", "10", "00", "AM"))).toBe("");
    expect(validateScheduleDateTime(at("12", "30", "2026", "10", "01", "AM"))).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
  });

  test("a date early next year is judged by the window, not treated as past", () => {
    expect(validateScheduleDateTime(at("01", "05", "2027", "3", "00", "PM"))).toBe(
      "Meeting date cannot be more than 3 months in advance.",
    );
    jest.setSystemTime(new Date("2026-11-15T17:00:00Z")); // noon Eastern
    expect(validateScheduleDateTime(at("01", "10", "2027", "3", "00", "PM"))).toBe("");
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/ScheduledPurchases/utils/scheduledPurchaseUtils.test.js</summary>

[Open source](../src/__tests__/pages/ScheduledPurchases/utils/scheduledPurchaseUtils.test.js)

```javascript
import {
  compareItemGroups,
  getScheduleBucket,
  groupScheduledPurchasesByItem,
  loadScheduledPurchases,
  partitionAndSortPurchases,
} from "../../../../pages/ScheduledPurchases/utils/scheduledPurchaseUtils";
import { apiGetJson } from "../../../../utils/apiClient";

jest.mock("../../../../utils/apiClient", () => ({ apiGetJson: jest.fn() }));

const NOW = Date.parse("2026-01-02T12:00:00Z");
const at = (time) => `2026-01-02T${time}:00Z`;
const ids = (list) => list.map((req) => req.request_id);

describe("getScheduleBucket", () => {
  test.each(["declined", "cancelled", "expired"])(
    "a %s request is past even before its meeting",
    (status) => {
      expect(getScheduleBucket({ status, meeting_at: at("14:00") }, NOW)).toBe("past");
    },
  );

  test("a confirmed or failed exchange is past even before its meeting", () => {
    const upcoming = { status: "accepted", meeting_at: at("14:00") };
    expect(getScheduleBucket({ ...upcoming, has_completed_confirm: true }, NOW)).toBe("past");
    expect(getScheduleBucket({ ...upcoming, has_unsuccessful_confirm: true }, NOW)).toBe("past");
    expect(getScheduleBucket(upcoming, NOW)).toBe("upcoming");
  });

  test("stays active until exactly 30 minutes after the meeting", () => {
    expect(getScheduleBucket({ status: "accepted", meeting_at: "2026-01-02T11:30:01Z" }, NOW)).toBe(
      "active",
    );
    expect(getScheduleBucket({ status: "accepted", meeting_at: at("11:30") }, NOW)).toBe("past");
  });

  test("only a pending request with no meeting time needs a response", () => {
    expect(getScheduleBucket({ status: "pending", meeting_at: at("14:00") }, NOW)).toBe("upcoming");
    expect(getScheduleBucket({ status: "accepted" }, NOW)).toBe("upcoming");
  });
});

describe("partitionAndSortPurchases", () => {
  // Inputs are shuffled so that leaving a bucket unsorted, or sorting it the
  // wrong way, changes the result.
  const purchases = [
    { request_id: "past-created-9", status: "expired", created_at: at("09:00") },
    { request_id: "up-none", status: "accepted" },
    { request_id: "active-1150", status: "accepted", meeting_at: at("11:50") },
    { request_id: "past-met-10", status: "declined", meeting_at: "2026-01-01T10:00:00Z" },
    { request_id: "needs-8", status: "pending", created_at: at("08:00") },
    { request_id: "up-14", status: "accepted", meeting_at: at("14:00") },
    { request_id: "past-created-11", status: "declined", created_at: at("11:00") },
    { request_id: "active-1140", status: "accepted", meeting_at: at("11:40") },
    { request_id: "needs-10", status: "pending", created_at: at("10:00") },
    { request_id: "up-13", status: "accepted", meeting_at: at("13:00") },
    { request_id: "past-met-15", status: "cancelled", meeting_at: "2026-01-01T15:00:00Z" },
    // Third entries: with two items, some wrong comparators still land on the
    // right order by luck.
    { request_id: "active-1145", status: "accepted", meeting_at: at("11:45") },
    { request_id: "past-met-12", status: "declined", meeting_at: "2026-01-01T12:00:00Z" },
  ];
  const buckets = partitionAndSortPurchases(purchases, NOW);

  test("active: earliest meeting first", () => {
    expect(ids(buckets.active)).toEqual(["active-1140", "active-1145", "active-1150"]);
  });

  test("needs response: newest request first", () => {
    expect(ids(buckets.needsResponse)).toEqual(["needs-10", "needs-8"]);
  });

  test("upcoming: earliest meeting first, unscheduled last", () => {
    expect(ids(buckets.upcoming)).toEqual(["up-13", "up-14", "up-none"]);
  });

  test("past: latest meeting first, then unscheduled by newest request", () => {
    expect(ids(buckets.past)).toEqual([
      "past-met-15",
      "past-met-12",
      "past-met-10",
      "past-created-11",
      "past-created-9",
    ]);
  });
});

describe("groupScheduledPurchasesByItem", () => {
  const order = (groups) => groups.map((group) => group.productId);

  test("orders items by their most urgent request, then by that bucket's own rule", () => {
    const buyer = [
      { request_id: 1, inventory_product_id: 10, status: "declined", meeting_at: "2026-01-01T10:00:00Z" },
      { request_id: 2, inventory_product_id: 11, status: "accepted", meeting_at: at("14:00") },
      { request_id: 3, inventory_product_id: 12, status: "accepted", meeting_at: at("13:00") },
      { request_id: 4, inventory_product_id: 13, status: "pending", created_at: at("08:00") },
    ];
    const seller = [
      { request_id: 5, inventory_product_id: 14, status: "pending", created_at: at("10:00") },
      { request_id: 6, inventory_product_id: 15, status: "accepted", meeting_at: at("11:50") },
      { request_id: 7, inventory_product_id: 16, status: "accepted", meeting_at: at("11:40") },
      { request_id: 8, inventory_product_id: 17, status: "cancelled", meeting_at: "2026-01-01T15:00:00Z" },
      { request_id: 9, inventory_product_id: 18, status: "declined", created_at: "2026-01-01T20:00:00Z" },
    ];

    expect(order(groupScheduledPurchasesByItem(buyer, seller, NOW))).toEqual([
      16, 15, // active, earliest meeting first
      14, 13, // needs response, newest request first
      12, 11, // upcoming, earliest meeting first
      18, 17, 10, // past, latest meeting (or request) first
    ]);
  });

  test("an item's best bucket decides its place, not its first request", () => {
    const groups = groupScheduledPurchasesByItem(
      [
        { request_id: 1, inventory_product_id: 1, status: "accepted", meeting_at: at("13:00") },
        { request_id: 2, inventory_product_id: 2, status: "declined" },
        { request_id: 3, inventory_product_id: 2, status: "accepted", meeting_at: at("11:45") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([2, 1]);
  });

  test("sorting overrides the ascending-id order that grouping produces", () => {
    // Items are grouped through an object keyed on product id, so they come out
    // in ascending id order before sorting; the id tie-break is therefore
    // tested through compareItemGroups directly below.
    const groups = groupScheduledPurchasesByItem(
      [
        { request_id: 1, inventory_product_id: 2, status: "accepted", meeting_at: at("14:00") },
        { request_id: 2, inventory_product_id: 1, status: "accepted", meeting_at: at("15:00") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([2, 1]);
  });

  test("ties break by newest request, then by product id in numeric order", () => {
    const upcoming = { status: "accepted", meeting_at: at("13:00") };
    const groups = groupScheduledPurchasesByItem(
      [
        { ...upcoming, request_id: 1, inventory_product_id: 10, created_at: at("09:00") },
        { ...upcoming, request_id: 2, inventory_product_id: 9, created_at: at("09:00") },
        { ...upcoming, request_id: 3, inventory_product_id: 19, created_at: at("09:00") },
        { ...upcoming, request_id: 4, inventory_product_id: 20, created_at: at("11:00") },
      ],
      [],
      NOW,
    );
    expect(order(groups)).toEqual([20, 9, 10, 19]);
  });

  test("tags perspective and falls back to a placeholder item", () => {
    const [group] = groupScheduledPurchasesByItem(
      [{ request_id: 1, inventory_product_id: 7, status: "pending" }],
      [{ request_id: 2, inventory_product_id: 7, status: "accepted", item: { title: "Lamp" } }],
      NOW,
    );
    expect(group.item).toEqual({ title: "Unknown Item" });
    expect(group.purchases.map((req) => [req.request_id, req.perspective])).toEqual([
      [1, "buyer"],
      [2, "seller"],
    ]);
  });
});

describe("compareItemGroups", () => {
  let nextId = 1;
  const group = (productId, requests) => ({
    productId,
    buckets: partitionAndSortPurchases(
      requests.map((req) => ({ request_id: nextId++, ...req })),
      NOW,
    ),
  });
  const accepted = (time, created = at("00:00")) => ({ status: "accepted", meeting_at: at(time), created_at: created });
  const pending = (created) => ({ status: "pending", created_at: created });
  const pastMeeting = (dayTime) => ({ status: "declined", meeting_at: `2026-01-01T${dayTime}:00Z` });
  // Negative: a sorts first. Positive: b sorts first.
  const sign = (a, b) => Math.sign(compareItemGroups(a, b));

  // Each "several" group has a request on either side of the single-request
  // group, so comparing by the wrong end (min vs max) flips the result.
  test("active: the item with the earliest meeting wins", () => {
    const several = group(1, [accepted("11:40"), accepted("11:55")]);
    const single = group(2, [accepted("11:50")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("needs response: the item with the newest request wins", () => {
    const several = group(1, [pending(at("08:00")), pending(at("10:30"))]);
    const single = group(2, [pending(at("10:00"))]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("needs response is judged by pending requests only, not the item's other history", () => {
    const olderPendingNewerHistory = group(1, [
      pending(at("08:00")),
      { status: "declined", created_at: at("11:00") },
    ]);
    const newerPending = group(2, [pending(at("10:00"))]);
    expect(sign(newerPending, olderPendingNewerHistory)).toBe(-1);
  });

  test("upcoming: the item with the earliest meeting wins", () => {
    const several = group(1, [accepted("13:00"), accepted("15:00")]);
    const single = group(2, [accepted("14:00")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("past: the item with the latest meeting wins", () => {
    const several = group(1, [pastMeeting("10:00"), pastMeeting("16:00")]);
    const single = group(2, [pastMeeting("15:00")]);
    expect(sign(several, single)).toBe(-1);
    expect(sign(single, several)).toBe(1);
  });

  test("equal bucket times fall back to the newest request, then product id", () => {
    const olderRequest = group(1, [accepted("11:40", at("09:00"))]);
    const newerRequest = group(2, [accepted("11:40", at("11:00"))]);
    expect(sign(newerRequest, olderRequest)).toBe(-1);

    // Same for tied needs-response and past items: the item with other, newer
    // history goes first.
    const pendingWithHistory = group(3, [pending(at("10:00")), { status: "declined", created_at: at("11:30") }]);
    const pendingOnly = group(4, [pending(at("10:00"))]);
    expect(sign(pendingWithHistory, pendingOnly)).toBe(-1);
    // Both items' latest past key is the Jan 1 15:00 meeting; only the older,
    // unscheduled request tells them apart.
    const pastWithOlderRequest = group(5, [pastMeeting("15:00"), { status: "declined", created_at: "2026-01-01T10:00:00Z" }]);
    const pastOnly = group(6, [pastMeeting("15:00")]);
    expect(sign(pastWithOlderRequest, pastOnly)).toBe(-1);

    const nine = group(9, [accepted("13:00", at("09:00"))]);
    const ten = group(10, [accepted("13:00", at("09:00"))]);
    expect(sign(nine, ten)).toBe(-1);
    expect(sign(ten, nine)).toBe(1);
  });
});

describe("loadScheduledPurchases", () => {
  beforeEach(() => apiGetJson.mockReset());

  test("loads buyer and seller lists with the caller's abort signal", async () => {
    apiGetJson.mockImplementation(async (url) =>
      url.endsWith("list_buyer.php")
        ? { success: true, data: [{ request_id: 1 }] }
        : { success: true, data: "not a list" },
    );
    const signal = new AbortController().signal;

    await expect(loadScheduledPurchases(signal)).resolves.toEqual({
      buyerRequests: [{ request_id: 1 }],
      sellerRequests: [],
    });
    expect(apiGetJson).toHaveBeenCalledWith(
      expect.stringMatching(/\/scheduled_purchases\/list_buyer\.php$/),
      { signal },
    );
    expect(apiGetJson).toHaveBeenCalledWith(
      expect.stringMatching(/\/scheduled_purchases\/list_seller\.php$/),
      { signal },
    );
  });

  test("surfaces the server's error, or a default one", async () => {
    apiGetJson.mockResolvedValue({ success: false, error: "Session expired" });
    await expect(loadScheduledPurchases()).rejects.toThrow("Session expired");

    apiGetJson.mockResolvedValue(null);
    await expect(loadScheduledPurchases()).rejects.toThrow("Failed to load scheduled purchases");
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Search/components/SearchFiltersSidebar.test.jsx</summary>

[Open source](../src/__tests__/pages/Search/components/SearchFiltersSidebar.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import SearchFiltersSidebar from "../../../../pages/Search/components/SearchFiltersSidebar";

test("applies filter state through the existing listings URL", () => {
  const navigate = jest.fn();
  const onApplied = jest.fn();
  render(
    <SearchFiltersSidebar
      categories={["Decor", "Lighting"]}
      query={new URLSearchParams("q=lamp")}
      includeDescription={false}
      onToggleIncludeDescription={jest.fn()}
      navigate={navigate}
      onApplied={onApplied}
    />,
  );

  fireEvent.click(screen.getByLabelText("Decor"));
  fireEvent.click(screen.getByLabelText("Newest → Oldest"));
  fireEvent.change(screen.getByPlaceholderText("Min"), {
    target: { value: "5" },
  });
  fireEvent.change(screen.getByPlaceholderText("Max"), {
    target: { value: "20" },
  });
  fireEvent.click(screen.getByLabelText("Price Negotiable"));
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));

  expect(navigate).toHaveBeenCalledWith(
    "/app/listings?search=lamp&categories=Decor&sort=new&minPrice=5" +
      "&maxPrice=20&priceNego=1",
  );
  expect(onApplied).toHaveBeenCalledTimes(1);
});
```

</details>

<details>
<summary>src/__tests__/pages/Search/components/SearchResultList.test.jsx</summary>

[Open source](../src/__tests__/pages/Search/components/SearchResultList.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SearchResultList from "../../../../pages/Search/components/SearchResultList";

test.each([
  [{ loading: true, error: null, items: [] }, "Searching…"],
  [
    { loading: false, error: new Error("failed"), items: [] },
    "Could not fetch search results.",
  ],
  [{ loading: false, error: null, items: [] }, "No items found."],
])("renders the search request state", (state, message) => {
  render(<SearchResultList {...state} onSelectItem={jest.fn()} />);
  expect(screen.getByText(message)).toBeInTheDocument();
});

test("opens the selected search result", () => {
  const onSelectItem = jest.fn();
  render(
    <SearchResultList
      loading={false}
      error={null}
      items={[
        {
          id: 7,
          title: "Desk lamp",
          price: 12,
          img: null,
          seller: "Alex",
          createdAt: null,
          itemCondition: "Good",
          itemLocation: "North Campus",
          status: "AVAILABLE",
        },
      ]}
      onSelectItem={onSelectItem}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /desk lamp/i }));
  expect(onSelectItem).toHaveBeenCalledWith(7);
});
```

</details>

<details>
<summary>src/__tests__/pages/Search/utils/searchResultsUtils.test.js</summary>

[Open source](../src/__tests__/pages/Search/utils/searchResultsUtils.test.js)

```javascript
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
```

</details>

<details>
<summary>src/__tests__/pages/SellerDashboard/utils/sellerDashboardUtils.test.js</summary>

[Open source](../src/__tests__/pages/SellerDashboard/utils/sellerDashboardUtils.test.js)

```javascript
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

  test("an unknown status looks neutral, not like a known one", () => {
    // Distinctness alone misses two styles trading places, so anchor the fallback.
    expect(listingStatusClass("unknown")).toMatch(/\bbg-gray-/);
    expect(listingStatusClass("sold")).not.toMatch(/\bbg-gray-/);
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
```

</details>

<details>
<summary>src/__tests__/pages/Settings/AboutUs.test.jsx</summary>

[Open source](../src/__tests__/pages/Settings/AboutUs.test.jsx)

```jsx
import { render, screen, within } from "@testing-library/react";
import AboutUs from "../../../pages/Settings/AboutUs";

jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });

test("shows each developer and their contact links", () => {
  render(<AboutUs />);

  [
    {
      name: "Sameer Jain",
      email: "sameerjain501@gmail.com",
      linkedin: "https://www.linkedin.com/in/sameer-jain1/",
    },
    {
      name: "Anish Banerjee",
      email: "anishbancse312@gmail.com",
      linkedin: "https://www.linkedin.com/in/anish-banerjee-71aba9290/",
    },
    {
      name: "Chris (Sooseok) Kim",
      email: "sooseokkim99@gmail.com",
      linkedin: "https://www.linkedin.com/in/kim-chris-sooseok/",
    },
  ].forEach(({ name, email, linkedin }) => {
    const card = screen.getByRole("heading", { name }).closest("article");
    const cardContent = within(card);

    expect(cardContent.getByRole("img", { name: new RegExp(name.replace(/[()]/g, "\\$&")) })).toBeTruthy();
    expect(cardContent.getByText(email)).toBeTruthy();
    expect(cardContent.getByRole("link", { name: "Email" }).getAttribute("href")).toBe(
      `mailto:${email}`,
    );
    expect(
      cardContent.getByRole("link", { name: "LinkedIn" }).getAttribute("href"),
    ).toBe(linkedin);
  });

  expect(screen.getAllByRole("link", { name: "Email" })).toHaveLength(3);
  expect(screen.getAllByRole("link", { name: "LinkedIn" })).toHaveLength(3);
  expect(screen.getAllByRole("link", { name: "GitHub" })).toHaveLength(3);
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/accountInfoUtils.test.js</summary>

[Open source](../src/__tests__/pages/Settings/accountInfoUtils.test.js)

```javascript
import { formatAccountDate, formatGraduationDate, isValidPhoneNumber } from "../../../pages/Settings/accountInfoUtils";

describe("account information formatting", () => {
  test("formats graduation month and year", () => {
    expect(formatGraduationDate(5, 2027)).toBe(
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(2027, 4, 1)),
    );
  });

  test("formats local account dates without a timezone shift", () => {
    expect(formatAccountDate("2025-08-20")).toBe(
      new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(2025, 7, 20)),
    );
  });

  test("uses a neutral fallback for invalid values", () => {
    expect(formatGraduationDate(13, 2027)).toBe("Not available");
    expect(formatAccountDate("bad-date")).toBe("Not available");
  });

  test("graduation months 1 and 12 are valid; 0, 13 and non-integers are not", () => {
    const monthYear = (month, year) =>
      new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
    expect(formatGraduationDate(1, 2027)).toBe(monthYear(1, 2027));
    expect(formatGraduationDate("12", "2027")).toBe(monthYear(12, 2027));
    for (const month of [0, -1, 13, 1.5, "abc", null, undefined]) {
      expect(formatGraduationDate(month, 2027)).toBe("Not available");
    }
  });

  test("graduation years must be positive whole numbers", () => {
    expect(formatGraduationDate(5, 0)).toBe("Not available");
    expect(formatGraduationDate(5, -2027)).toBe("Not available");
    expect(formatGraduationDate(5, 2027.5)).toBe("Not available");
    expect(formatGraduationDate(5, "abc")).toBe("Not available");
    expect(formatGraduationDate(5, undefined)).toBe("Not available");
    expect(formatGraduationDate(5, 1)).not.toBe("Not available");
  });

  test("account dates use the calendar day written, ignoring any time part", () => {
    const long = (y, m, d) => new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(y, m - 1, d));
    expect(formatAccountDate("2025-12-31 23:59:59")).toBe(long(2025, 12, 31));
    expect(formatAccountDate("2025-01-01T00:00:00Z")).toBe(long(2025, 1, 1));
    expect(formatAccountDate("2025-08-20")).not.toBe(formatAccountDate("2025-08-21"));
  });

  test("account dates need a full leading YYYY-MM-DD", () => {
    for (const value of ["", null, undefined, "2025-8-20", "25-08-20", "x2025-08-20", " 2025-08-20", "08/20/2025"]) {
      expect(formatAccountDate(value)).toBe("Not available");
    }
  });
});

describe("isValidPhoneNumber", () => {
  test.each(["7165551234", "(716) 555-1234", "+1 716.555.1234", "  716-555-1234  ", "5"])("accepts %p", (value) => {
    expect(isValidPhoneNumber(value)).toBe(true);
  });

  test.each([
    "",
    "   ",
    "()",
    "+ - .",
    "call me",
    "716-555-1234x",
    "x716-555-1234",
    "12345678901234567890123456",
    null,
    undefined,
    7165551234,
  ])("rejects %p", (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
  });

  test("length is capped at 25 characters", () => {
    expect(isValidPhoneNumber("1".repeat(25))).toBe(true);
    expect(isValidPhoneNumber("1".repeat(26))).toBe(false);
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/LoggedDevicesPage.test.jsx</summary>

[Open source](../src/__tests__/pages/Settings/LoggedDevicesPage.test.jsx)

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoggedDevicesPage from "../../../pages/Settings/LoggedDevicesPage";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);

test("shows device, location, and current-session details", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      devices: [
        {
          id: 7,
          device_type: "Desktop",
          browser: "Microsoft Edge",
          operating_system: "Windows",
          ip_address: "203.0.113.10",
          location: "Buffalo, NY, US",
          logged_in_at: "2026-08-14 13:05:00",
          last_seen_at: "2026-08-14 13:10:00",
          signed_out_at: null,
          is_current: true,
        },
      ],
    }),
  });

  render(<LoggedDevicesPage />);

  expect(await screen.findByText("Microsoft Edge on Windows")).toBeTruthy();
  expect(screen.getByText("Buffalo, NY, US")).toBeTruthy();
  expect(screen.getByText("203.0.113.10")).toBeTruthy();
  expect(screen.getByText("Current device")).toBeTruthy();
});

test("explains local addresses, searches history, and refreshes results", async () => {
  const devices = [
    {
      id: 1, device_type: "Desktop", browser: "Firefox", operating_system: "Linux",
      ip_address: "127.0.0.1", ip_scope: "local", location: null,
      logged_in_at: "2026-09-17T12:00:00Z", last_seen_at: "2026-09-17T12:05:00Z",
      is_current: true, signed_out_at: null,
    },
    {
      id: 2, device_type: "Mobile", browser: "Safari", operating_system: "iOS",
      ip_address: "8.8.8.8", ip_scope: "public", location: "Buffalo, New York, United States",
      logged_in_at: "2026-09-16T12:00:00Z", last_seen_at: "2026-09-16T12:05:00Z",
      is_current: false, signed_out_at: "2026-09-16T12:05:00Z",
    },
  ];
  global.fetch = jest.fn().mockResolvedValue({
    ok: true, json: async () => ({ success: true, devices }),
  });
  render(<LoggedDevicesPage />);
  expect(await screen.findByText("Local device · no public location")).toBeTruthy();
  const search = screen.getByRole("searchbox", { name: "Search login history" });
  fireEvent.change(search, { target: { value: "buffalo" } });
  expect(screen.getByText("Safari on iOS")).toBeTruthy();
  expect(screen.queryByText("Firefox on Linux")).toBeNull();
  expect(screen.getByText("Showing 1 of 2 login sessions")).toBeTruthy();
  fireEvent.change(search, { target: { value: "no match" } });
  expect(screen.getByText("No logins match your search.")).toBeTruthy();
  fireEvent.change(search, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(await screen.findByRole("button", { name: "Refresh history" })).toBeTruthy();
});

test("keeps history usable when a public IP cannot be located", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, devices: [{
      id: 3, browser: "Chrome", operating_system: "Windows", device_type: "Desktop",
      ip_address: "8.8.8.8", ip_scope: "public", location: null,
      logged_in_at: "2026-09-17T12:00:00Z", last_seen_at: "2026-09-17T12:05:00Z",
    }] }),
  });
  render(<LoggedDevicesPage />);
  expect(await screen.findByText("City could not be determined from this IP")).toBeTruthy();
  expect(screen.getByText("8.8.8.8")).toBeTruthy();
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/loggedDevicesUtils.test.js</summary>

[Open source](../src/__tests__/pages/Settings/loggedDevicesUtils.test.js)

```javascript
import { formatLoginTimestamp, parseLoginTimestamp } from "../../../pages/Settings/loggedDevicesUtils";

describe("logged device timestamps", () => {
  test("parses database timestamps as UTC", () => {
    const parsed = parseLoginTimestamp("2026-08-14T13:05:00Z");
    expect(parsed).toEqual(new Date("2026-08-14T13:05:00Z"));
  });

  test("formats a readable login time", () => {
    const value = "2026-08-14T13:05:00Z";
    expect(formatLoginTimestamp(value)).toBe(
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date("2026-08-14T13:05:00Z")),
    );
  });

  test("uses a safe fallback for invalid timestamps", () => {
    expect(parseLoginTimestamp("not-a-date")).toBeNull();
    expect(formatLoginTimestamp("")).toBe("Unknown time");
  });

  test("treats legacy timezone-less database values as UTC", () => {
    expect(parseLoginTimestamp("2026-08-14 13:05:00")).toEqual(
      new Date("2026-08-14T13:05:00Z"),
    );
  });

  test("respects an explicit offset instead of adding a second zone", () => {
    expect(parseLoginTimestamp("2026-08-14T13:05:00+05:30")).toEqual(new Date("2026-08-14T07:35:00Z"));
    expect(parseLoginTimestamp("2026-08-14 13:05:00-04:00")).toEqual(new Date("2026-08-14T17:05:00Z"));
    expect(parseLoginTimestamp("2026-08-14T13:05:00z")).toEqual(new Date("2026-08-14T13:05:00Z"));
  });

  test("trims surrounding spaces and only converts the first space", () => {
    expect(parseLoginTimestamp("  2026-08-14 13:05:00  ")).toEqual(new Date("2026-08-14T13:05:00Z"));
    expect(parseLoginTimestamp("2026-08-14 13:05:00 extra")).toBeNull();
  });

  test.each([null, undefined, "", "   ", 5, {}, new Date(), "not-a-date", "2026-13-45 99:99:99"])(
    "rejects %p",
    (value) => {
      expect(parseLoginTimestamp(value)).toBeNull();
    },
  );

  test("a date with no time is read as midnight UTC", () => {
    expect(parseLoginTimestamp("2026-08-14T00:00")).toEqual(new Date("2026-08-14T00:00:00Z"));
  });

  test("a malformed offset is not mistaken for a real one", () => {
    // Without a valid zone it is read as UTC, which the date parser then rejects.
    expect(parseLoginTimestamp("2026-08-14T13:05:00+5:30")).toBeNull();
  });

  test("formatting gives the same text for equivalent zone spellings and never throws", () => {
    expect(formatLoginTimestamp("2026-08-14 13:05:00")).toBe(formatLoginTimestamp("2026-08-14T13:05:00Z"));
    expect(formatLoginTimestamp("2026-08-14T15:05:00+02:00")).toBe(formatLoginTimestamp("2026-08-14T13:05:00Z"));
    for (const value of [null, undefined, "junk", 12]) {
      expect(formatLoginTimestamp(value)).toBe("Unknown time");
    }
    expect(formatLoginTimestamp("2026-08-14T13:05:00Z")).not.toBe(formatLoginTimestamp("2026-08-15T13:05:00Z"));
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/TwoFactorAuthentication.test.jsx</summary>

[Open source](../src/__tests__/pages/Settings/TwoFactorAuthentication.test.jsx)

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TwoFactorAuthentication from "../../../pages/Settings/TwoFactorAuthentication";
import { csrfFetch } from "../../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test("enables email two-factor authentication and updates the button", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ ok: true, enabled: false, email: "te****@buffalo.edu" }),
  );
  csrfFetch.mockResolvedValue(
    jsonResponse({
      ok: true,
      enabled: true,
      message: "Two-Factor Authentication Enabled Successfully.",
    }),
  );

  render(<TwoFactorAuthentication />);
  await screen.findByText("Verification codes will be sent to te****@buffalo.edu.");
  fireEvent.click(screen.getByRole("button", { name: "Enable 2FA" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  expect(await screen.findByText("Two-Factor Authentication Enabled Successfully.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Disable 2FA" })).toBeTruthy();
  expect(csrfFetch).toHaveBeenCalledWith(
    expect.stringContaining("/auth/two_factor.php"),
    expect.objectContaining({ body: JSON.stringify({ action: "enable", password: "" }) }),
  );
});

test("requires the current password when disabling two-factor authentication", async () => {
  global.fetch = jest.fn().mockResolvedValue(
    jsonResponse({ ok: true, enabled: true, email: "te****@buffalo.edu" }),
  );
  csrfFetch.mockResolvedValue(
    jsonResponse({
      ok: true,
      enabled: false,
      message: "Two-Factor Authentication Disabled Successfully.",
    }),
  );

  render(<TwoFactorAuthentication />);
  fireEvent.click(await screen.findByRole("button", { name: "Disable 2FA" }));
  fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "1234!" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled());
  expect(await screen.findByText("Two-Factor Authentication Disabled Successfully.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Enable 2FA" })).toBeTruthy();
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/UserPreferences.test.jsx</summary>

[Open source](../src/__tests__/pages/Settings/UserPreferences.test.jsx)

```jsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import UserPreferences from "../../../pages/Settings/UserPreferences";
import { csrfFetch } from "../../../utils/csrfFetch";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), {
  virtual: true,
});
jest.mock("../../../pages/Settings/SettingsLayout", () => ({ children }) => <div>{children}</div>);
jest.mock("../../../components/PageBackButton", () => () => null);
jest.mock("../../../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    updateTheme: jest.fn(),
    syncFromServerIfNoPending: jest.fn(),
    isLoading: false,
  }),
}));
jest.mock("../../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const response = (body) => ({
  ok: true,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

// Saves are debounced 400ms; leave headroom for a loaded CI runner (the full
// suite runs in band and this file timed out at 1.5s under that load).
const SAVE_WAIT_MS = 4000;
jest.setTimeout(15000);

// The page auto-saves (debounced) whenever values change, including once right
// after the initial load, so wait for the save that carries the expected fields
// rather than whichever call happens to be last.
const savedBodies = () => csrfFetch.mock.calls.map((call) => JSON.parse(call[1].body));
const waitForSave = (expected) =>
  waitFor(
    () => expect(savedBodies()).toContainEqual(expect.objectContaining(expected)),
    { timeout: SAVE_WAIT_MS },
  );

const mockLoadedPreferences = (overrides = {}) => {
  global.fetch = jest.fn((url) =>
    url.includes("get_categories.php")
      ? Promise.resolve(response([]))
      : Promise.resolve(
          response({
            ok: true,
            data: {
              promoEmails: false,
              promoFrequency: "off",
              revealContact: true,
              contactPhone: "(716) 555-0123",
              interests: [],
              theme: "light",
              ...overrides,
            },
          }),
        ),
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadedPreferences();
  csrfFetch.mockResolvedValue(response({ ok: true }));
});

test("loads and persists the seller contact-sharing toggle", async () => {
  render(<UserPreferences />);

  const phoneInput = await screen.findByLabelText("Phone number (optional)");
  await waitFor(() => expect(phoneInput.value).toBe("(716) 555-0123"));
  const toggle = await screen.findByRole("checkbox", {
    name: /share my email and phone number/i,
  });
  expect(toggle.checked).toBe(true);

  fireEvent.click(toggle);

  await waitForSave({ revealContact: false, contactPhone: "(716) 555-0123" });
});

test("edits and persists the phone number field", async () => {
  render(<UserPreferences />);

  const phoneInput = await screen.findByLabelText("Phone number (optional)");
  fireEvent.change(phoneInput, { target: { value: "716-555-9999" } });

  await waitForSave({ contactPhone: "716-555-9999" });
});

test("shows backend validation failures instead of silently losing changes", async () => {
  csrfFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ ok: false, error: "Unable to save preferences" }),
  });
  render(<UserPreferences />);

  const toggle = await screen.findByRole("checkbox", {
    name: /share my email and phone number/i,
  });
  fireEvent.click(toggle);

  expect(
    (await screen.findByRole("alert", {}, { timeout: SAVE_WAIT_MS })).textContent,
  ).toContain("Unable to save preferences");
});

// Autosave sends only fields that differ from what loaded, so each case starts
// from a different frequency than the one it selects.
test.each([
  ["off", "weekly"],
  ["daily", "off"],
  ["weekly", "off"],
])("persists the %s promotional email frequency", async (frequency, loadedFrequency) => {
  mockLoadedPreferences({
    promoFrequency: loadedFrequency,
    promoEmails: loadedFrequency !== "off",
  });
  render(<UserPreferences />);

  await waitFor(() => expect(screen.getByRole("checkbox").checked).toBe(true));
  fireEvent.change(screen.getByLabelText("Promotional email frequency"), {
    target: { value: frequency },
  });

  await waitForSave({ promoFrequency: frequency, promoEmails: frequency !== "off" });
});
```

</details>

<details>
<summary>src/__tests__/pages/Settings/userPreferencesUtils.test.js</summary>

[Open source](../src/__tests__/pages/Settings/userPreferencesUtils.test.js)

```javascript
import { isValidContactPhone, preferenceChanges } from "../../../pages/Settings/userPreferencesUtils";

describe("isValidContactPhone", () => {
  it.each(["", "   ", "7165551234", "(716) 555-1234", "+1 716 555 1234", "1-716-555-1234"])(
    "accepts %p",
    (value) => {
      expect(isValidContactPhone(value)).toBe(true);
    },
  );

  it("treats a missing value as blank", () => {
    expect(isValidContactPhone(null)).toBe(true);
  });

  // Ten valid digits with a stray character on either end: only the character
  // check can reject these, so both regex anchors are pinned.
  it.each(["1", "+", "((((1", "716555123", "2716555123 4", "716-555-12345", "call me", "7165551234x", "x7165551234"])(
    "rejects %p",
    (value) => {
      expect(isValidContactPhone(value)).toBe(false);
    },
  );
});

describe("preferenceChanges", () => {
  const saved = {
    promoFrequency: "weekly",
    revealContact: true,
    contactPhone: "(716) 555-1234",
    interests: ["Books", "Electronics"],
  };

  it("returns null when nothing changed", () => {
    expect(preferenceChanges(saved, { ...saved, interests: ["Books", "Electronics"] })).toBeNull();
  });

  it("sends the page's fields once any of them changed", () => {
    expect(preferenceChanges(saved, { ...saved, revealContact: false })).toEqual({
      promoFrequency: "weekly",
      promoEmails: true,
      revealContact: false,
      contactPhone: "(716) 555-1234",
      interests: ["Books", "Electronics"],
    });
  });

  it("sends a change to interests alone, including a reorder", () => {
    expect(preferenceChanges(saved, { ...saved, interests: ["Books"] })).toMatchObject({
      interests: ["Books"],
    });
    expect(
      preferenceChanges(saved, { ...saved, interests: ["Electronics", "Books"] }),
    ).toMatchObject({ interests: ["Electronics", "Books"] });
    // Same length and first item, different second item.
    expect(
      preferenceChanges(saved, { ...saved, interests: ["Books", "Furniture"] }),
    ).toMatchObject({ interests: ["Books", "Furniture"] });
  });

  it("sends the phone number trimmed", () => {
    expect(
      preferenceChanges(saved, { ...saved, contactPhone: " (716) 555-9999 " }),
    ).toMatchObject({ contactPhone: "(716) 555-9999" });
  });

  it("never includes theme, which the theme hook saves on its own", () => {
    const changes = preferenceChanges(saved, { ...saved, promoFrequency: "off", theme: "dark" });
    expect(changes).not.toHaveProperty("theme");
    expect(changes).toMatchObject({ promoFrequency: "off", promoEmails: false });
  });

  it("holds back a half-typed phone number instead of sending it", () => {
    expect(preferenceChanges(saved, { ...saved, contactPhone: "716 55" })).toBeNull();
    const changes = preferenceChanges(saved, {
      ...saved,
      contactPhone: "716 55",
      revealContact: false,
    });
    expect(changes).toMatchObject({ revealContact: false });
    expect(changes).not.toHaveProperty("contactPhone");
  });

  it("sends a cleared phone number", () => {
    expect(preferenceChanges(saved, { ...saved, contactPhone: "" })).toMatchObject({
      contactPhone: "",
    });
  });

  it("returns null before preferences have loaded", () => {
    expect(preferenceChanges(null, saved)).toBeNull();
  });
});
```

</details>

<details>
<summary>src/__tests__/pages/Wishlist/components/RemoveWishlistItemModal.test.jsx</summary>

[Open source](../src/__tests__/pages/Wishlist/components/RemoveWishlistItemModal.test.jsx)

```jsx
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RemoveWishlistItemModal from "../../../../pages/Wishlist/components/RemoveWishlistItemModal";

test("blocks duplicate removal while the request is running", () => {
  const onConfirm = jest.fn();
  render(
    <RemoveWishlistItemModal
      item={{ id: 7, title: "Desk lamp" }}
      removing={true}
      onCancel={jest.fn()}
      onConfirm={onConfirm}
    />,
  );

  const removeButton = screen.getByRole("button", { name: "Removing..." });
  expect(removeButton).toBeDisabled();
  fireEvent.click(removeButton);
  expect(onConfirm).not.toHaveBeenCalled();
});
```

</details>

<details>
<summary>src/__tests__/pages/Wishlist/utils/wishlistUtils.test.js</summary>

[Open source](../src/__tests__/pages/Wishlist/utils/wishlistUtils.test.js)

```javascript
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
```

</details>

<details>
<summary>src/__tests__/utils/apiClient.test.js</summary>

[Open source](../src/__tests__/utils/apiClient.test.js)

```javascript
import { apiGetJson, apiPostJson, csrfPostJson, readApiError, readJsonResponse } from "../../utils/apiClient";
import { csrfFetch } from "../../utils/csrfFetch";

jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const reply = (body, init = {}) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: init.noHeaders ? undefined : new Headers(init.headers || { "content-type": "application/json" }),
    text: init.text || jest.fn().mockResolvedValue(text),
  };
};

beforeEach(() => {
  global.fetch = jest.fn();
  csrfFetch.mockReset();
});

describe("readJsonResponse", () => {
  test("empty bodies are null; JSON is parsed; anything else is a deliberate error", async () => {
    await expect(readJsonResponse(reply(""))).resolves.toBeNull();
    await expect(readJsonResponse(reply('{"a":1}'))).resolves.toEqual({ a: 1 });
    await expect(readJsonResponse(reply("[1,2]"))).resolves.toEqual([1, 2]);
    await expect(readJsonResponse(reply("0"))).resolves.toBe(0);
    await expect(readJsonResponse(reply("<html>"))).rejects.toThrow("Invalid JSON response");
  });
});

describe("readApiError", () => {
  const failure = (body, init = {}) => reply(body, { ok: false, status: 400, ...init });

  test("JSON errors prefer error, then message, then the fallback", async () => {
    await expect(readApiError(failure({ error: "E", message: "M" }))).resolves.toBe("E");
    await expect(readApiError(failure({ message: "M" }))).resolves.toBe("M");
    await expect(readApiError(failure({}), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure({ error: "" }), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure(""), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure("null"), "Fallback")).resolves.toBe("Fallback");
  });

  test("the default fallback names the HTTP status", async () => {
    await expect(readApiError(failure({}, { status: 418 }))).resolves.toBe("HTTP 418");
    await expect(readApiError(failure({}, { status: 418 }), "")).resolves.toBe("HTTP 418");
  });

  test("a JSON content type is recognised anywhere in the header", async () => {
    const headers = { "content-type": "application/json; charset=utf-8" };
    await expect(readApiError(failure({ error: "E" }, { headers }))).resolves.toBe("E");
  });

  test("non-JSON bodies are shown as text, cut to 200 characters", async () => {
    const headers = { "content-type": "text/plain" };
    await expect(readApiError(failure("Plain failure", { headers }))).resolves.toBe("Plain failure");
    await expect(readApiError(failure("x".repeat(300), { headers }))).resolves.toBe("x".repeat(200));
    await expect(readApiError(failure("", { headers }), "Fallback")).resolves.toBe("Fallback");
  });

  test("a response with no headers is treated as plain text", async () => {
    await expect(readApiError(failure("Boom", { noHeaders: true }))).resolves.toBe("Boom");
    const noGet = failure("Boom");
    noGet.headers = {};
    await expect(readApiError(noGet)).resolves.toBe("Boom");
  });

  test("unreadable bodies fall back instead of throwing", async () => {
    await expect(readApiError(failure("{bad", {}), "Fallback")).resolves.toBe("Fallback");
    const broken = failure("x", { headers: { "content-type": "text/plain" }, text: jest.fn().mockRejectedValue(new Error("gone")) });
    await expect(readApiError(broken, "Fallback")).resolves.toBe("Fallback");
  });
});

describe("apiGetJson", () => {
  test("sends a credentialed GET asking for JSON, and returns the parsed answer", async () => {
    global.fetch.mockResolvedValue(reply({ items: [1] }));
    await expect(apiGetJson("/api/list")).resolves.toEqual({ items: [1] });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/list");
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Accept")).toBe("application/json");
    expect(options.body).toBeUndefined();
  });

  test("the caller's options are respected, but the method is always GET", async () => {
    global.fetch.mockResolvedValue(reply({}));
    const signal = new AbortController().signal;
    await apiGetJson("/api/list", {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { "X-Trace": "abc", Accept: "text/plain" },
    });
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("omit");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("X-Trace")).toBe("abc");
    expect(options.headers.get("Accept")).toBe("text/plain");
  });

  test("an empty answer is null, and an error status throws the server's message", async () => {
    global.fetch.mockResolvedValueOnce(reply(""));
    await expect(apiGetJson("/api/list")).resolves.toBeNull();
    global.fetch.mockResolvedValueOnce(reply({ error: "Nope" }, { ok: false, status: 403 }));
    await expect(apiGetJson("/api/list")).rejects.toThrow("Nope");
    global.fetch.mockResolvedValueOnce(reply("", { ok: false, status: 502 }));
    await expect(apiGetJson("/api/list")).rejects.toThrow("HTTP 502");
  });
});

describe("apiPostJson", () => {
  test("sends a credentialed JSON POST", async () => {
    global.fetch.mockResolvedValue(reply({ ok: true }));
    await expect(apiPostJson("/api/search", { q: "lamp" })).resolves.toEqual({ ok: true });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/search");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Accept")).toBe("application/json");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.body).toBe('{"q":"lamp"}');
  });

  test("a missing or empty body is sent as an empty object", async () => {
    global.fetch.mockResolvedValue(reply({}));
    await apiPostJson("/api/x");
    await apiPostJson("/api/x", null);
    await apiPostJson("/api/x", undefined, {});
    for (const [, options] of global.fetch.mock.calls) expect(options.body).toBe("{}");
  });

  test("a falsy-but-real body is still sent as given only when it is an object", async () => {
    global.fetch.mockResolvedValue(reply({}));
    await apiPostJson("/api/x", []);
    expect(global.fetch.mock.calls[0][1].body).toBe("[]");
    await apiPostJson("/api/x", 0);
    expect(global.fetch.mock.calls[1][1].body).toBe("{}");
  });

  test("custom headers and credentials override the defaults; the method cannot be changed", async () => {
    global.fetch.mockResolvedValue(reply({}));
    const signal = new AbortController().signal;
    await apiPostJson("/api/x", { a: 1 }, {
      method: "DELETE",
      credentials: "same-origin",
      signal,
      headers: { "Content-Type": "application/vnd.api+json", "X-Trace": "abc" },
    });
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("same-origin");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("Content-Type")).toBe("application/vnd.api+json");
    expect(options.headers.get("X-Trace")).toBe("abc");
    expect(options.headers.get("Accept")).toBe("application/json");
  });

  test("failures throw the server's message", async () => {
    global.fetch.mockResolvedValue(reply({ message: "Bad input" }, { ok: false, status: 422 }));
    await expect(apiPostJson("/api/x", {})).rejects.toThrow("Bad input");
  });
});

describe("csrfPostJson", () => {
  test("goes through csrfFetch as a credentialed JSON POST by default", async () => {
    csrfFetch.mockResolvedValue(reply({ saved: true }));
    await expect(csrfPostJson("/api/save", { title: "Lamp" })).resolves.toEqual({ saved: true });
    expect(global.fetch).not.toHaveBeenCalled();
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toBe("/api/save");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.body).toBe('{"title":"Lamp"}');
  });

  test("another mutating method can be requested", async () => {
    csrfFetch.mockResolvedValue(reply({}));
    await csrfPostJson("/api/save", {}, { method: "PUT" });
    await csrfPostJson("/api/save", {}, { method: "DELETE" });
    expect(csrfFetch.mock.calls.map(([, options]) => options.method)).toEqual(["PUT", "DELETE"]);
  });

  test("an empty body is an empty object, and failures throw the server's message", async () => {
    csrfFetch.mockResolvedValueOnce(reply({}));
    await csrfPostJson("/api/save");
    expect(csrfFetch.mock.calls[0][1].body).toBe("{}");
    csrfFetch.mockResolvedValueOnce(reply({ error: "Forbidden" }, { ok: false, status: 403 }));
    await expect(csrfPostJson("/api/save", {})).rejects.toThrow("Forbidden");
  });
});
```

</details>

<details>
<summary>src/__tests__/utils/csrfFetch.test.js</summary>

[Open source](../src/__tests__/utils/csrfFetch.test.js)

```javascript
import { clearCsrfToken, csrfFetch, getCsrfToken } from "../../utils/csrfFetch";

// Plain async functions, not jest.fn(): react-scripts resets mocks before each
// test, which would empty responses built while the test.each tables are read.
const json = (body, init = {}) => {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
  response.clone = () => json(body, init);
  return response;
};
const notJson = (status = 200, ok = true) => {
  const response = {
    ok,
    status,
    json: async () => {
      throw new SyntaxError("not json");
    },
  };
  response.clone = () => notJson(status, ok);
  return response;
};
const tokenReply = (token) => json({ csrf_token: token });
const csrfRejected = () => json({ code: "csrf_invalid", error: "bad token" }, { ok: false, status: 403 });
const bodyOf = (callIndex) => JSON.parse(global.fetch.mock.calls[callIndex][1].body);

beforeEach(() => {
  clearCsrfToken();
  global.fetch = jest.fn();
});
afterEach(() => clearCsrfToken());

describe("getCsrfToken", () => {
  test("asks the server once, with the session cookie, and reuses the answer", async () => {
    global.fetch.mockResolvedValue(tokenReply("t1"));
    await expect(getCsrfToken()).resolves.toBe("t1");
    await expect(getCsrfToken()).resolves.toBe("t1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/get_csrf_token\.php$/);
    expect(options).toEqual({
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  });

  test("simultaneous callers share one request", async () => {
    global.fetch.mockResolvedValue(tokenReply("t1"));
    await Promise.all([getCsrfToken(), getCsrfToken(), getCsrfToken()]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("clearing the token makes the next call ask again", async () => {
    global.fetch.mockResolvedValueOnce(tokenReply("t1")).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).resolves.toBe("t1");
    clearCsrfToken();
    await expect(getCsrfToken()).resolves.toBe("t2");
  });

  test.each([
    ["the server's own error message", json({ error: "Session expired" }, { ok: false, status: 401 }), "Session expired"],
    ["a default message when the error has no text", json({}, { ok: false, status: 500 }), "Unable to get CSRF token"],
    ["a default message when a good response carries no token", json({ ok: true }), "Unable to get CSRF token"],
    ["a default message when a good response has an empty token", json({ csrf_token: "" }), "Unable to get CSRF token"],
    ["a default message for an unreadable body", notJson(200, true), "Unable to get CSRF token"],
    ["a default message for an unreadable error body", notJson(500, false), "Unable to get CSRF token"],
  ])("fails with %s", async (_label, reply, message) => {
    global.fetch.mockResolvedValue(reply);
    await expect(getCsrfToken()).rejects.toThrow(message);
  });

  test("a failed lookup is not remembered; the next call tries again", async () => {
    global.fetch.mockResolvedValueOnce(json({}, { ok: false, status: 500 })).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).rejects.toThrow();
    await expect(getCsrfToken()).resolves.toBe("t2");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("a network failure is not remembered either", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).rejects.toThrow("offline");
    await expect(getCsrfToken()).resolves.toBe("t2");
  });
});

describe("csrfFetch: requests that need no token", () => {
  test.each([undefined, "GET", "get", "HEAD", "OPTIONS"])("method %p goes straight through untouched", async (method) => {
    global.fetch.mockResolvedValue(json({ ok: true }));
    const options = method === undefined ? {} : { method };
    const result = await csrfFetch("/api/read", options);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/read", options);
    expect(result).toBe(await global.fetch.mock.results[0].value);
  });

  test("a call with no options at all is a plain fetch", async () => {
    global.fetch.mockResolvedValue(json({}));
    await csrfFetch("/api/read");
    expect(global.fetch).toHaveBeenCalledWith("/api/read", {});
  });
});

describe("csrfFetch: attaching the token", () => {
  beforeEach(() => {
    global.fetch.mockImplementation(async (url) => (String(url).includes("get_csrf_token") ? tokenReply("tok") : json({ ok: true })));
  });

  test.each(["POST", "post", "PUT", "PATCH", "DELETE", "delete"])("%s carries the token", async (method) => {
    await csrfFetch("/api/save", { method });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe("/api/save");
    expect(options.method).toBe(method.toUpperCase());
    expect(JSON.parse(options.body)).toEqual({ csrf_token: "tok" });
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });

  test("a JSON body keeps its fields and gains the token; the token cannot be overridden by the caller", async () => {
    await csrfFetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lamp", csrf_token: "forged" }),
    });
    expect(bodyOf(1)).toEqual({ name: "Lamp", csrf_token: "tok" });
  });

  test("other request options and headers are preserved", async () => {
    const signal = new AbortController().signal;
    await csrfFetch("/api/save", {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", "X-Trace": "abc" },
      body: "{}",
    });
    const options = global.fetch.mock.calls[1][1];
    expect(options.credentials).toBe("include");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("X-Trace")).toBe("abc");
  });

  test("a body given as a plain object is merged the same way", async () => {
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: { a: 1 } });
    expect(bodyOf(1)).toEqual({ a: 1, csrf_token: "tok" });
  });

  test("JSON that is not an object (a list, null, a number) is replaced rather than merged", async () => {
    for (const body of ["[1,2]", "null", "5", '"text"', "true"]) {
      global.fetch.mockClear();
      await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      // The token is cached after the first pass, so the POST is the only call.
      expect(bodyOf(global.fetch.mock.calls.length - 1)).toEqual({ csrf_token: "tok" });
    }
    global.fetch.mockClear();
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: [1, 2] });
    expect(bodyOf(global.fetch.mock.calls.length - 1)).toEqual({ csrf_token: "tok" });
  });

  test("a body that is not valid JSON stops the request before it is sent", async () => {
    await expect(
      csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" }),
    ).rejects.toThrow("Invalid JSON request body");
    expect(global.fetch.mock.calls.every(([url]) => String(url).includes("get_csrf_token"))).toBe(true);
  });

  test("a non-JSON body is sent as it was, with no token added", async () => {
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hello" });
    const options = global.fetch.mock.calls[1][1];
    expect(options.body).toBe("hello");
    expect(options.method).toBe("POST");
  });

  test("form uploads get the token as a field and keep every other field; the original form is untouched", async () => {
    const form = new FormData();
    form.append("title", "Lamp");
    form.append("csrf_token", "forged");
    form.append("photo", new File(["x"], "a.png", { type: "image/png" }));

    await csrfFetch("/api/upload", { method: "POST", body: form });

    const sent = global.fetch.mock.calls[1][1].body;
    expect(sent).toBeInstanceOf(FormData);
    expect(sent).not.toBe(form);
    expect(sent.get("title")).toBe("Lamp");
    expect(sent.getAll("csrf_token")).toEqual(["tok"]);
    expect(sent.get("photo").name).toBe("a.png");
    expect(form.get("csrf_token")).toBe("forged");
    expect(global.fetch.mock.calls[1][1].headers).toBeUndefined();
  });

  test("the token is fetched once and reused across requests", async () => {
    await csrfFetch("/api/one", { method: "POST" });
    await csrfFetch("/api/two", { method: "POST" });
    expect(global.fetch.mock.calls.filter(([url]) => String(url).includes("get_csrf_token"))).toHaveLength(1);
  });
});

describe("csrfFetch: a stale token", () => {
  const post = () => csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":1}' });

  test("a CSRF rejection triggers exactly one retry with a fresh token, and the retry's answer is returned", async () => {
    const retryAnswer = json({ ok: true });
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(retryAnswer);
    const result = await post();
    expect(result).toBe(retryAnswer);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(bodyOf(1)).toEqual({ a: 1, csrf_token: "old" });
    expect(bodyOf(3)).toEqual({ a: 1, csrf_token: "new" });
  });

  test("if the retry is also rejected, that answer is returned and nothing more is sent", async () => {
    const second = csrfRejected();
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(second);
    await expect(post()).resolves.toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  test("the refreshed token is kept for later requests", async () => {
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ok: true }));
    await post();
    await post();
    expect(bodyOf(4).csrf_token).toBe("new");
  });

  test.each([
    ["a permission denial", json({ error: "Forbidden" }, { ok: false, status: 403 })],
    ["a 403 with a different code", json({ code: "banned" }, { ok: false, status: 403 })],
    ["a 403 with an unreadable body", notJson(403, false)],
    ["a 401", json({ code: "csrf_invalid" }, { ok: false, status: 401 })],
    ["a 500", json({ code: "csrf_invalid" }, { ok: false, status: 500 })],
    ["a success", json({ code: "csrf_invalid" })],
    ["a 403 with no body at all", json(null, { ok: false, status: 403 })],
  ])("%s is returned as it is, without a retry", async (_label, reply) => {
    global.fetch.mockResolvedValueOnce(tokenReply("t")).mockResolvedValueOnce(reply);
    await expect(post()).resolves.toBe(reply);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("a failure while refreshing the token is reported, not swallowed", async () => {
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(json({ error: "Session expired" }, { ok: false, status: 401 }));
    await expect(post()).rejects.toThrow("Session expired");
  });

  test("the original response is left readable for the caller when no retry happens", async () => {
    const reply = json({ error: "Forbidden" }, { ok: false, status: 403 });
    global.fetch.mockResolvedValueOnce(tokenReply("t")).mockResolvedValueOnce(reply);
    const result = await post();
    await expect(result.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
```

</details>

<details>
<summary>src/__tests__/utils/formatters.test.js</summary>

[Open source](../src/__tests__/utils/formatters.test.js)

```javascript
import {
  coerceBoolean,
  coerceNumber,
  compareDateAsc,
  compareDateDesc,
  dateTimestamp,
  formatCurrency,
  formatDate,
  formatDateTime,
  humanizeStatus,
  parseDateValue,
  parseListField,
} from "../../utils/formatters";

describe("parseListField", () => {
  test("arrays and JSON arrays are kept, minus empty entries", () => {
    expect(parseListField(["a", "", null, "b", 0, undefined])).toEqual(["a", "b"]);
    expect(parseListField('["a","",null,"b"]')).toEqual(["a", "b"]);
    expect(parseListField("[]")).toEqual([]);
  });

  test("anything else that is a string is split on commas, trimmed, without blanks", () => {
    expect(parseListField("a, b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseListField("solo")).toEqual(["solo"]);
    expect(parseListField("")).toEqual([]);
    expect(parseListField(" , ")).toEqual([]);
    // JSON that is not a list is text, not data.
    expect(parseListField('{"a":1}')).toEqual(['{"a":1}']);
    expect(parseListField("123")).toEqual(["123"]);
    expect(parseListField("[bad, json")).toEqual(["[bad", "json"]);
  });

  test("non-strings that are not arrays give an empty list", () => {
    for (const value of [null, undefined, 5, {}, true]) {
      expect(parseListField(value)).toEqual([]);
    }
  });
});

describe("coerceNumber", () => {
  test.each([
    [12, 12],
    [0, 0],
    [-3.5, -3.5],
    ["12", 12],
    ["0", 0],
    ["+12", 12],
    ["-12.5", -12.5],
    ["$12", 12],
    ["-$12", -12],
    ["$1,234.50", 1234.5],
    ["1,234,567", 1234567],
    ["  7  ", 7],
    [".5", 0.5],
    ["12.", null],
  ])("%p becomes %p", (input, expected) => {
    expect(coerceNumber(input)).toBe(expected);
  });

  test.each([
    null,
    undefined,
    "",
    "   ",
    "abc",
    "12abc",
    "abc12",
    "$",
    "1,23",
    "12,34",
    "1,2345",
    "1e3",
    "1 2",
    "--5",
    "$$5",
    "12 dollars",
    NaN,
    Infinity,
    -Infinity,
    true,
    {},
    [],
  ])("%p is rejected", (input) => {
    expect(coerceNumber(input)).toBeNull();
  });

  test("a huge digit string that overflows is rejected", () => {
    expect(coerceNumber("9".repeat(400))).toBeNull();
  });
});

describe("coerceBoolean", () => {
  test.each([true, "1", "true", "TRUE", " yes ", "Y", "completed", "success", "Successful", 1, 2, -1])(
    "%p is true",
    (value) => {
      expect(coerceBoolean(value)).toBe(true);
    },
  );

  test.each([false, "0", "false", "No", "n", "FAILED", 0])("%p is false", (value) => {
    expect(coerceBoolean(value)).toBe(false);
  });

  test.each(["", "   ", "maybe", "2", "truthy", null, undefined, {}, []])("%p is undecided (null)", (value) => {
    expect(coerceBoolean(value)).toBeNull();
  });
});

describe("parseDateValue", () => {
  test("passes a valid Date through and rejects an invalid one", () => {
    const date = new Date(2026, 0, 15);
    expect(parseDateValue(date)).toBe(date);
    expect(parseDateValue(new Date("bad"))).toBeNull();
  });

  test("numbers are milliseconds, including zero", () => {
    expect(parseDateValue(1700000000000).getTime()).toBe(1700000000000);
    expect(parseDateValue(0).getTime()).toBe(0);
    expect(parseDateValue(NaN)).toBeNull();
    expect(parseDateValue(Infinity)).toBeNull();
    expect(parseDateValue(8.64e15 + 1)).toBeNull();
  });

  test("strings: ISO, space-separated, and zone-less forms", () => {
    expect(parseDateValue("2026-01-15T12:00:00Z").getTime()).toBe(Date.UTC(2026, 0, 15, 12));
    expect(parseDateValue(" 2026-01-15T12:00:00Z ").getTime()).toBe(Date.UTC(2026, 0, 15, 12));
    // A space between date and time is read as local time, the same as a T.
    expect(parseDateValue("2026-01-15 12:30:00").getTime()).toBe(new Date(2026, 0, 15, 12, 30).getTime());
    expect(parseDateValue("2026-01-15T12:30:00").getTime()).toBe(new Date(2026, 0, 15, 12, 30).getTime());
  });

  test("only the first space becomes a T", () => {
    expect(parseDateValue("2026-01-15 12:30:00 extra")).toBeNull();
  });

  test("everything else is null", () => {
    for (const value of ["", "   ", "not-a-date", null, undefined, false, {}, []]) {
      expect(parseDateValue(value)).toBeNull();
    }
  });
});

describe("dateTimestamp and the comparators", () => {
  test("timestamp, or the fallback for anything unreadable", () => {
    expect(dateTimestamp("2026-01-15T12:00:00Z")).toBe(Date.UTC(2026, 0, 15, 12));
    expect(dateTimestamp("bad")).toBeNull();
    expect(dateTimestamp("bad", 7)).toBe(7);
    expect(dateTimestamp(0, 7)).toBe(0);
    expect(dateTimestamp(null, 0)).toBe(0);
  });

  test("ascending puts earlier first and undated last; equal is zero", () => {
    expect(compareDateAsc("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBeLessThan(0);
    expect(compareDateAsc("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateAsc("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
    expect(compareDateAsc("bad", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateAsc("bad", "worse")).toBe(0);
    expect(compareDateAsc("bad", "2026-01-01T00:00:00Z", 0)).toBeLessThan(0);
  });

  test("descending puts later first and undated last; equal is zero", () => {
    expect(compareDateDesc("2026-01-02T00:00:00Z", "2026-01-01T00:00:00Z")).toBeLessThan(0);
    expect(compareDateDesc("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateDesc("2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
    expect(compareDateDesc("bad", "2026-01-01T00:00:00Z")).toBeGreaterThan(0);
    expect(compareDateDesc("bad", "worse")).toBe(0);
  });
});

describe("formatDate and formatDateTime", () => {
  // Zone-less strings are read as local time, so these hold in any time zone.
  test("dates show the month, day and year written", () => {
    const text = formatDate("2026-01-15 12:00:00");
    expect(text).toContain("Jan");
    expect(text).toContain("15");
    expect(text).toContain("2026");
    expect(text).not.toMatch(/12|PM|AM/);
  });

  test("date-times add a 12-hour clock", () => {
    const text = formatDateTime("2026-01-15 13:05:00");
    expect(text).toContain("Jan");
    expect(text).toContain("15");
    expect(text).toContain("2026");
    expect(text).toMatch(/1:05\s?PM/i);
    expect(formatDateTime("2026-01-15 00:07:00")).toMatch(/12:07\s?AM/i);
  });

  test("unreadable values are shown as written, and an invalid Date as blank", () => {
    expect(formatDate("soon")).toBe("soon");
    expect(formatDateTime("soon")).toBe("soon");
    expect(formatDate(null)).toBe("null");
    expect(formatDate(undefined)).toBe("undefined");
    expect(formatDateTime("")).toBe("");
    expect(formatDate(new Date("bad"))).toBe("");
    expect(formatDateTime(new Date("bad"))).toBe("");
  });

  test("a formatting failure falls back to the raw value", () => {
    const spy = jest.spyOn(Date.prototype, "toLocaleDateString").mockImplementation(() => {
      throw new RangeError("bad locale");
    });
    const spyTime = jest.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => {
      throw new RangeError("bad locale");
    });
    try {
      expect(formatDate("2026-01-15 12:00:00")).toBe("2026-01-15 12:00:00");
      expect(formatDateTime("2026-01-15 12:00:00")).toBe("2026-01-15 12:00:00");
    } finally {
      spy.mockRestore();
      spyTime.mockRestore();
    }
  });
});

describe("formatCurrency", () => {
  test("US dollars with two decimals and thousands separators", () => {
    expect(formatCurrency(12)).toBe("$12.00");
    expect(formatCurrency("12.5")).toBe("$12.50");
    expect(formatCurrency(0)).toBe("$0.00");
    expect(formatCurrency(1234567.891)).toBe("$1,234,567.89");
    expect(formatCurrency(-5)).toBe("-$5.00");
  });

  test("empty and non-numeric values give null", () => {
    for (const value of [null, undefined, "", "abc", NaN]) {
      expect(formatCurrency(value)).toBeNull();
    }
  });
});

describe("humanizeStatus", () => {
  test("underscores and hyphens become spaces and each word is capitalised", () => {
    expect(humanizeStatus("in_progress")).toBe("In Progress");
    expect(humanizeStatus("needs-response")).toBe("Needs Response");
    expect(humanizeStatus("a__b--c")).toBe("A B C");
    expect(humanizeStatus("  padded_value  ")).toBe("Padded Value");
    expect(humanizeStatus("ALREADY_UPPER")).toBe("ALREADY UPPER");
    expect(humanizeStatus("sold")).toBe("Sold");
  });

  test("zero is a value; other empty input gives an empty string", () => {
    expect(humanizeStatus(0)).toBe("0");
    expect(humanizeStatus(7)).toBe("7");
    for (const value of ["", "   ", "___", "-", null, undefined, false]) {
      expect(humanizeStatus(value)).toBe("");
    }
  });
});
```

</details>

<details>
<summary>src/__tests__/utils/imageFallback.test.js</summary>

[Open source](../src/__tests__/utils/imageFallback.test.js)

```javascript
import {
  FALLBACK_IMAGE_URL,
  isVideoMediaUrl,
  onProductImageError,
  resolveProductPhotoUrl,
  resolveProductPhotoUrls,
  resolveStoredImageUrl,
  withFallbackImage,
} from "../../utils/imageFallback";

const API = "https://api.example.test/api";
const proxied = (path) => `${API}/media/image.php?url=${encodeURIComponent(path)}`;

describe("resolveStoredImageUrl", () => {
  test("blank and non-string input resolve to nothing", () => {
    expect(resolveStoredImageUrl("", API)).toBe("");
    expect(resolveStoredImageUrl("   ", API)).toBe("");
    expect(resolveStoredImageUrl(null, API)).toBe("");
    expect(resolveStoredImageUrl(42, API)).toBe("");
    expect(resolveStoredImageUrl({ url: "/images/a.jpg" }, API)).toBe("");
  });

  test.each(["/data/images/a.jpg", "/images/a.jpg", "/media/a.jpg"])(
    "proxies the stored path %s through the API",
    (path) => {
      expect(resolveStoredImageUrl(path, API)).toBe(proxied(path));
      expect(resolveStoredImageUrl(`  ${path}  `, API)).toBe(proxied(path));
    },
  );

  test("an absolute URL is proxied by path, keeping its query string", () => {
    expect(resolveStoredImageUrl("https://app.example.test/images/a.jpg?v=2", API)).toBe(
      proxied("/images/a.jpg?v=2"),
    );
    expect(resolveStoredImageUrl("HTTP://app.example.test/media/a.jpg", API)).toBe(proxied("/media/a.jpg"));
  });

  test("other paths and external hosts are returned unchanged", () => {
    expect(resolveStoredImageUrl("/uploads/a.jpg", API)).toBe("/uploads/a.jpg");
    expect(resolveStoredImageUrl("https://cdn.example.test/products/a.jpg", API)).toBe(
      "https://cdn.example.test/products/a.jpg",
    );
    // The prefix must be at the start of the path, not just somewhere in it.
    expect(resolveStoredImageUrl("https://cdn.example.test/x/images/a.jpg", API)).toBe(
      "https://cdn.example.test/x/images/a.jpg",
    );
    expect(resolveStoredImageUrl("images/a.jpg", API)).toBe("images/a.jpg");
  });

  test("blob, data and already-proxied URLs pass straight through", () => {
    for (const url of [
      "blob:https://app.example.test/1234",
      "BLOB:abc",
      "data:image/png;base64,abcd",
      "DATA:image/png;base64,abcd",
      `${API}/media/image.php?url=%2Fimages%2Fa.jpg`,
      "/media/image.php?url=%2Fimages%2Fa.jpg",
    ]) {
      expect(resolveStoredImageUrl(url, API)).toBe(url);
    }
  });

  test("without an API base nothing is proxied; a trailing slash on the base is ignored", () => {
    expect(resolveStoredImageUrl("/images/a.jpg", "")).toBe("/images/a.jpg");
    expect(resolveStoredImageUrl("/images/a.jpg", undefined)).toBe("/images/a.jpg");
    expect(resolveStoredImageUrl("/images/a.jpg", `${API}/`)).toBe(proxied("/images/a.jpg"));
  });

  test("an unparseable absolute URL is left alone", () => {
    expect(resolveStoredImageUrl("http://", API)).toBe("http://");
  });
});

describe("resolveProductPhotoUrl", () => {
  test("blank input resolves to nothing and passthrough URLs are untouched", () => {
    expect(resolveProductPhotoUrl("", { apiBase: API })).toBe("");
    expect(resolveProductPhotoUrl(undefined, { apiBase: API })).toBe("");
    expect(resolveProductPhotoUrl("data:image/png;base64,abcd", { apiBase: API })).toBe("data:image/png;base64,abcd");
    expect(resolveProductPhotoUrl("blob:abc", { apiBase: API })).toBe("blob:abc");
  });

  test("stored paths are proxied when there is an API base", () => {
    expect(resolveProductPhotoUrl("/images/a.jpg", { apiBase: API })).toBe(proxied("/images/a.jpg"));
    expect(resolveProductPhotoUrl("/images/a.jpg", { apiBase: `${API}/` })).toBe(proxied("/images/a.jpg"));
  });

  test("unknown relative paths are proxied only when asked, and never absolute URLs", () => {
    expect(resolveProductPhotoUrl("uploads/a.jpg", { apiBase: API })).toBe("uploads/a.jpg");
    expect(resolveProductPhotoUrl("uploads/a.jpg", { apiBase: API, proxyUnknown: true })).toBe(
      proxied("uploads/a.jpg"),
    );
    expect(
      resolveProductPhotoUrl("https://cdn.example.test/a.jpg", { apiBase: API, proxyUnknown: true }),
    ).toBe("https://cdn.example.test/a.jpg");
    expect(resolveProductPhotoUrl("uploads/a.jpg", { proxyUnknown: true })).toBe("uploads/a.jpg");
  });

  test("passthrough is case-insensitive and must be a prefix, even when unknown paths are proxied", () => {
    const opts = { apiBase: API, proxyUnknown: true };
    expect(resolveProductPhotoUrl("BLOB:abc", opts)).toBe("BLOB:abc");
    expect(resolveProductPhotoUrl("Data:image/png;base64,abcd", opts)).toBe("Data:image/png;base64,abcd");
    // "blob:" / "data:" only count at the start.
    expect(resolveProductPhotoUrl("myblob:abc", opts)).toBe(proxied("myblob:abc"));
    expect(resolveProductPhotoUrl("metadata:abc", opts)).toBe(proxied("metadata:abc"));
    // An http URL is external (never proxied), whatever the case.
    expect(resolveProductPhotoUrl("http://cdn.example.test/a.jpg", opts)).toBe("http://cdn.example.test/a.jpg");
    expect(resolveProductPhotoUrl("HTTPS://cdn.example.test/a.jpg", opts)).toBe("HTTPS://cdn.example.test/a.jpg");
  });

  test("with no API base, root paths get the public base and others are unchanged", () => {
    expect(resolveProductPhotoUrl("/images/a.jpg", { publicBase: "/app" })).toBe("/app/images/a.jpg");
    expect(resolveProductPhotoUrl("/images/a.jpg", { publicBase: "/app/" })).toBe("/app/images/a.jpg");
    expect(resolveProductPhotoUrl("/images/a.jpg")).toBe("/images/a.jpg");
    expect(resolveProductPhotoUrl("uploads/a.jpg", { publicBase: "/app" })).toBe("uploads/a.jpg");
    expect(resolveProductPhotoUrl("/x/a.jpg", { apiBase: API, publicBase: "/app" })).toBe("/app/x/a.jpg");
  });
});

describe("resolveProductPhotoUrls", () => {
  const options = { apiBase: API };

  test("accepts an array, a JSON string, and a comma-separated string", () => {
    const expected = [proxied("/images/a.jpg"), proxied("/images/b.jpg")];
    expect(resolveProductPhotoUrls(["/images/a.jpg", "/images/b.jpg"], options)).toEqual(expected);
    expect(resolveProductPhotoUrls('["/images/a.jpg","/images/b.jpg"]', options)).toEqual(expected);
    expect(resolveProductPhotoUrls("/images/a.jpg,/images/b.jpg", options)).toEqual(expected);
    expect(resolveProductPhotoUrls("/images/a.jpg", options)).toEqual([proxied("/images/a.jpg")]);
  });

  test("a JSON string that is not a list falls back to comma splitting", () => {
    expect(resolveProductPhotoUrls('"/images/a.jpg"', options)).toEqual(['"/images/a.jpg"']);
    expect(resolveProductPhotoUrls("123", options)).toEqual(["123"]);
  });

  test("drops blanks and anything that is not a string; other inputs give an empty list", () => {
    expect(resolveProductPhotoUrls(["", null, 5, "/images/a.jpg", "  "], options)).toEqual([
      proxied("/images/a.jpg"),
    ]);
    expect(resolveProductPhotoUrls(null, options)).toEqual([]);
    expect(resolveProductPhotoUrls(undefined)).toEqual([]);
    expect(resolveProductPhotoUrls({ a: 1 }, options)).toEqual([]);
    expect(resolveProductPhotoUrls(7, options)).toEqual([]);
  });

  test("options are optional", () => {
    expect(resolveProductPhotoUrls(["/images/a.jpg"])).toEqual(["/images/a.jpg"]);
  });
});

describe("isVideoMediaUrl", () => {
  test.each([
    "/images/clip.mp4",
    "/images/clip.WEBM",
    "/images/clip.mov",
    "  /images/clip.mp4  ",
    "/images/clip.mp4?v=2",
    "/images/clip.mp4#t=5",
    "https://cdn.example.test/clip.mp4",
  ])("%p is a video", (url) => {
    expect(isVideoMediaUrl(url)).toBe(true);
  });

  test("a proxied stored video is recognised through its url parameter", () => {
    expect(isVideoMediaUrl(proxied("/images/clip.mov"))).toBe(true);
    expect(isVideoMediaUrl("/media/image.php?url=%2Fimages%2Fclip.mp4")).toBe(true);
  });

  test.each([
    "/images/photo.jpg",
    "/images/mp4",
    "/images/clip.mp4x",
    "/images/clip.mp4.jpg",
    "/media/image.php?url=%2Fimages%2Fphoto.jpg",
    "/media/image.php",
    "",
  ])("%p is not a video", (url) => {
    expect(isVideoMediaUrl(url)).toBe(false);
  });

  test("non-strings are never videos", () => {
    expect(isVideoMediaUrl(null)).toBe(false);
    expect(isVideoMediaUrl(undefined)).toBe(false);
    expect(isVideoMediaUrl({ toString: () => "clip.mp4" })).toBe(false);
  });
});

describe("withFallbackImage", () => {
  test.each([
    "/images/a.jpg",
    "./a.jpg",
    "https://cdn.example.test/a.jpg",
    "HTTP://cdn.example.test/a.jpg",
    "blob:https://app.example.test/1234",
    "data:image/png;base64,abcd",
  ])("keeps a safe source %p", (url) => {
    expect(withFallbackImage(url)).toBe(url);
  });

  test("trims before deciding", () => {
    expect(withFallbackImage("  /images/a.jpg  ")).toBe("/images/a.jpg");
  });

  test.each([
    "",
    "   ",
    null,
    undefined,
    42,
    "javascript:alert(1)",
    "data:text/html;base64,abcd",
    "images/a.jpg",
    "ftp://host/a.jpg",
    // A safe-looking scheme later in the string does not make it safe.
    "javascript:alert('http://x')",
    "javascript:alert('blob:x')",
  ])("replaces an unsafe source %p with the placeholder", (url) => {
    expect(withFallbackImage(url)).toBe(FALLBACK_IMAGE_URL);
  });

  test("the placeholder is an inline SVG data URL", () => {
    expect(FALLBACK_IMAGE_URL.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);
    expect(decodeURIComponent(FALLBACK_IMAGE_URL)).toContain("No photo");
  });
});

describe("onProductImageError", () => {
  test("swaps in the placeholder and disarms the handler so it cannot loop", () => {
    const el = { onerror: () => {}, src: "/images/missing.jpg" };
    onProductImageError({ currentTarget: el });
    expect(el.src).toBe(FALLBACK_IMAGE_URL);
    expect(el.onerror).toBeNull();
  });
});
```

</details>

<details>
<summary>src/__tests__/utils/numericInputKeyHandlers.test.js</summary>

[Open source](../src/__tests__/utils/numericInputKeyHandlers.test.js)

```javascript
import { decimalNumericKeyDownHandler, integerNumericKeyDownHandler } from "../../utils/numericInputKeyHandlers";

// Plain functions, not jest.fn(): react-scripts resets mocks between tests.
function keyEvent(key, value = "", modifiers = {}) {
  const event = { key, currentTarget: { value }, prevented: 0, ...modifiers };
  event.preventDefault = () => {
    event.prevented += 1;
  };
  return event;
}
const blocked = (handler, key, value, modifiers) => {
  const event = keyEvent(key, value, modifiers);
  handler(event);
  return event.prevented === 1;
};

const NAV_KEYS = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];

describe.each([
  ["integer", integerNumericKeyDownHandler],
  ["decimal", decimalNumericKeyDownHandler],
])("%s handler", (_name, handler) => {
  test.each(NAV_KEYS)("never blocks %s", (key) => {
    expect(blocked(handler, key, "12.5")).toBe(false);
  });

  test.each(["0", "5", "9"])("allows the digit %s", (key) => {
    expect(blocked(handler, key, "12.5")).toBe(false);
  });

  test.each(["e", "E", "+", "-", "a", "z", " ", ",", "$", "!", "Shift", "F5"])("blocks %p", (key) => {
    expect(blocked(handler, key, "")).toBe(true);
  });

  test("blocks a longer key name that merely starts or ends with a digit", () => {
    for (const key of ["12", "1a", "a1", "Digit1", "١"]) {
      expect(blocked(handler, key, "")).toBe(true);
    }
  });

  test.each(["ctrlKey", "metaKey", "altKey"])("lets shortcuts through with %s held, so copy and paste work", (modifier) => {
    expect(blocked(handler, "v", "", { [modifier]: true })).toBe(false);
    expect(blocked(handler, "e", "", { [modifier]: true })).toBe(false);
  });

  test("lets IME and unidentified keys through, since the value is checked on change", () => {
    expect(blocked(handler, "Unidentified", "")).toBe(false);
    expect(blocked(handler, "Process", "")).toBe(false);
  });

  test("Shift alone does not unlock letters", () => {
    expect(blocked(handler, "E", "", { shiftKey: true })).toBe(true);
  });
});

describe("integer handler", () => {
  test("never allows a decimal point", () => {
    expect(blocked(integerNumericKeyDownHandler, ".", "")).toBe(true);
    expect(blocked(integerNumericKeyDownHandler, ".", "12")).toBe(true);
  });
});

describe("decimal handler", () => {
  test("allows one decimal point, on empty or whole-number fields", () => {
    expect(blocked(decimalNumericKeyDownHandler, ".", "")).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", "12")).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", "0")).toBe(false);
  });

  test("blocks a second decimal point wherever the first one is", () => {
    for (const value of ["12.5", "12.", ".5", "."]) {
      expect(blocked(decimalNumericKeyDownHandler, ".", value)).toBe(true);
    }
  });

  test("digits are still fine after the decimal point", () => {
    expect(blocked(decimalNumericKeyDownHandler, "5", "12.")).toBe(false);
  });

  test("a non-string field value is treated as text", () => {
    expect(blocked(decimalNumericKeyDownHandler, ".", 12)).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", null)).toBe(false);
    expect(blocked(decimalNumericKeyDownHandler, ".", undefined)).toBe(false);
  });

  test("blocks other punctuation", () => {
    expect(blocked(decimalNumericKeyDownHandler, ",", "1")).toBe(true);
  });
});
```

</details>

<details>
<summary>src/__tests__/utils/productDetails.test.js</summary>

[Open source](../src/__tests__/utils/productDetails.test.js)

```javascript
import { normalizeProductDetail } from "../../utils/productDetails";
import { FALLBACK_IMAGE_URL } from "../../utils/imageFallback";

describe("normalizeProductDetail", () => {
  const options = { apiBase: "https://api.example.test/api", publicBase: "" };

  test("nothing in, nothing out", () => {
    for (const value of [null, undefined, 0, ""]) {
      expect(normalizeProductDetail(value)).toBeNull();
    }
  });

  test("a bare record gets every default", () => {
    expect(normalizeProductDetail({}, options)).toEqual({
      productId: null,
      title: "Untitled",
      description: "",
      price: 0,
      photoUrls: [FALLBACK_IMAGE_URL],
      tags: [],
      itemLocation: null,
      itemCondition: null,
      trades: false,
      priceNego: false,
      sold: false,
      itemStatus: null,
      sellerId: null,
      sellerName: "Unknown Seller",
      sellerUsername: null,
      soldTo: null,
      sellerEmail: null,
      dateListed: null,
      dateSold: null,
      finalPrice: null,
    });
  });

  test("each field takes the first available alias", () => {
    const pick = (data) => normalizeProductDetail(data, options);
    expect(pick({ product_id: "p", id: "i" }).productId).toBe("p");
    expect(pick({ id: "i" }).productId).toBe("i");
    expect(pick({ product_id: 0, id: 5 }).productId).toBe(0);
    expect(pick({ title: "A", product_title: "B" }).title).toBe("A");
    expect(pick({ product_title: "B" }).title).toBe("B");
    expect(pick({ description: "A", product_description: "B" }).description).toBe("A");
    expect(pick({ product_description: "B" }).description).toBe("B");
    expect(pick({ listing_price: "3", price: "9" }).price).toBe(3);
    expect(pick({ listing_price: 0, price: 9 }).price).toBe(0);
    expect(pick({ price: "9" }).price).toBe(9);
    expect(pick({ price: "abc" }).price).toBe(0);
    expect(pick({ item_location: "A", meet_location: "B", location: "C" }).itemLocation).toBe("A");
    expect(pick({ meet_location: "B", location: "C" }).itemLocation).toBe("B");
    expect(pick({ location: "C" }).itemLocation).toBe("C");
    expect(pick({ item_condition: "A", condition: "B" }).itemCondition).toBe("A");
    expect(pick({ condition: "B" }).itemCondition).toBe("B");
  });

  test("dates: listed falls back to created_at; sold is its own field; both may be Date objects", () => {
    const pick = (data) => normalizeProductDetail(data, options);
    expect(pick({ date_listed: "2026-01-15T12:00:00Z", created_at: "2025-01-01T00:00:00Z" }).dateListed.getTime()).toBe(
      Date.UTC(2026, 0, 15, 12),
    );
    expect(pick({ created_at: "2025-01-01T00:00:00Z" }).dateListed.getTime()).toBe(Date.UTC(2025, 0, 1));
    expect(pick({ date_sold: "2026-02-01T00:00:00Z" }).dateSold.getTime()).toBe(Date.UTC(2026, 1, 1));
    expect(pick({ date_sold: "2026-02-01T00:00:00Z" }).dateListed).toBeNull();
    expect(pick({ created_at: "2025-01-01T00:00:00Z" }).dateSold).toBeNull();
  });

  test("the yes/no fields are true only for values that clearly mean yes", () => {
    const flags = (data) => {
      const p = normalizeProductDetail(data, options);
      return [p.trades, p.priceNego, p.sold];
    };
    expect(flags({ trades: 1, price_nego: "yes", sold: true })).toEqual([true, true, true]);
    expect(flags({ trades: 0, price_nego: "no", sold: false })).toEqual([false, false, false]);
    expect(flags({ trades: "maybe", price_nego: null, sold: undefined })).toEqual([false, false, false]);
    expect(flags({ trades: "TRUE", price_nego: 0, sold: "1" })).toEqual([true, false, true]);
  });

  test("photos are resolved through the API; none at all gives the placeholder", () => {
    expect(normalizeProductDetail({ photos: ["/images/a.jpg", "/images/b.jpg"] }, options).photoUrls).toEqual([
      "https://api.example.test/api/media/image.php?url=%2Fimages%2Fa.jpg",
      "https://api.example.test/api/media/image.php?url=%2Fimages%2Fb.jpg",
    ]);
    expect(normalizeProductDetail({ photos: [] }, options).photoUrls).toEqual([FALLBACK_IMAGE_URL]);
    expect(normalizeProductDetail({ photos: [null, ""] }, options).photoUrls).toEqual([FALLBACK_IMAGE_URL]);
    expect(normalizeProductDetail({ photos: "/images/a.jpg" }).photoUrls).toEqual(["/images/a.jpg"]);
  });

  test("tags accept a list or a comma-separated string", () => {
    expect(normalizeProductDetail({ tags: "A, B" }, options).tags).toEqual(["A", "B"]);
    expect(normalizeProductDetail({ tags: ["A", "", "B"] }, options).tags).toEqual(["A", "B"]);
  });

  test("seller name: given, else by id (0 counts), else unknown", () => {
    const name = (data) => normalizeProductDetail(data, options).sellerName;
    expect(name({ seller: "Ava", seller_id: 3 })).toBe("Ava");
    expect(name({ seller_id: 3 })).toBe("Seller #3");
    expect(name({ seller_id: 0 })).toBe("Seller #0");
    expect(name({ seller_id: null })).toBe("Unknown Seller");
    expect(normalizeProductDetail({ seller_id: 0 }, options).sellerId).toBe(0);
  });

  test("seller email is trimmed; blank means none; a non-string is kept only if truthy", () => {
    const email = (value) => normalizeProductDetail({ email: value }, options).sellerEmail;
    expect(email("  ava@buffalo.edu  ")).toBe("ava@buffalo.edu");
    expect(email("   ")).toBeNull();
    expect(email("")).toBeNull();
    expect(email(undefined)).toBeNull();
    expect(email(null)).toBeNull();
    expect(email(0)).toBeNull();
    expect(email(12)).toBe(12);
  });

  test("seller username: a given name (trimmed) wins, else the email's local part", () => {
    const username = (data) => normalizeProductDetail(data, options).sellerUsername;
    expect(username({ seller_username: "  ava  ", email: "other@buffalo.edu" })).toBe("ava");
    expect(username({ seller_username: "   ", email: "other@buffalo.edu" })).toBe("other");
    expect(username({ seller_username: 5, email: "other@buffalo.edu" })).toBe("other");
    expect(username({ email: "  ava.lee@buffalo.edu " })).toBe("ava.lee");
    expect(username({ email: "@buffalo.edu" })).toBeNull();
    expect(username({ email: 12 })).toBeNull();
    expect(username({})).toBeNull();
  });

  test("buyer-facing sale fields are passed through, keeping falsy values", () => {
    const detail = normalizeProductDetail({ item_status: "Sold", sold_to: 0, final_price: 0 }, options);
    expect(detail).toMatchObject({ itemStatus: "Sold", soldTo: 0, finalPrice: 0 });
    const missing = normalizeProductDetail({ item_status: "" }, options);
    expect(missing).toMatchObject({ itemStatus: null, soldTo: null, finalPrice: null });
  });
});
```

</details>

### Backend CLI checks and manual demonstrations (12 files)

<details>
<summary>api/tests/adversarial_validation_test.php</summary>

[Open source](../api/tests/adversarial_validation_test.php)

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/../payments/helpers.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_value($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

foreach ([42, '42', 0, '-42'] as $value) {
    expect_value(strict_integer_value($value), (int)$value, 'valid integer rejected');
}
foreach (['1abc', '1.0', '01', '', ' 1', true, false, 1.0, [], PHP_INT_MAX . '0'] as $value) {
    expect_value(strict_integer_value($value), null, 'malformed integer accepted');
}

foreach ([0, 5, 0.5, '0.50', '.5', '-1.25'] as $value) {
    expect_value(strict_decimal_value($value), (float)$value, 'valid decimal rejected');
}
foreach (['1abc', '1e3', '', '.', ' 1', true, [], INF, NAN] as $value) {
    expect_value(strict_decimal_value($value), null, 'malformed decimal accepted');
}

foreach ([[true, true], [false, false], [1, true], [0, false], ['1', true], ['0', false]] as [$value, $expected]) {
    expect_value(strict_boolean_value($value), $expected, 'valid boolean rejected');
}
foreach (['true', 'false', 'yes', '', 2, -1, [], null] as $value) {
    expect_value(strict_boolean_value($value), null, 'malformed boolean accepted');
}

expect_value(decode_json_object('{"name":"test","nested":{"ok":true}}')['name'] ?? null, 'test', 'JSON object rejected');
foreach (['[]', '"text"', 'null', 'true', '{bad json}', '', str_repeat('x', MAX_JSON_REQUEST_BYTES + 1)] as $json) {
    expect_value(decode_json_object($json), null, 'non-object or malformed JSON accepted');
}

foreach (['2026-08-20T12:00:00Z', '2026-08-20T12:00:00.123456-04:00'] as $value) {
    expect_value(strict_iso_datetime_value($value) instanceof DateTimeImmutable, true, 'valid ISO datetime rejected');
}
foreach (['tomorrow', '2026-02-30T12:00:00Z', '2026-08-20 12:00:00', '2026-08-20T12:00:00', [], null] as $value) {
    expect_value(strict_iso_datetime_value($value), null, 'malformed datetime accepted');
}

// The only accepting case: without the fixture, a function that rejects every
// image would still pass, so a missing file is a failure, not a skip.
$knownImage = dirname(__DIR__, 2) . '/images/air-fryer.jpg';
expect_value(is_file($knownImage), true, 'image fixture images/air-fryer.jpg missing');
expect_value(uploaded_image_dimensions_are_safe($knownImage, 'image/jpeg'), true, 'known image rejected');
expect_value(uploaded_image_dimensions_are_safe(dirname(__DIR__, 2) . '/package.json', 'image/jpeg'), false, 'non-image accepted');

foreach ([['0.50', 50], ['1', 100], ['9999.99', 999999]] as [$value, $expected]) {
    expect_value(payment_amount_cents_from_value($value), $expected, 'valid Stripe payment amount rejected');
}
foreach (['0.49', '10000', '1.001', '-1', '', '1e2', null, true] as $value) {
    expect_value(payment_amount_cents_from_value($value), null, 'invalid Stripe payment amount accepted');
}

$paymentSchedule = ['meeting_at' => '2026-08-20 16:00:00'];
expect_value(payment_window_state($paymentSchedule, new DateTimeImmutable('2026-08-20T15:59:59Z')), 'upcoming', 'payment opened before scheduled time');
expect_value(payment_window_state($paymentSchedule, new DateTimeImmutable('2026-08-20T16:00:00Z')), 'open', 'payment did not open at scheduled time');
expect_value(payment_window_state($paymentSchedule, new DateTimeImmutable('2026-08-20T16:29:59Z')), 'open', 'payment closed before 30 minutes');
expect_value(payment_window_state($paymentSchedule, new DateTimeImmutable('2026-08-20T16:30:00Z')), 'expired', 'payment remained open at cutoff');
expect_value(payment_mode_for_protected(true), 'test', 'protected users must use Stripe test mode');
expect_value(payment_mode_for_protected(false), 'live', 'normal users must use Stripe live mode');

$timelySchedule = ['meeting_at' => '2026-08-20 16:00:00', 'payment_fallback_at' => null];
$fallbackSchedule = ['meeting_at' => '2026-08-20 16:00:00', 'payment_fallback_at' => '2026-08-20 16:05:00'];
$canceledSchedule = ['meeting_at' => '2026-08-20 16:00:00', 'payment_fallback_at' => null, 'status' => 'cancelled'];
expect_value(
    payment_succeeded_refund_reason($timelySchedule, new DateTimeImmutable('2026-08-20T16:10:00Z')),
    null,
    'timely payment was marked for refund'
);
expect_value(
    payment_succeeded_refund_reason($fallbackSchedule, new DateTimeImmutable('2026-08-20T16:10:00Z')),
    'fallback_payment',
    'payment completed after irreversible fallback'
);
expect_value(
    payment_succeeded_refund_reason($timelySchedule, new DateTimeImmutable('2026-08-20T16:30:00Z')),
    'late_payment',
    'late payment was allowed to complete'
);
expect_value(
    payment_succeeded_refund_reason($canceledSchedule, new DateTimeImmutable('2026-08-20T16:10:00Z')),
    'schedule_inactive',
    'payment completed after the Scheduled Purchase was canceled'
);

expect_value(payment_can_apply_intent_failure('processing'), true, 'processing payment could not fail');
expect_value(payment_can_apply_intent_failure('succeeded'), false, 'failed event regressed a succeeded payment');
expect_value(payment_can_apply_intent_failure('refunded'), false, 'failed event regressed a refunded payment');
expect_value(payment_can_apply_refund_status('refunded', 'refund_pending'), false, 'refund event regressed a completed refund');
expect_value(payment_can_apply_refund_status('refund_failed', 'refund_pending'), false, 'older refund event regressed a failed refund');
expect_value(payment_can_apply_refund_status('refund_failed', 'refunded'), true, 'successful refund could not recover from failed status');
expect_value(payment_refund_needs_request('succeeded', null), true, 'new refund request was rejected');
expect_value(payment_refund_needs_request('refund_pending', null), true, 'interrupted refund could not resume');
expect_value(payment_refund_needs_request('refund_pending', 're_test'), false, 'known pending refund was reissued');
expect_value(payment_refund_is_complete(1000, 400), false, 'partial refund was treated as full');
expect_value(payment_refund_is_complete(1000, 1000), true, 'full refund was not finalized');
expect_value(payment_can_apply_dispute_status('under_review', 'won'), true, 'dispute could not reach a terminal state');
expect_value(payment_can_apply_dispute_status('won', 'under_review'), false, 'stale dispute event regressed a win');
expect_value(payment_dispute_resolved_for_seller('won'), true, 'won dispute left the payment disputed');
expect_value(payment_dispute_resolved_for_seller('warning_closed'), true, 'closed warning left the payment disputed');
expect_value(payment_dispute_resolved_for_seller('lost'), false, 'lost dispute restored the payment');
expect_value(payment_dispute_resolved_for_seller('needs_response'), false, 'open dispute restored the payment');

$v2Account = payment_normalize_stripe_account([
    'id' => 'acct_test',
    'configuration' => ['merchant' => ['capabilities' => [
        'card_payments' => ['status' => 'active'],
        'stripe_balance' => ['payouts' => ['status' => 'active']],
    ]]],
    'requirements' => ['entries' => []],
]);
expect_value($v2Account['charges_enabled'], true, 'Accounts v2 card capability was not normalized');
expect_value($v2Account['payouts_enabled'], true, 'Accounts v2 payout capability was not normalized');

echo "Adversarial backend validation passed: {$checks} checks\n";
```

</details>

<details>
<summary>api/tests/card_acceptance_test.php</summary>

[Open source](../api/tests/card_acceptance_test.php)

```php
<?php
declare(strict_types=1);

// Acceptance rules from the closed Dorm Mart Scrum Board cards, checked over real
// HTTP. Each block names its card. Where a card was written as a manual UI script,
// the check targets the API rule behind it and tries to break that rule: boundary
// values, other users' resources, forged tokens, and repeated or racing requests.
//
// Users: 1 sells; 2 and 3 buy; 4 is unrelated; 5 is locked out; 6 changes and
// resets its password. Mail is disabled by the harness.
require __DIR__ . '/support/integration_harness.php';

harness_start('cards', 6);

function listing(int $seller, string $title = 'Card desk'): int
{
    global $conn;
    $stmt = $conn->prepare("INSERT INTO INVENTORY (title, seller_id, listing_price, photos, item_location, categories, description)
                            VALUES (?, ?, 25, '[\"/test.jpg\"]', 'North Campus', '[\"Furniture\"]', 'A sturdy desk')");
    $stmt->bind_param('si', $title, $seller);
    $stmt->execute();
    return (int)$conn->insert_id;
}

function conversation(int $buyer, int $product): int
{
    $response = api($buyer, 'chat/ensure_conversation.php', ['product_id' => $product]);
    if (!ok($response)) throw new RuntimeException('Fixture conversation failed: ' . json_encode($response));
    return (int)$response['body']['conv_id'];
}

function login_as(string $email, string $userPassword): array
{
    return api(harness_guest('login-probe'), 'auth/login.php', ['email' => $email, 'password' => $userPassword]);
}

function timed(callable $request): array
{
    $started = microtime(true);
    $response = $request();
    return [$response, microtime(true) - $started];
}

// Upload fixtures are generated, never committed.
$png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==');
$tinyPng = tempnam(sys_get_temp_dir(), 'dm-png-');
$bigPng = tempnam(sys_get_temp_dir(), 'dm-png-');
$notImage = tempnam(sys_get_temp_dir(), 'dm-txt-');
file_put_contents($tinyPng, $png);
file_put_contents($bigPng, $png . str_repeat("\0", 2 * 1024 * 1024 + 1));
file_put_contents($notImage, "this is plain text pretending to be a photo\n");
harness_on_cleanup(static function () use ($tinyPng, $bigPng, $notImage): void {
    foreach ([$tinyPng, $bigPng, $notImage] as $file) @unlink($file);
});

// --- #64 Enforce limits on login chances / #26 Block invalid usernames too ----
$victim = harness_email(5);
for ($attempt = 1; $attempt <= 4; $attempt++) {
    $wrong = login_as($victim, 'Wrong-password-' . $attempt);
    check(error_is($wrong, 401, 'Invalid credentials'), "#64 failed login $attempt of 4 is refused as invalid credentials");
}
$locked = login_as($victim, 'Wrong-password-5');
check(error_is($locked, 429, 'Too many failed attempts. Please try again in 3 minutes.'), '#64 the fifth failure locks the account for 3 minutes');
check(preg_match('/^Retry-After: 1[0-9]{2}\r?$/mi', $locked['headers']) === 1, '#64 the lockout says when to retry');
check(login_as($victim, $password)['status'] === 429, '#64 the correct password is still refused during the lockout');
check(login_as(strtoupper($victim), $password)['status'] === 429, '#64 changing the email case does not reach a fresh counter');
check(ok(login_as(harness_email(3), $password)), '#64 one account\'s lockout does not lock out other accounts from the same network');

$ghost = 'nobody-here@buffalo.edu';
for ($attempt = 1; $attempt <= 4; $attempt++) {
    login_as($ghost, 'Guess-' . $attempt);
}
check(login_as($ghost, 'Guess-5')['status'] === 429, '#26 repeated attempts on an unknown email are locked out too');

// --- #92 Login input validation / #71 XSS through the login form -------------
check(error_is(login_as('<script>alert(1)</script>@x.co', 'Anything1!'), 400, 'Invalid email format'), '#71 a script tag in the email is rejected as a malformed email');
check(error_is(login_as(harness_email(3), ''), 400, 'Missing required fields'), '#92 an empty password is refused before any lookup');
check(error_is(login_as(harness_email(3), str_repeat('a', 65)), 400, 'Invalid password format. Please check your password.'), '#92 an over-long password is refused');

// --- #87 Change password backend ----------------------------------------------
$changer = 6;
$newPassword = 'Changed-Pass-2';
check(error_is(api(harness_guest(), 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword]), 401, 'Not authenticated'), '#87 changing a password requires a session');
check(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword, 'csrf_token' => str_repeat('0', 64)])['body']['code'] === 'csrf_invalid', '#87 a forged CSRF token is refused');
check(error_is(api($changer, 'auth/change_password.php', ['currentPassword' => 'Not-the-password-1', 'newPassword' => $newPassword]), 401, 'Invalid current password'), '#87 the current password must match');
check(error_is(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => 'short']), 400, 'Password does not meet policy'), '#87 a weak new password is refused');
check(ok(api($changer, 'auth/change_password.php', ['currentPassword' => $password, 'newPassword' => $newPassword])), '#87 a valid change succeeds');
check(api($changer, 'auth/me.php', null)['status'] === 401, '#87 the session that changed the password is signed out');
check(login_as(harness_email($changer), $password)['status'] === 401, '#87 the old password stops working');
check(ok(login_as(harness_email($changer), $newPassword)), '#87 the new password works');

// --- #55 Reset password backend / #71 SQL injection in the token --------------
$resetToken = bin2hex(random_bytes(32));
$setResetToken = static function (string $token, string $expiresSql) use ($changer): void {
    global $conn;
    $hash = password_hash($token, PASSWORD_DEFAULT);
    $conn->query("UPDATE user_accounts SET reset_token_hash = '$hash', reset_token_expires = $expiresSql WHERE user_id = $changer");
};
$reset = static fn(string $token, string $pass, int $uid = 6): array =>
    api(harness_guest(), 'auth/reset_password.php', ['token' => $token, 'newPassword' => $pass, 'uid' => $uid]);

check(error_is($reset("'; DROP TABLE user_accounts;--", 'Reset-Pass-3'), 400, 'Token, user ID, and new password are required'), '#71 an SQL payload in the reset token is refused as malformed');
check((int)row('SELECT COUNT(*) AS c FROM user_accounts')['c'] === 6, '#71 the injection attempt leaves user_accounts intact');
$setResetToken($resetToken, 'UTC_TIMESTAMP() - INTERVAL 1 MINUTE');
check(($reset($resetToken, 'Reset-Pass-3')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 an expired reset token is refused');
$setResetToken($resetToken, 'UTC_TIMESTAMP() + INTERVAL 1 HOUR');
check(($reset(bin2hex(random_bytes(32)), 'Reset-Pass-3')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a well-formed but wrong token is refused');
check(($reset($resetToken, 'Reset-Pass-3', 3)['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a valid token cannot reset a different user');
check(error_is($reset($resetToken, 'weakpass'), 400, 'Password does not meet policy requirements'), '#55 the new password must meet the policy');
check(($reset($resetToken, 'Reset-Pass-3')['body']['success'] ?? false) === true, '#55 a valid token resets the password');
check(($reset($resetToken, 'Other-Pass-4')['body']['error'] ?? '') === 'Invalid or expired reset token', '#55 a reset token works only once');
check(ok(login_as(harness_email($changer), 'Reset-Pass-3')), '#55 the reset password works for login');

// --- #60 Forgot password backend -------------------------------------------------
// The card expected an error for unknown emails. The endpoint now answers every
// address identically (202, same message, same ~2 s floor) so it cannot be used to
// discover which emails have accounts; these checks pin that newer contract.
[$unknown, $unknownSeconds] = timed(static fn() => api(harness_guest(), 'auth/forgot_password.php', ['email' => 'not-registered@buffalo.edu']));
$conn->query("UPDATE user_accounts SET reset_token_hash = 'sentinel', last_reset_request = NOW() WHERE user_id = 4");
[$known, $knownSeconds] = timed(static fn() => api(harness_guest(), 'auth/forgot_password.php', ['email' => harness_email(4)]));
check($unknown['status'] === 202 && $known['status'] === 202 && $unknown['body'] === $known['body'], '#60 known and unknown emails get the same answer');
check($unknownSeconds >= 1.9 && $knownSeconds >= 1.9, '#60 both answers take the same minimum time');
check(row('SELECT reset_token_hash FROM user_accounts WHERE user_id = 4')['reset_token_hash'] === 'sentinel', '#60 a second request within 10 minutes does not issue a new link');

// --- #93 / #100 Create account ----------------------------------------------------
$signup = static fn(array $fields): array => api(harness_guest(), 'auth/create_account.php', $fields + [
    'firstName' => 'Card', 'lastName' => 'Tester', 'email' => 'new-card-user@buffalo.edu',
    'gradMonth' => 5, 'gradYear' => (int)date('Y') + 1, 'promos' => false, 'terms' => true,
]);
check(error_is($signup(['terms' => false]), 400, 'You must agree to the terms'), '#93 the terms must be accepted');
check(error_is($signup(['gradMonth' => 1, 'gradYear' => (int)date('Y') - 1]), 400, 'Graduation date cannot be in the past'), '#93 a graduation date in the past is refused');
check(error_is($signup(['firstName' => '']), 400, 'Invalid input format'), '#93 a first name is required');
$duplicate = $signup(['email' => strtoupper(harness_email(1))]);
check($duplicate['status'] === 202 && (int)row("SELECT COUNT(*) AS c FROM user_accounts WHERE email = '" . harness_email(1) . "'")['c'] === 1,
    '#93 an existing email, in any case, gets the generic answer and no second account');
check(error_is($signup([]), 429, 'Too many account requests. Please try again in a few minutes.'), '#93 account requests from one network are rate limited');

// --- #72 CSRF protection and CORS -------------------------------------------------
$freshToken = api(harness_guest(), 'auth/get_csrf_token.php', null)['body']['csrf_token'] ?? '';
check(preg_match('/^[a-f0-9]{64}$/', $freshToken) === 1, '#72 a CSRF token is issued as 64 hex characters');
$beforeListings = (int)row('SELECT COUNT(*) AS c FROM INVENTORY')['c'];
$forged = api_multipart(1, 'seller_dashboard/product_listing.php', [
    'csrf_token' => 'invalid', 'mode' => 'create', 'title' => 'Desk', 'description' => 'A nice desk', 'price' => '50',
    'categories[0]' => 'Furniture', 'itemLocation' => 'North Campus', 'condition' => 'Good',
]);
check(($forged['body']['code'] ?? '') === 'csrf_invalid' && (int)row('SELECT COUNT(*) AS c FROM INVENTORY')['c'] === $beforeListings,
    '#72 a listing post with a bad CSRF token is refused and creates nothing');
global $tokens;
check((api(1, 'wishlist/add_to_wishlist.php', ['product_id' => 1, 'csrf_token' => $tokens[2]])['body']['code'] ?? '') === 'csrf_invalid',
    '#72 another session\'s CSRF token is refused');
$crossSite = api(2, 'auth/me.php', null, ['Origin: https://evil.example']);
check(error_is($crossSite, 403, 'Origin not allowed'), '#72 an untrusted origin is refused');
check(api(2, 'auth/me.php', null, ['Origin: ' . $base . '.evil.example'])['status'] === 403, '#72 an origin that only starts with ours is refused');
$sameSite = api(2, 'auth/me.php', null, ['Origin: ' . $base]);
check(ok($sameSite) && stripos($sameSite['headers'], 'Access-Control-Allow-Origin: ' . $base) !== false, '#72 our own origin is allowed and echoed back');
check(stripos($sameSite['headers'], 'X-Content-Type-Options: nosniff') !== false
    && stripos($sameSite['headers'], 'Content-Security-Policy:') !== false, '#71 API responses carry the security headers');

// --- #24 Message Seller starts a chat ----------------------------------------------
$desk = listing(1);
$intro = api(2, 'chat/ensure_conversation.php', ['product_id' => $desk]);
$deskChat = (int)($intro['body']['conv_id'] ?? 0);
check(ok($intro) && $deskChat > 0, '#24 a buyer can start a chat about a listing');
$introMeta = json_decode((string)(row("SELECT metadata FROM messages WHERE conv_id = $deskChat ORDER BY message_id LIMIT 1")['metadata'] ?? ''), true);
check(($introMeta['type'] ?? '') === 'listing_intro' && (int)($introMeta['product']['product_id'] ?? 0) === $desk, '#24 the chat opens with an intro card for that listing');
check((int)(api(2, 'chat/ensure_conversation.php', ['product_id' => $desk])['body']['conv_id'] ?? 0) === $deskChat
    && (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'] === 1, '#24 pressing Message Seller again reuses the chat without a second intro');
check(error_is(api(1, 'chat/ensure_conversation.php', ['product_id' => $desk]), 400, 'Cannot message your own listing'), '#24 a seller cannot message their own listing');

// --- #34 Chat messages ---------------------------------------------------------------
$send = static fn(int $sender, int $receiver, string $content, int $conv): array =>
    api($sender, 'chat/create_message.php', ['receiver_id' => $receiver, 'conv_id' => $conv, 'content' => $content]);
check(error_is($send(2, 1, '', $deskChat), 400, 'missing_fields'), '#34 an empty message is refused');
check(error_is($send(2, 1, "   \n\t ", $deskChat), 400, 'missing_fields'), '#34 a whitespace-only message is refused');
check(ok($send(2, 1, str_repeat('a', 500), $deskChat)), '#34 a 500-character message is accepted');
check(error_is($send(2, 1, str_repeat('a', 501), $deskChat), 400, 'content_too_long'), '#34 a 501-character message is refused');
check(ok($send(2, 1, str_repeat('😀', 500), $deskChat)), '#34 the limit counts characters, so 500 emoji are accepted');
check(error_is($send(2, 1, str_repeat('😀', 501), $deskChat), 400, 'content_too_long'), '#34 501 emoji are refused');
check(error_is($send(4, 1, 'Let me in', $deskChat), 403, 'Invalid conversation ID'), '#34 an outsider cannot post into someone else\'s chat');

// --- #33 Chat image upload ------------------------------------------------------------
$sendImage = static fn(string $path, string $type, string $name, string $caption = ''): array =>
    api_multipart(2, 'chat/create_image_message.php', ['receiver_id' => '1', 'conv_id' => (string)$deskChat,
        'content' => $caption, 'image' => new CURLFile($path, $type, $name)]);
$photo = $sendImage($tinyPng, 'image/png', 'photo.png');
check(ok($photo), '#33 a photo can be sent with no caption');
$photoUrl = (string)($photo['body']['message']['image_url'] ?? '');
harness_on_cleanup(static function () use ($photoUrl): void {
    if ($photoUrl === '') return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('chat-images') . '/' . basename($photoUrl));
});
check(error_is($sendImage($bigPng, 'image/png', 'huge.png'), 400, 'image_too_large'), '#33 a photo over 2 MB is refused');
check(error_is($sendImage($notImage, 'image/jpeg', 'photo.jpg'), 400, 'unsupported_image_type'), '#33 a file that only claims to be a JPEG is refused');
$photoMessage = (int)($photo['body']['message']['message_id'] ?? 0);
$download = http_get(1, 'chat/serve_chat_image.php?message_id=' . $photoMessage . '&download=1');
check($download['status'] === 200 && $download['raw'] === $png && stripos($download['headers'], 'Content-Disposition: attachment') !== false,
    '#33 the receiver can download the exact photo');
check(http_get(4, 'chat/serve_chat_image.php?message_id=' . $photoMessage)['status'] === 403, '#33 an outsider cannot download it');

// --- #25 Typing indicator ---------------------------------------------------------------
$typing = static fn(int $viewer): array => api($viewer, 'chat/typing_status.php?conversation_id=' . $deskChat, null);
check(ok(api(2, 'chat/typing_status.php', ['conversation_id' => $deskChat, 'is_typing' => true])), '#25 a participant can report typing');
$seen = $typing(1);
check(($seen['body']['is_typing'] ?? false) === true && ($seen['body']['typing_user_first_name'] ?? '') === 'Harness', '#25 the other participant sees who is typing');
check(($typing(2)['body']['is_typing'] ?? true) === false, '#25 the typist does not see their own indicator');
$conn->query("UPDATE typing_status SET updated_at = NOW() - INTERVAL 9 SECOND WHERE conversation_id = $deskChat");
check(($typing(1)['body']['is_typing'] ?? true) === false, '#25 the indicator expires when typing updates stop');
check(error_is($typing(4), 403, 'Access denied'), '#25 an outsider cannot watch the typing status');

// --- #37 Delete an entire conversation ---------------------------------------------------
$listed = static fn(int $user): bool => in_array($deskChat,
    array_map(static fn($c) => (int)($c['conv_id'] ?? 0), api($user, 'chat/fetch_conversations.php', null)['body']['conversations'] ?? []), true);
$messagesBefore = (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'];
check(error_is(api(4, 'chat/delete_conversation.php', ['conv_id' => $deskChat]), 403, 'Not authorized to hide this conversation'), '#37 an outsider cannot delete the chat');
check(ok(api(2, 'chat/delete_conversation.php', ['conv_id' => $deskChat])), '#37 the buyer can delete the chat');
check(!$listed(2) && $listed(1), '#37 deleting hides the chat for the buyer only');
check(ok($send(1, 2, 'Still interested?', $deskChat)) && $listed(2), '#37 a new message from the other side brings the chat back');
api(2, 'chat/delete_conversation.php', ['conv_id' => $deskChat]);
api(1, 'chat/delete_conversation.php', ['conv_id' => $deskChat]);
// The card expected both deletions to erase the messages. They are kept now: purchase
// records and moderation reports point at them. Pin that neither user sees the chat.
check(!$listed(1) && !$listed(2) && (int)row("SELECT COUNT(*) AS c FROM messages WHERE conv_id = $deskChat")['c'] === $messagesBefore + 1,
    '#37 once both delete, neither sees the chat and the history is kept for records');

// --- #23 / #27 Schedule purchase ------------------------------------------------------------
$lamp = listing(1, 'Card lamp');
$lampChat = conversation(2, $lamp);
$scheduleAt = static fn(string $when): array => api(1, 'scheduled_purchases/create.php', ['inventory_product_id' => $lamp,
    'conversation_id' => $lampChat, 'meeting_at' => $when, 'meet_location' => 'North Campus']);
check(rejected($scheduleAt(gmdate('c', time() - 3600))), '#27 a purchase cannot be scheduled in the past');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => 999999, 'action' => 'accept']), 404, 'Request not found'), '#23 responding to a missing request is refused');
$pending = (int)($scheduleAt(gmdate('c', time() + 86400))['body']['data']['request_id'] ?? 0);
check($pending > 0, '#23 a seller can schedule a future meeting');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'maybe']), 400, 'Invalid request'), '#23 an unknown action is refused');
check(error_is(api(3, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'accept']), 403, 'Not authorized to respond to this request'), '#23 another buyer cannot answer the request');
check(ok(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'decline'])), '#27 the buyer can decline');
check(row("SELECT status FROM scheduled_purchase_requests WHERE request_id = $pending")['status'] === 'declined', '#27 the decline is recorded');
check(error_is(api(2, 'scheduled_purchases/respond.php', ['request_id' => $pending, 'action' => 'accept']), 409, 'Request has already been handled'), '#27 a declined request cannot then be accepted');

// --- #28 / #48 Reviews ---------------------------------------------------------------------
$notebook = listing(1, 'Card notebook');
$entry = json_encode([['product_id' => $notebook, 'recorded_at' => gmdate('c'), 'confirm_payload' => ['is_successful' => true]]]);
$conn->query("INSERT INTO purchase_history (user_id, items) VALUES (2, '$entry')");
$review = static fn(int $user, array $fields): array => api($user, 'reviews/submit_review.php', $fields + [
    'product_id' => $notebook, 'rating' => 4, 'product_rating' => 4.5, 'review_text' => 'Solid notebook.',
]);
check(error_is($review(2, ['review_text' => '   ']), 400, 'Review text is required'), '#28 an empty review is refused');
check(error_is($review(2, ['review_text' => str_repeat('b', 1001)]), 400, 'Review text must be 1000 characters or less'), '#48 a 1001-character review is refused');
check(rejected($review(2, ['rating' => 5.5])) && rejected($review(2, ['rating' => 0])) && rejected($review(2, ['product_rating' => 3.3])),
    '#28 ratings outside 0.5 to 5 in half steps are refused');
check(error_is($review(3, []), 403, 'You can only review products you have purchased'), '#28 only the buyer can review');
check(error_is($review(1, []), 403, 'You cannot review your own product'), '#28 a seller cannot review their own listing');
check(ok($review(2, ['review_text' => str_repeat('c', 1000)])), '#48 a 1000-character review is accepted');
check(error_is($review(2, []), 409, 'You have already reviewed this product'), '#28 a second review of the same item is refused');
check(error_is(api(2, 'reviews/get_review.php', null), 400, 'Invalid product_id'), '#48 fetching a review needs a product id');
check(mb_strlen((string)(api(2, 'reviews/get_review.php?product_id=' . $notebook, null)['body']['review']['review_text'] ?? '')) === 1000, '#48 the buyer gets their full review back');
check(count(api(1, 'reviews/get_product_reviews.php?product_id=' . $notebook, null)['body']['reviews'] ?? []) === 1, '#49 the seller sees the review');
check(error_is(api(3, 'reviews/get_product_reviews.php?product_id=' . $notebook, null), 403, 'You are not authorized to view reviews for this product'), '#49 other users cannot read the seller\'s review list');

// --- #20 / #47 / #31 Wishlist -----------------------------------------------------------------
$chair = listing(1, 'Card chair');
check(ok(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $chair])) && ok(api(3, 'wishlist/add_to_wishlist.php', ['product_id' => $chair])),
    '#20 two buyers can wishlist the same item');
$chairRow = array_values(array_filter(api(1, 'seller_dashboard/manage_seller_listings.php', [])['body']['data'] ?? [], static fn($l) => (int)$l['id'] === $chair))[0] ?? [];
check((int)($chairRow['wishlisted'] ?? -1) === 2, '#20 the seller dashboard counts both wishlists');
check(error_is(api(1, 'wishlist/add_to_wishlist.php', ['product_id' => $chair]), 400, 'Cannot add your own listing to wishlist'), '#47 a seller cannot wishlist their own item');
check(error_is(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => 0]), 400, 'Invalid product_id'), '#47 an invalid product id is refused');
check(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => 999999])['status'] === 404, '#47 a missing product is refused');
for ($toggle = 0; $toggle < 5; $toggle++) {
    api(2, 'wishlist/remove_from_wishlist.php', ['product_id' => $chair]);
    api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $chair]);
}
check((int)row("SELECT wishlisted FROM INVENTORY WHERE product_id = $chair")['wishlisted'] === 2
    && (int)row("SELECT COUNT(*) AS c FROM wishlist WHERE product_id = $chair")['c'] === 2, '#20 rapid toggling keeps the counter equal to the real wishlists');
$sellerNotices = (int)row("SELECT COUNT(*) AS c FROM notifications WHERE recipient_user_id = 1 AND type = 'wishlist_added' AND product_id = $chair")['c'];
check($sellerNotices === 2, '#31 the seller is notified once per buyer, not once per toggle');
check(ok(api(1, 'wishlist/mark_all_items_read.php', [])) && (int)(api(1, 'wishlist/fetch_unread_notifications.php', null)['body']['unread_total'] ?? -1) === 0,
    '#31 marking all notifications read clears the unread count');

// --- #74 Seller dashboard backend --------------------------------------------------------------
check(api(harness_guest(), 'seller_dashboard/manage_seller_listings.php', [])['status'] === 401, '#74 the seller dashboard requires a session');
check(api(4, 'seller_dashboard/manage_seller_listings.php', [])['body'] === ['success' => true, 'data' => []], '#74 a user with no listings gets an empty list');
$buyerView = api(2, 'seller_dashboard/manage_seller_listings.php', [])['body']['data'] ?? null;
check($buyerView === [], '#74 a buyer never sees another seller\'s listings');

// --- #65 Search backend / #71 SQL injection in search ---------------------------------------------
$found = static fn(string $query): array => array_map(static fn($r) => (int)($r['id'] ?? 0),
    (array)(api(2, 'search/get_search_items.php', ['q' => $query])['body'] ?? []));
check(in_array($chair, $found('Card chair'), true), '#65 searching by title finds the listing');
check($found("' OR '1'='1") === [] && $found('%') === [], '#71 injection or wildcard text matches nothing');

// --- Upload quota (added for review videos after the uploads audit) ---------------------------------
// Twenty uploads per ten minutes: prime nineteen, so the twentieth is the last one allowed.
$quotaKey = hash('sha256', 'image_upload_review_video' . "\0" . '2');
$conn->query("INSERT INTO login_rate_limits (session_id, failed_login_attempts, last_failed_attempt) VALUES ('$quotaKey', 19, UTC_TIMESTAMP())");
$uploadVideo = static fn(): array => api_multipart(2, 'reviews/upload_review_video.php',
    ['video' => new CURLFile(__DIR__ . '/fixtures/review-video.webm', 'video/webm', 'review.webm')]);
$twentieth = $uploadVideo();
harness_on_cleanup(static function () use ($twentieth): void {
    $url = (string)($twentieth['body']['video_url'] ?? '');
    if ($url === '') return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('review-images') . '/' . basename($url));
});
check(ok($twentieth), 'upload quota: the twentieth video in the window is accepted');
$twentyFirst = $uploadVideo();
check($twentyFirst['status'] === 429 && preg_match('/^Retry-After: \d+\r?$/mi', $twentyFirst['headers']) === 1, 'upload quota: the twenty-first is refused with a retry time');

harness_finish();
```

</details>

<details>
<summary>api/tests/db_connection_test.php</summary>

[Open source](../api/tests/db_connection_test.php)

```php

<?php
// Used to test db connection
if (php_sapi_name() !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Not found']);
    exit;
}

require_once __DIR__ . '/../database/db_connect.php';

try {
    $conn = db();
    echo "Database connection successful\n";
} catch (Throwable $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
}
```

</details>

<details>
<summary>api/tests/helpers_unit_test.php</summary>

[Open source](../api/tests/helpers_unit_test.php)

```php
<?php
declare(strict_types=1);

// Pure-function checks for shared API helpers. No database or network.

require_once __DIR__ . '/../helpers/contact_phone.php';
require_once __DIR__ . '/../helpers/file_stream.php';
require_once __DIR__ . '/../helpers/promo_unsubscribe.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../utility/transactional_email_html.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_same($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

// --- normalize_contact_phone ---
expect_same(normalize_contact_phone(''), null, 'blank phone clears the number');
expect_same(normalize_contact_phone('   '), null, 'whitespace phone clears the number');
foreach (['7165551234', '(716) 555-1234', '716.555.1234', '+1 716 555 1234', '1-716-555-1234'] as $input) {
    expect_same(normalize_contact_phone($input), '(716) 555-1234', "phone {$input} normalized");
}
foreach (['1', '+', '((((1', '716555123', '27165551234', '716-555-12345', 'call me', '716555123x'] as $input) {
    expect_same(normalize_contact_phone($input), false, "phone {$input} rejected");
}

// --- parse_byte_range ---
expect_same(parse_byte_range(null, 1000), null, 'no Range header serves the whole file');
expect_same(parse_byte_range('bytes=0-99', 1000), [0, 99], 'explicit range');
expect_same(parse_byte_range('bytes=500-', 1000), [500, 999], 'open-ended range');
expect_same(parse_byte_range('bytes=-100', 1000), [900, 999], 'suffix range');
expect_same(parse_byte_range('bytes=-5000', 1000), [0, 999], 'suffix larger than file');
expect_same(parse_byte_range('bytes=900-5000', 1000), [900, 999], 'end clamped to file size');
expect_same(parse_byte_range('bytes=0-1', 1000), [0, 1], 'Safari probe range');
expect_same(parse_byte_range('bytes=1000-', 1000), false, 'start past end is unsatisfiable');
expect_same(parse_byte_range('bytes=50-10', 1000), false, 'reversed range is unsatisfiable');
expect_same(parse_byte_range('bytes=-0', 1000), false, 'empty suffix is unsatisfiable');
expect_same(parse_byte_range('bytes=0-1,5-9', 1000), null, 'multi-range falls back to full file');
expect_same(parse_byte_range('items=0-1', 1000), null, 'non-byte unit ignored');
expect_same(parse_byte_range('bytes=-', 1000), null, 'empty range ignored');
expect_same(parse_byte_range('bytes=0-10', 0), null, 'empty file served whole');

// --- promo unsubscribe tokens ---
$secret = 'test-secret';
$token = promo_unsubscribe_token(42, $secret);
expect_same(promo_unsubscribe_verify($token, $secret), 42, 'valid token verifies');
expect_same(promo_unsubscribe_verify($token, 'other-secret'), null, 'token from another secret rejected');
expect_same(promo_unsubscribe_verify('43' . substr($token, 2), $secret), null, 'user id swapped into a token rejected');
expect_same(promo_unsubscribe_verify('42.' . str_repeat('0', 64), $secret), null, 'forged signature rejected');
expect_same(promo_unsubscribe_verify('garbage', $secret), null, 'malformed token rejected');
expect_same(promo_unsubscribe_verify($token, ''), null, 'no secret configured rejects everything');

// --- digest package ---
$items = [
    ['title' => 'Desk lamp', 'price' => 0.0, 'url' => 'https://dormmart.me/#/app/viewProduct/1', 'image_url' => null],
    ['title' => 'Mini fridge', 'price' => 40.0, 'url' => 'https://dormmart.me/#/app/viewProduct/2', 'image_url' => 'https://dormmart.me/images/fridge.jpg'],
];
$withLink = dm_promotional_items_package('Ava', $items, 'https://dormmart.me/api/email/unsubscribe.php?token=x');
expect_same($withLink['headers']['List-Unsubscribe'] ?? null, '<https://dormmart.me/api/email/unsubscribe.php?token=x>', 'List-Unsubscribe header set');
expect_same($withLink['headers']['List-Unsubscribe-Post'] ?? null, 'List-Unsubscribe=One-Click', 'one-click header set');
expect_same(str_contains($withLink['text'], 'Desk lamp - Free'), true, '$0 items are labelled Free');
// The object-fit check only means something if an image was actually rendered.
expect_same(str_contains($withLink['html'], '<img src="https://dormmart.me/images/fridge.jpg"'), true, 'item image rendered');
expect_same(str_contains($withLink['html'], 'object-fit'), false, 'email images do not rely on object-fit');
$withoutLink = dm_promotional_items_package('Ava', $items);
expect_same(isset($withoutLink['headers']), false, 'no unsubscribe headers without a link');

// --- price_has_blocked_digits ---
expect_same(price_has_blocked_digits('12.50'), false, 'ordinary price is allowed');
expect_same(price_has_blocked_digits('4.20'), true, 'blocked digits are caught across the decimal point');
expect_same(price_has_blocked_digits('4.2'), false, 'the check reads the digits as typed');
expect_same(price_has_blocked_digits('$1,337.69'), true, 'formatting characters are ignored');

echo "PASS: {$checks} helper checks\n";
```

</details>

<details>
<summary>api/tests/login_location_test.php</summary>

[Open source](../api/tests/login_location_test.php)

```php
<?php
declare(strict_types=1);
require_once __DIR__ . '/../auth/device_history.php';

function check_location(bool $condition, string $message): void
{
    if (!$condition) { echo "FAIL: $message\n"; exit(1); }
}

$_SESSION = [];
// Record lookups instead of throwing: an uncaught exception kills the script
// before check_location can report which rule broke.
$leaked = [];
$recordLeak = static function (string $ip) use (&$leaked): array {
    $leaked[] = $ip;
    return ['success' => true, 'city' => 'Leaked'];
};
foreach (['127.0.0.1' => 'local', '::1' => 'local', '::ffff:127.0.0.1' => 'local', '192.168.1.2' => 'private', '10.0.0.1' => 'private', 'fc00::1' => 'private', 'Unknown' => 'unknown', '8.8.8.8' => 'public'] as $ip => $scope) {
    check_location(login_ip_scope($ip) === $scope, "scope for $ip");
    if ($scope !== 'public') {
        check_location(login_ip_location($ip, $recordLeak) === null && $leaked === [], "non-public $ip never sent to lookup");
    }
}

$calls = 0;
$lookup = static function (string $ip) use (&$calls): array {
    $calls++;
    return ['success' => true, 'city' => 'Buffalo', 'region' => 'New York', 'country' => 'United States'];
};
check_location(login_ip_location('8.8.8.8', $lookup) === 'Buffalo, New York, United States', 'public IP lookup');
check_location(login_ip_location('8.8.8.8', $lookup) === 'Buffalo, New York, United States' && $calls === 1, 'successful lookups cached');
$_SERVER = ['REMOTE_ADDR' => '8.8.8.8'];
check_location(login_request_location() === 'Buffalo, New York, United States', 'missing proxy headers use IP fallback');
$_SERVER['HTTP_X_VERCEL_IP_CITY'] = 'New%20York';
putenv('TRUST_PROXY_GEO_HEADERS');
check_location(login_request_location() === 'Buffalo, New York, United States', 'client-sent geo headers ignored by default');
putenv('TRUST_PROXY_GEO_HEADERS=true');
check_location(login_request_location() === 'New York', 'trusted proxy location preserved');
putenv('TRUST_PROXY_GEO_HEADERS');

$failure = static function () use (&$calls): array { $calls++; return ['success' => false]; };
check_location(login_ip_location('1.1.1.1', $failure) === null, 'provider failure handled');
check_location(login_ip_location('1.1.1.1', $failure) === null && $calls === 2, 'failed lookups cached');
check_location(login_ip_location('8.8.4.4', static fn() => ['success' => true, 'city' => [], 'region' => null]) === null, 'malformed provider fields ignored');
$overBudget = false;
$budgetLookup = static function () use (&$overBudget): array {
    $overBudget = true;
    return ['success' => true, 'city' => 'Buffalo'];
};
check_location(login_ip_location('9.9.9.9', $budgetLookup) === null && !$overBudget, 'history lookup budget bounded');
echo "PASS: IP scopes, public lookup, header fallback, caching, failures, and lookup budget\n";
```

</details>

<details>
<summary>api/tests/profanity_test.php</summary>

[Open source](../api/tests/profanity_test.php)

```php
<?php
declare(strict_types=1);

// Profanity filter checks against a small in-memory word list. No database.

require_once __DIR__ . '/../helpers/profanity.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_censor(array $patterns, string $input, string $expected, string $message): void
{
    global $checks;
    $checks++;
    $actual = profanity_censor($patterns, $input);
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nInput:    {$input}\nExpected: {$expected}\nActual:   {$actual}\n");
        exit(1);
    }
}

function expect_flag(array $patterns, string $input, bool $expected, string $message): void
{
    global $checks;
    $checks++;
    if (profanity_text_matches($patterns, $input) !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nInput: {$input}\n");
        exit(1);
    }
}

$patterns = profanity_build_patterns(['shit', 'fuck', 'ass', 'boobs', 'son of a bitch']);

// Plain matches and case.
expect_censor($patterns, 'what the fuck', 'what the ****', 'plain word');
expect_censor($patterns, 'SHIT happens', '**** happens', 'case-insensitive');
expect_censor($patterns, 'no, shit!', 'no, ****!', 'punctuation around the word');

// Evasions.
expect_censor($patterns, 'sh1t', '****', 'digit look-alike');
expect_censor($patterns, '$hit', '****', 'symbol look-alike');
expect_censor($patterns, 'b00bs', '*****', 'zeros for o');
expect_censor($patterns, 'fuuuuck', '*******', 'stretched letters');
expect_censor($patterns, 'f.u.c.k off', '******* off', 'dots between letters');
expect_censor($patterns, "sh\u{200B}it", '*****', 'zero-width space inside the word');

// Endings.
expect_censor($patterns, 'this is shitty', 'this is ******', '-y ending');
expect_censor($patterns, 'fucking great', '******* great', '-ing ending');
expect_censor($patterns, 'he fucked up', 'he ****** up', '-ed ending');

// Phrases.
expect_censor($patterns, 'you son of a  bitch', 'you ***************', 'multi-word phrase with extra space');

// No false positives inside other words.
foreach (['class', 'assess', 'passage', 'Scunthorpe', 'shiitake', 'bass guitar', 'glasses'] as $clean) {
    expect_censor($patterns, $clean, $clean, "innocent word {$clean} untouched");
    expect_flag($patterns, $clean, false, "innocent word {$clean} not flagged");
}
expect_censor($patterns, 'the class is fun', 'the class is fun', 'clean sentence unchanged');

// Flagging.
expect_flag($patterns, 'what the sh1t', true, 'evasion is flagged');
expect_flag($patterns, 'lovely day', false, 'clean text not flagged');

// Empty list and empty text.
expect_censor([], 'shit', 'shit', 'no words means no filtering');
expect_censor($patterns, '', '', 'empty text');

// A large list still compiles (chunking keeps each regex under PCRE limits).
$many = [];
for ($i = 0; $i < 2000; $i++) {
    $many[] = 'word' . $i . 'x';
}
$bigPatterns = profanity_build_patterns($many);
$checks++;
if (count($bigPatterns) < 2) {
    fwrite(STDERR, "FAIL: large lists should be split into several patterns\n");
    exit(1);
}
expect_censor($bigPatterns, 'say word1999x now', 'say ********* now', 'last word of a large list matches');

echo "PASS: {$checks} profanity checks\n";
```

</details>

<details>
<summary>api/tests/promotional_digest_test.php</summary>

[Open source](../api/tests/promotional_digest_test.php)

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/promo_schedule.php';
require_once __DIR__ . '/../utility/transactional_email_html.php';

function check_promo(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

foreach ([
    ['2026-01-15 21:59:00Z', false],
    ['2026-01-15 22:00:00Z', true],
    ['2026-01-15 22:05:00Z', true],
    ['2026-01-15 23:00:00Z', false],
    ['2026-07-15 20:59:00Z', false],
    ['2026-07-15 21:00:00Z', true],
    ['2026-07-15 22:00:00Z', false],
] as [$time, $expected]) {
    check_promo(dm_promo_schedule(new DateTimeImmutable($time))['send_window'] === $expected, "send window at {$time}");
}

foreach (['2026-03-08', '2026-11-01', '2026-09-22'] as $date) {
    $now = new DateTimeImmutable("{$date} 17:00:00", new DateTimeZone('America/New_York'));
    $schedule = dm_promo_schedule($now);
    foreach (['daily' => 1, 'weekly' => 7] as $frequency => $days) {
        $lastSent = $now->modify("-{$days} days")->modify('+5 minutes')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        check_promo($lastSent < $schedule[$frequency . '_before'], "{$frequency} remains due across clock changes and execution delays on {$date}");
        $tooRecent = $now->modify('-' . ($days - 1) . ' days')->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
        check_promo($tooRecent >= $schedule[$frequency . '_before'], "{$frequency} does not send again too soon on {$date}");
    }
}

$package = dm_promotional_items_package('Test', [['title' => 'Desk', 'price' => 25, 'url' => 'https://example.com/item']]);
foreach (['html', 'text'] as $format) {
    check_promo(str_contains($package[$format], 'another student'), "{$format} uses student wording");
    check_promo(!str_contains(strtolower($package[$format]), 'another bull'), "{$format} has no Bull wording");
}
echo "PASS: Eastern send window, daily/weekly eligibility, DST, repeat prevention, and email copy\n";
```

</details>

<details>
<summary>api/tests/purchase_lifecycle_test.php</summary>

[Open source](../api/tests/purchase_lifecycle_test.php)

```php
<?php
declare(strict_types=1);

// Purchase lifecycle over real HTTP endpoints: schedule, confirm, cancel, delete,
// ban, and the review and listing-edit rules that depend on them.
// User 1 sells; 2 and 3 buy; 4 is unrelated (and later a moderator).
require __DIR__ . '/support/integration_harness.php';

function fixture(int $buyer = 2): array {
    global $conn;
    $conn->query("INSERT INTO INVENTORY (title,seller_id,listing_price,price_nego,trades,photos,item_location) VALUES ('Lifecycle desk',1,25,1,1,'[\"/test.jpg\"]','North Campus')");
    $product = (int)$conn->insert_id;
    $response = api($buyer, 'chat/ensure_conversation.php', ['product_id' => $product]);
    if (!ok($response)) throw new RuntimeException('Fixture conversation failed: ' . json_encode($response));
    return [$product, (int)$response['body']['conv_id']];
}
function schedule(int $product, int $conversation): array {
    return api(1, 'scheduled_purchases/create.php', ['inventory_product_id' => $product,
        'conversation_id' => $conversation, 'meeting_at' => gmdate('c', time() + 86400),
        'meet_location' => 'North Campus']);
}
function accepted(int $product, int $conversation): int {
    $result = schedule($product, $conversation);
    if (!ok($result)) throw new RuntimeException('Schedule fixture failed: ' . json_encode($result));
    $id = (int)$result['body']['data']['request_id'];
    $result = api(2, 'scheduled_purchases/respond.php', ['request_id' => $id, 'action' => 'accept']);
    if (!ok($result)) throw new RuntimeException('Acceptance fixture failed: ' . json_encode($result));
    return $id;
}
function confirm(int $product, int $conversation, int $schedule, bool $success = true): array {
    return api(1, 'confirm_purchases/create.php', ['product_id' => $product, 'conversation_id' => $conversation,
        'scheduled_request_id' => $schedule, 'is_successful' => $success, 'final_price' => 25,
        'failure_reason' => $success ? null : 'buyer_no_show']);
}

harness_start('lifecycle', 4);

// Exercise the actual review fixture, including its purchase-history format.
$conn->query("UPDATE user_accounts SET email='testuser@buffalo.edu' WHERE user_id=2");
$conn->query("UPDATE user_accounts SET email='testuserschedulered@buffalo.edu' WHERE user_id=1");
$conn->multi_query(file_get_contents($root . '/data/014_#294_review_test_data.sql'));
do {
    if ($result = $conn->store_result()) $result->free();
    if (!$conn->more_results()) break;
    $conn->next_result();
} while (true);
$notebook = (int)row("SELECT product_id FROM INVENTORY WHERE title='Marble Notebook'")['product_id'];
$review = ['product_id' => $notebook, 'rating' => 4, 'product_rating' => 4, 'review_text' => 'Review fixture test'];
$upload = api_multipart(2, 'reviews/upload_review_video.php',
    ['video' => new CURLFile(__DIR__ . '/fixtures/review-video.webm', 'video/webm', 'review.webm')]);
check(ok($upload) && !empty($upload['body']['video_url']), 'buyer can upload a review video');
$uploadedVideo = $upload['body']['video_url'] ?? null;
harness_on_cleanup(static function () use ($uploadedVideo): void {
    if (!$uploadedVideo) return;
    require_once __DIR__ . '/../helpers/image_upload.php';
    @unlink(data_media_dir('review-images') . '/' . basename($uploadedVideo));
});
$review['video_url'] = '/media/review-images/review_u3_20260930_120000_abcdef123456.webm';
check(api(2, 'reviews/submit_review.php', $review)['status'] === 400, 'buyer cannot attach another user video');
$review['video_url'] = '/media/review-images/review_u2_20260930_120000_abcdef123456.webm';
check(api(2, 'reviews/submit_review.php', $review)['status'] === 400, 'missing review video is rejected');
$review['video_url'] = $uploadedVideo;
check(api(3, 'reviews/submit_review.php', array_replace($review, ['video_url' => null]))['status'] === 403, 'unrelated buyer cannot review the seeded notebook');
check(ok(api(2, 'reviews/submit_review.php', $review)), 'seeded Marble Notebook buyer can submit a review');
check(api(2, 'reviews/get_review.php?product_id=' . $notebook, null)['body']['review']['video_url'] === $uploadedVideo, 'buyer can retrieve review video');
check(api(1, 'reviews/get_product_reviews.php?product_id=' . $notebook, null)['body']['reviews'][0]['video_url'] === $uploadedVideo, 'seller dashboard can retrieve review video');
$range = http_get(harness_guest(), 'media/image.php?url=' . rawurlencode((string)$uploadedVideo), ['Range: bytes=0-15']);
check($range['status'] === 206 && strlen($range['raw']) === 16, 'review video supports byte-range playback');
check(api(2, 'reviews/submit_review.php', $review)['status'] === 409, 'seeded notebook cannot be reviewed twice');
$conn->query("UPDATE user_accounts SET email='lifecycle2@buffalo.edu' WHERE user_id=2");
$conn->query("UPDATE user_accounts SET email='lifecycle1@buffalo.edu' WHERE user_id=1");

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmation = confirm($product, $conversation, $request);
check(ok($confirmation), 'seller can confirm an accepted schedule');
$confirmationId = (int)$confirmation['body']['data']['confirm_request_id'];
check(rejected(api(3, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'unrelated buyer cannot accept confirmation');
check(ok(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'buyer completes purchase');
check(rejected(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'repeat confirmation is rejected');
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 1, 'completion marks listing sold');
check(rejected(api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request])), 'completed purchase cannot be cancelled');
check(rejected(api(1, 'seller_dashboard/delete_listing.php', ['id' => $product])), 'sold listing and receipt cannot be deleted');

[$product, $conversation] = fixture();
[$otherProduct, $otherConversation] = fixture();
check(rejected(schedule($product, $otherConversation)), 'schedule cannot target a chat for another product');
$first = schedule($product, $conversation);
check(ok($first), 'first schedule is created');
check(rejected(schedule($product, $conversation)), 'duplicate pending schedule is rejected');

// A direct multipart request must not bypass the listing edit restrictions.
foreach (['Active', 'Draft', 'Pending', 'Sold', 'sold_flag'] as $state) {
    [$editProduct] = fixture();
    $storedStatus = $state === 'sold_flag' ? 'Active' : $state;
    $soldFlag = $state === 'sold_flag' ? 1 : 0;
    $conn->query("UPDATE INVENTORY SET item_status='$storedStatus', sold=$soldFlag WHERE product_id=$editProduct");
    foreach (['Active', 'Draft'] as $targetStatus) {
        $edit = api_multipart(1, 'seller_dashboard/product_listing.php', [
            'mode' => 'update', 'id' => (string)$editProduct,
            'status' => $targetStatus, 'title' => 'Edited lifecycle desk',
            'description' => 'A desk for lifecycle testing', 'price' => '25',
            'categories[0]' => 'Furniture', 'itemLocation' => 'North Campus', 'condition' => 'Good',
            'existingPhotos[0]' => '/test.jpg',
        ]);
        [$httpStatus, $body] = [$edit['status'], $edit['body']];
        $blocked = in_array($state, ['Pending', 'Sold', 'sold_flag'], true);
        check($httpStatus === ($blocked ? 403 : 200), "$state listing edit to $targetStatus returns the expected status ($httpStatus: " . json_encode($body) . ')');
        if ($blocked) {
            check(($body['error'] ?? '') === 'Pending or sold listings cannot be edited.', "$state edit reaches the state guard");
            $unchanged = row("SELECT title, item_status, sold FROM INVENTORY WHERE product_id=$editProduct");
            check($unchanged['title'] === 'Lifecycle desk' && $unchanged['item_status'] === $storedStatus
                && (int)$unchanged['sold'] === $soldFlag, "$state edit leaves the listing unchanged");
        }
    }
}

foreach (['Draft', 'Sold'] as $state) {
    [$product, $conversation] = fixture();
    $conn->query("UPDATE INVENTORY SET item_status='$state' WHERE product_id=$product");
    check(rejected(schedule($product, $conversation)), "$state listing cannot be scheduled");
    [$product, $conversation] = fixture();
    $request = (int)schedule($product, $conversation)['body']['data']['request_id'];
    $conn->query("UPDATE INVENTORY SET item_status='$state' WHERE product_id=$product");
    check(rejected(api(2, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), "old schedule cannot accept a $state listing");
}

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request)['body']['data']['confirm_request_id'];
check(ok(api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request])), 'buyer can cancel before completion');
check(rejected(api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept'])), 'cancelled schedule cannot be completed through old confirmation');
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 0, 'cancelled purchase leaves listing unsold');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request)['body']['data']['confirm_request_id'];
api(2, 'scheduled_purchases/cancel.php', ['request_id' => $request]);
$conn->query("UPDATE confirm_purchase_requests SET expires_at=DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE confirm_request_id=$confirmationId");
require_once __DIR__ . '/../confirm_purchases/helpers.php';
$conn->begin_transaction();
auto_finalize_confirm_request($conn, row("SELECT * FROM confirm_purchase_requests WHERE confirm_request_id=$confirmationId"));
$conn->commit();
check((int)row("SELECT sold FROM INVENTORY WHERE product_id=$product")['sold'] === 0, 'cancelled confirmation cannot auto-complete later');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
check(rejected(api(1, 'seller_dashboard/set_item_status.php', ['id' => $product, 'status' => 'Active'])), 'reserved listing cannot be manually reactivated');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
$confirmationId = (int)confirm($product, $conversation, $request, false)['body']['data']['confirm_request_id'];
api(2, 'confirm_purchases/respond.php', ['confirm_request_id' => $confirmationId, 'action' => 'accept']);
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'unsuccessful exchange releases listing');
$secondConversation = (int)api(3, 'chat/ensure_conversation.php', ['product_id' => $product])['body']['conv_id'];
$secondRequest = (int)schedule($product, $secondConversation)['body']['data']['request_id'];
check(ok(api(3, 'scheduled_purchases/respond.php', ['request_id' => $secondRequest, 'action' => 'accept'])), 'another buyer can reserve after unsuccessful exchange');
check(rejected(confirm($product, $conversation, $request)), 'old unsuccessful schedule cannot steal a newer reservation');
$secondConfirmationId = (int)confirm($product, $secondConversation, $secondRequest)['body']['data']['confirm_request_id'];
check($secondConfirmationId > $confirmationId, 'second buyer has a newer confirmation on the same listing');
$firstBuyerReceipt = api(2, 'receipt/view_receipt.php?product_id=' . $product, null);
check(ok($firstBuyerReceipt), 'first buyer can still open their receipt after another buyer confirms');
check(ok(api(3, 'receipt/view_receipt.php?product_id=' . $product, null)), 'second buyer can open their receipt');
check(!ok(api(4, 'receipt/view_receipt.php?product_id=' . $product, null)), 'an unrelated user cannot open a receipt for the listing');

[$product, $conversation] = fixture();
$request = accepted($product, $conversation);
check(ok(api(1, 'seller_dashboard/delete_listing.php', ['id' => $product])), 'seller can delete unsold listing with a schedule');
check((int)row("SELECT item_deleted FROM conversations WHERE conv_id=$conversation")['item_deleted'] === 1, 'listing deletion closes chat');
check(rejected(api(2, 'chat/create_message.php', ['conv_id' => $conversation, 'receiver_id' => 1, 'content' => 'Still here?'])), 'closed chat rejects text messages');
check(rejected(api(2, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), 'deleted listing rejects stale schedule card');
check(rejected(confirm($product, $conversation, $request)), 'deleted listing rejects confirmation');

// Wishlist adds are decided by the unique key; a repeat add is a 400, not a 500.
[$product, $conversation] = fixture();
check(ok(api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $product])), 'buyer can wishlist a listing');
$repeatAdd = api(2, 'wishlist/add_to_wishlist.php', ['product_id' => $product]);
check($repeatAdd['status'] === 400 && ($repeatAdd['body']['error'] ?? '') === 'Product already in wishlist', 'repeat wishlist add is rejected cleanly');
check((int)row("SELECT wishlisted FROM INVENTORY WHERE product_id=$product")['wishlisted'] === 1, 'repeat wishlist add does not double-count');

// Chat media is participant-only and answers errors as JSON.
$introMessage = (int)row("SELECT message_id FROM messages WHERE conv_id=$conversation ORDER BY message_id LIMIT 1")['message_id'];
$outsider = http_get(4, 'chat/serve_chat_image.php?message_id=' . $introMessage);
check(error_is($outsider, 403, 'forbidden'), 'non-participant cannot fetch chat media');
check(str_starts_with($outsider['type'], 'application/json'), 'chat media errors are sent as JSON');
check((http_get(2, 'chat/serve_chat_image.php?message_id=' . $introMessage)['body']['error'] ?? '') === 'no_image', 'participant gets no_image for a text message');

// Last: this deletes buyer 2.
[$product, $conversation] = fixture();
accepted($product, $conversation);
check(ok(api(2, 'auth/delete_account.php', ['confirmation' => 'lifecycle2@buffalo.edu', 'currentPassword' => $password])), 'buyer can delete their account');
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'buyer account deletion puts their reserved item back on sale');

// Ban: seller 1 is banned by moderator 4 while buyer 3 holds a reservation.
[$product, $conversation] = fixture(3);
$request = (int)schedule($product, $conversation)['body']['data']['request_id'];
check(ok(api(3, 'scheduled_purchases/respond.php', ['request_id' => $request, 'action' => 'accept'])), 'buyer reserves before the seller is banned');
$conn->query("UPDATE user_accounts SET role='moderator' WHERE user_id=4");
check(ok(api(4, 'moderation/ban_user.php', ['user_id' => 1, 'banned' => true, 'reason' => 'Lifecycle test'])), 'moderator can ban the seller');
check(row("SELECT status FROM scheduled_purchase_requests WHERE request_id=$request")['status'] === 'cancelled', "banning cancels the banned user's open schedules");
check(row("SELECT item_status FROM INVENTORY WHERE product_id=$product")['item_status'] === 'Active', 'the reserved item is released when its seller is banned');
$results = api(3, 'search/get_search_items.php', ['q' => 'Lifecycle desk'])['body'] ?? [];
check(!in_array($product, array_map(static fn($r) => (int)($r['id'] ?? 0), is_array($results) ? $results : []), true), "a banned seller's listings are hidden from search");
check(api(3, 'product/view_product.php?product_id=' . $product, null)['status'] === 404, "a banned seller's product page is hidden");
check(rejected(api(3, 'chat/ensure_conversation.php', ['product_id' => $product])), 'nobody can start a chat with a banned seller');
check(rejected(api(3, 'chat/create_message.php', ['conv_id' => $conversation, 'receiver_id' => 1, 'content' => 'Hello?'])), 'nobody can message a banned seller');
check((int)row("SELECT COUNT(*) AS c FROM moderation_actions WHERE action='ban_user' AND target_user_id=1")['c'] === 1, 'the ban is written to the moderation audit log');
check(ok(api(4, 'moderation/ban_user.php', ['user_id' => 1, 'banned' => false, 'reason' => 'Lifecycle test'])), 'moderator can lift the ban');
check(api(3, 'product/view_product.php?product_id=' . $product, null)['status'] === 200, 'listings come back once the ban is lifted');

harness_finish();
```

</details>

<details>
<summary>api/tests/schedule_proposal_test.php</summary>

[Open source](../api/tests/schedule_proposal_test.php)

```php
<?php
declare(strict_types=1);

// Edges of the Scheduled Purchase proposal rules in api/scheduled_purchases/proposal.php.
// Pure checks with a fixed clock: no database, no network.

require_once __DIR__ . '/../scheduled_purchases/proposal.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_same($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

$now = new DateTimeImmutable('2026-10-01T12:00:00Z');
$valid = [
    'inventory_product_id' => 7, 'conversation_id' => 9,
    'meeting_at' => '2026-10-02T12:00:00Z', 'meet_location' => 'North Campus',
];
$read = static fn(array $overrides, bool $payments = false): array =>
    scheduled_purchase_read_proposal(array_merge($valid, $overrides), $now, $payments);
$error = static fn(array $overrides, bool $payments = false): ?string => $read($overrides, $payments)['error'] ?? null;
$proposal = static fn(array $overrides, bool $payments = false): array => $read($overrides, $payments)['proposal'] ?? [];

// --- meeting time window --------------------------------------------------------
expect_same($read([])['ok'], true, 'a meeting tomorrow is accepted');
expect_same($read(['meeting_at' => '2026-10-01T12:00:00Z'])['ok'], true, 'a meeting at exactly now is accepted');
expect_same($error(['meeting_at' => '2026-10-01T11:59:59Z']), 'Meeting date cannot be in the past', 'one second ago is in the past');
expect_same($read(['meeting_at' => '2027-01-01T12:00:00Z'])['ok'], true, 'exactly three months ahead is accepted');
expect_same($error(['meeting_at' => '2027-01-01T12:00:01Z']), 'Meeting date cannot be more than 3 months in advance', 'one second past three months is refused');
expect_same($proposal(['meeting_at' => '2026-10-01T08:00:00-04:00'])['meeting_at']->format(DATE_ATOM), '2026-10-01T12:00:00+00:00',
    'an Eastern offset is compared and stored as UTC');
expect_same($error(['meeting_at' => '2026-10-02 12:00']), 'Invalid meeting date/time', 'a time without a zone is refused');

// --- required fields ------------------------------------------------------------
foreach (['inventory_product_id', 'conversation_id', 'meeting_at', 'meet_location'] as $field) {
    expect_same($error([$field => '']), 'Missing required fields', "$field is required");
}

// --- meet location ----------------------------------------------------------------
$thirtyChars = 'Café near Lockwood Library ok'; // 29 characters, 30 bytes
expect_same(mb_strlen($thirtyChars . '!'), 30, 'fixture is exactly 30 characters');
expect_same($proposal(['meet_location_choice' => 'Other', 'custom_meet_location' => $thirtyChars . '!'])['meet_location'] ?? null,
    $thirtyChars . '!', 'a 30-character place with an accent is accepted (characters, not bytes)');
expect_same($error(['meet_location_choice' => 'Other', 'custom_meet_location' => str_repeat('x', 31)]), 'Meet location is too long', '31 characters is too long');
expect_same($error(['meet_location_choice' => 'Other', 'custom_meet_location' => '  ']), 'Custom meet location is required', '"Other" needs a typed place');
expect_same($error(['meet_location_choice' => 'Mars']), 'Invalid meet location choice', 'only the listed campuses are choices');
expect_same($error(['meet_location_choice' => ['North Campus']]), 'Invalid meet location choice', 'a non-text choice is refused');
expect_same($proposal(['meet_location_choice' => 'Ellicott'])['meet_location'] ?? null, 'Ellicott', 'a listed choice replaces the free-text field');

// --- description and trades --------------------------------------------------------
expect_same($read(['description' => str_repeat('d', 1000)])['ok'], true, 'a 1000-character description is accepted');
expect_same($error(['description' => str_repeat('d', 1001)]), 'Description cannot exceed 1000 characters', '1001 characters is refused');
expect_same($error(['description' => ['x']]), 'Invalid description', 'a non-text description is refused');
expect_same($error(['is_trade' => 'yes']), 'Invalid trade selection', 'trade must be a real boolean');
expect_same($proposal(['is_trade' => '1'])['is_trade'] ?? null, true, '"1" counts as a trade');
expect_same($error(['trade_item_description' => str_repeat('t', 101)]), 'Trade item description cannot exceed 100 characters', 'trade description is capped');
expect_same($error(['trade_item_description' => 5]), 'Invalid trade item description', 'a non-text trade description is refused');

// --- negotiated price ---------------------------------------------------------------
expect_same($proposal(['negotiated_price' => '12.50'])['negotiated_price'] ?? null, 12.5, 'a two-decimal price is read');
expect_same($proposal(['negotiated_price' => 20])['negotiated_price'] ?? null, 20.0, 'a numeric price is read');
expect_same($proposal(['negotiated_price' => '.5'])['negotiated_price'] ?? null, 0.5, 'a leading-dot price is read');
foreach (['12.505', '-5', '1e3', ' ', 'twelve'] as $badPrice) {
    expect_same($error(['negotiated_price' => $badPrice]), 'Invalid negotiated price', "\"$badPrice\" is not a price");
}
expect_same($error(['negotiated_price' => true]), 'Invalid negotiated price', 'a boolean is not a price');
$plain = $proposal([]);
expect_same(array_key_exists('negotiated_price', $plain) && $plain['negotiated_price'] === null, true, 'no price means no negotiation');

// --- built-in payment ----------------------------------------------------------------
expect_same($read(['payment_option' => 'stripe', 'payment_amount' => '5.00'])['status'] ?? null, 409, 'Stripe is refused while payments are disabled');
expect_same($error(['payment_option' => 'stripe', 'payment_amount' => '0.49'], true), 'Built-in payment amount must be between $0.50 and $9,999.99', 'below the Stripe minimum is refused');
expect_same($proposal(['payment_option' => 'Stripe', 'payment_amount' => '0.50'], true)['payment_amount_cents'] ?? null, 50, 'the minimum is accepted, case-insensitively');
expect_same($error(['payment_option' => 'cash']), 'Invalid payment option', 'only manual and stripe are options');

// --- listing terms -----------------------------------------------------------------------
$terms = static fn(array $overrides, bool $negotiable = true, bool $trades = true): ?string =>
    scheduled_purchase_terms_error(array_merge($proposal([]), $overrides), $negotiable, $trades);
expect_same($terms([]), null, 'a plain proposal meets every listing');
expect_same($terms(['negotiated_price' => 10.0, 'negotiated_price_text' => '10'], false), 'This item is not marked as price negotiable', 'no price on a fixed-price listing');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp'], true, false), 'This item does not accept trades', 'no trade on a no-trades listing');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp', 'negotiated_price' => 5.0, 'negotiated_price_text' => '5']),
    'Cannot enter a price for a trade', 'a trade and a price are exclusive');
expect_same($terms(['is_trade' => true, 'trade_item_description' => '']), 'Trade item description is required when trade is selected', 'a trade says what is offered');
expect_same($terms(['is_trade' => true, 'trade_item_description' => 'Lamp', 'payment_option' => 'stripe']),
    'Built-in payment is not available for trades', 'a trade cannot be paid through Stripe');
expect_same($terms(['negotiated_price' => 9999.99, 'negotiated_price_text' => '9999.99']), null, 'the maximum price is allowed');
expect_same($terms(['negotiated_price' => 10000.0, 'negotiated_price_text' => '10000']), 'Negotiated price must be $9999.99 or less', 'one cent over the maximum is refused');
expect_same($terms(['negotiated_price' => 4.2, 'negotiated_price_text' => '4.20']), 'Invalid price value', 'the typed "4.20" is caught even though the float is 4.2');

echo "PASS: {$checks} schedule proposal checks\n";
```

</details>

<details>
<summary>api/tests/schema_sync_test.php</summary>

[Open source](../api/tests/schema_sync_test.php)

```php
<?php
declare(strict_types=1);

// Declarative schema sync (api/database/schema_sync.php): parsing and diffing
// need no database; the last section edits table files against a scratch
// database on the local server and is skipped if none is reachable.

require_once __DIR__ . '/../database/schema_sync.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_same($actual, $expected, string $message): void
{
    global $checks;
    $checks++;
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nExpected: " . var_export($expected, true)
            . "\nActual: " . var_export($actual, true) . "\n");
        exit(1);
    }
}

function expect_throws(callable $fn, string $needle, string $message): void
{
    global $checks;
    $checks++;
    try {
        $fn();
    } catch (RuntimeException $e) {
        if (!str_contains($e->getMessage(), $needle)) {
            fwrite(STDERR, "FAIL: {$message}\nWrong error: {$e->getMessage()}\n");
            exit(1);
        }
        return;
    }
    fwrite(STDERR, "FAIL: {$message}\nNothing was thrown\n");
    exit(1);
}

// --- schema_split_statements ---
expect_same(
    schema_split_statements("-- note; with semicolon\nCREATE TABLE a (x INT COMMENT 'a;b''c'); /* c; */ INSERT INTO a VALUES (1);\n# done;\n"),
    ["CREATE TABLE a (x INT COMMENT 'a;b''c')", 'INSERT INTO a VALUES (1)'],
    'statements split on semicolons outside quotes and comments'
);
expect_same(schema_split_statements("  \n-- only a comment\n"), [], 'a comment-only file has no statements');

// --- schema_parse_table_file ---
$file = '/tmp/orders.sql';
$parsed = schema_parse_table_file($file, "CREATE TABLE IF NOT EXISTS `orders` (\n  id INT,\n  user_id INT,\n  FOREIGN KEY (user_id) REFERENCES Users(id),\n  FOREIGN KEY (id) REFERENCES orders(id)\n);\nINSERT IGNORE INTO orders (id) VALUES (1);");
expect_same($parsed['name'], 'orders', 'table name read from CREATE TABLE');
expect_same($parsed['deps'], ['Users'], 'dependencies exclude the table itself');
expect_same(count($parsed['seed']), 1, 'INSERT after CREATE is a starter row');
expect_throws(fn() => schema_parse_table_file('/tmp/other.sql', 'CREATE TABLE orders (id INT);'), "declares table 'orders'", 'file must be named after its table');
expect_throws(fn() => schema_parse_table_file($file, 'DROP TABLE orders;'), 'must start with a CREATE TABLE', 'first statement must be CREATE TABLE');
expect_throws(fn() => schema_parse_table_file($file, "CREATE TABLE orders (id INT);\nDELETE FROM orders;"), 'only INSERT', 'only INSERT may follow CREATE TABLE');

// --- schema_order_tables ---
$make = fn(string $name, array $deps) => ['name' => $name, 'file' => "{$name}.sql", 'deps' => $deps];
$order = array_keys(schema_order_tables([
    'c' => $make('c', ['b']), 'b' => $make('b', ['a']), 'a' => $make('a', []),
]));
expect_same($order, ['a', 'b', 'c'], 'referenced tables come first');
expect_throws(fn() => schema_order_tables(['a' => $make('a', ['b']), 'b' => $make('b', ['a'])]), 'Circular', 'circular references are rejected');
expect_throws(fn() => schema_order_tables(['a' => $make('a', ['ghost'])]), "references 'ghost'", 'a reference to an undeclared table is rejected');

// --- schema_parse_create + schema_diff_table ---
$ddl = function (array $lines): string {
    return "CREATE TABLE `t` (\n  " . implode(",\n  ", $lines) . "\n) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4";
};
$live = schema_parse_create($ddl([
    '`id` int(11) NOT NULL AUTO_INCREMENT', '`name` varchar(20) NOT NULL', '`old` int(11) DEFAULT NULL',
    'PRIMARY KEY (`id`)', 'KEY `idx_name` (`name`)', 'KEY `idx_gone` (`old`)',
    'CONSTRAINT `fk_a` FOREIGN KEY (`old`) REFERENCES `u` (`id`)', 'CONSTRAINT `chk_a` CHECK (`id` > 0)',
]));
expect_same(array_keys($live['columns']), ['id', 'name', 'old'], 'columns parsed');
expect_same(array_keys($live['indexes']), ['idx_name', 'idx_gone'], 'indexes parsed');
expect_same(array_keys($live['foreign_keys']), ['fk_a'], 'foreign keys parsed');
expect_same(array_keys($live['checks']), ['chk_a'], 'checks parsed');
expect_same(str_contains($live['options'], 'AUTO_INCREMENT'), false, 'table AUTO_INCREMENT counter is ignored');

expect_same(schema_diff_table('t', $live, $live), [], 'identical tables have no operations');

$want = schema_parse_create($ddl([
    '`id` int(11) NOT NULL AUTO_INCREMENT', '`name` varchar(40) NOT NULL', '`added` int(11) DEFAULT NULL',
    'PRIMARY KEY (`id`)', 'KEY `idx_name` (`name`,`added`)',
    'CONSTRAINT `chk_b` CHECK (`id` > 1)',
]));
$notes = array_map(fn($op) => $op['phase'] . ':' . $op['note'], schema_diff_table('t', $live, $want));
expect_same($notes, [
    '1:drop check chk_a', '1:drop foreign key fk_a',
    '2:drop index idx_gone',
    '3:change column name', '3:add column added', '3:drop column old',
    '4:change index idx_name',
    '6:add check chk_b',
], 'diff lists drops first, then columns, indexes, then constraints');
$ops = schema_diff_table('t', $live, $want);
expect_same($ops[3]['sql'], 'ALTER TABLE `t` MODIFY COLUMN `name` varchar(40) NOT NULL', 'changed column is modified in place');
expect_same($ops[4]['sql'], 'ALTER TABLE `t` ADD COLUMN `added` int(11) DEFAULT NULL AFTER `name`', 'new column is placed after its predecessor');
expect_same($ops[5]['destructive'], true, 'dropping a column is flagged destructive');
expect_same($ops[6]["sql"], 'ALTER TABLE `t` DROP INDEX `idx_name`, ADD KEY `idx_name` (`name`,`added`)', 'a changed index is replaced in one statement');

// --- against a scratch database ---
mysqli_report(MYSQLI_REPORT_OFF);
$host = getenv('DB_HOST') ?: '127.0.0.1';
if (!in_array(strtolower($host), ['127.0.0.1', 'localhost', '::1'], true)) {
    echo "PASS: {$checks} schema sync checks (database section skipped: DB_HOST is not local)\n";
    exit(0);
}
$scratch = 'dm_schema_sync_test_' . getmypid();
$conn = @new mysqli($host, getenv('DB_USERNAME') ?: 'root', getenv('DB_PASSWORD') ?: '');
if ($conn->connect_errno) {
    echo "PASS: {$checks} schema sync checks (database section skipped: no local database)\n";
    exit(0);
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . $scratch;
mkdir($dir);
$write = fn(string $name, string $sql) => file_put_contents("{$dir}/{$name}.sql", $sql);
$sync = fn(array $options = []) => schema_sync_run($conn, $dir, $options);
$columns = function (string $table) use ($conn, $scratch): array {
    $r = $conn->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='{$scratch}' AND TABLE_NAME='{$table}' ORDER BY ORDINAL_POSITION");
    return array_column($r->fetch_all(MYSQLI_NUM), 0);
};

// expect_same() calls exit(), which skips finally blocks, so a shutdown function
// is what guarantees the scratch databases go away after a failed check.
register_shutdown_function(static function () use ($conn, $scratch, $dir): void {
    $conn->query("DROP DATABASE IF EXISTS `{$scratch}`");
    $conn->query('DROP DATABASE IF EXISTS `' . schema_shadow_name($scratch) . '`');
    foreach (glob("{$dir}/*.sql") ?: [] as $leftover) {
        unlink($leftover);
    }
    @rmdir($dir);
});

{
    $conn->query("CREATE DATABASE `{$scratch}` CHARACTER SET utf8mb4");
    $conn->select_db($scratch);

    $write('owners', "CREATE TABLE owners (\n  owner_id INT NOT NULL AUTO_INCREMENT,\n  name VARCHAR(20) NOT NULL,\n  PRIMARY KEY (owner_id)\n) ENGINE=InnoDB;\nINSERT IGNORE INTO owners (owner_id, name) VALUES (1, 'starter');\n");
    $write('pets', "CREATE TABLE pets (\n  pet_id INT NOT NULL AUTO_INCREMENT,\n  owner_id INT NOT NULL,\n  nickname VARCHAR(20) NOT NULL,\n  PRIMARY KEY (pet_id),\n  CONSTRAINT fk_pet_owner FOREIGN KEY (owner_id) REFERENCES owners(owner_id) ON DELETE CASCADE\n) ENGINE=InnoDB;\n");

    $report = $sync();
    expect_same($report['created'], ['owners', 'pets'], 'tables are created, referenced table first');
    expect_same((int)$conn->query('SELECT COUNT(*) FROM owners')->fetch_row()[0], 1, 'starter rows are inserted into an empty table');
    expect_same($report['warnings'], [], 'a fresh sync converges');

    $conn->query("INSERT INTO pets (owner_id, nickname) VALUES (1, 'Rex')");
    $report = $sync();
    expect_same([$report['created'], $report['altered']], [[], []], 'syncing again changes nothing');
    expect_same((int)$conn->query('SELECT COUNT(*) FROM owners')->fetch_row()[0], 1, 'starter rows are not re-added to a populated table');

    $write('pets', str_replace("  nickname VARCHAR(20) NOT NULL,\n", "  nickname VARCHAR(20) NOT NULL,\n  color VARCHAR(10) NULL,\n", file_get_contents("{$dir}/pets.sql")));
    $report = $sync();
    expect_same($report['altered'], ['pets' => ['add column color']], 'a new column in the file is added');
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname', 'color'], 'the new column is in file order');

    $write('pets', str_replace('nickname VARCHAR(20)', 'nickname VARCHAR(40)', file_get_contents("{$dir}/pets.sql")));
    expect_same($sync()['altered'], ['pets' => ['change column nickname']], 'a changed column definition is applied');

    $dryRun = $sync(['dry_run' => true]);
    expect_same($dryRun['plan'], [], 'dry run on a synced database plans nothing');
    $write('pets', str_replace("  color VARCHAR(10) NULL,\n", '', file_get_contents("{$dir}/pets.sql")));
    $dryRun = $sync(['dry_run' => true]);
    expect_same(count($dryRun['plan']), 1, 'dry run reports the drop');
    expect_same(str_starts_with($dryRun['plan'][0], '[destructive]'), true, 'dry run marks the drop destructive');
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname', 'color'], 'dry run changes nothing');
    $sync();
    expect_same($columns('pets'), ['pet_id', 'owner_id', 'nickname'], 'a column removed from the file is dropped');
    expect_same((string)$conn->query('SELECT nickname FROM pets')->fetch_row()[0], 'Rex', 'existing rows survive every change');

    unlink("{$dir}/pets.sql");
    $report = $sync();
    expect_same([$report['unmanaged'], $report['dropped_tables']], [['pets'], []], 'a table without a file is reported, not dropped');
    $report = $sync(['prune' => true]);
    expect_same($report['dropped_tables'], ['pets'], '--prune drops tables without a file');
}

echo "PASS: {$checks} schema sync checks\n";
```

</details>

<details>
<summary>api/tests/support/integration_harness.php</summary>

[Open source](../api/tests/support/integration_harness.php)

```php
<?php
declare(strict_types=1);

// Shared setup for the HTTP integration suites. Each suite gets its own randomly
// named local database, migrated from scratch, a private `php -S` server, and
// logged-in fixture users. Nothing touches application data, and outgoing email
// is disabled, so account and password-reset flows can run safely.
//
// Usage:
//   require __DIR__ . '/support/integration_harness.php';
//   harness_start('lifecycle', 4);   // users lifecycle1@ … lifecycle4@buffalo.edu
//   check(ok(api(1, 'some/endpoint.php', ['field' => 1])), 'what the endpoint promises');
//   harness_finish();
//
// Set HARNESS_KEEP_LOG=1 to keep the test server's PHP error log for a failed run.

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../../utility/load_env.php';
load_env();
if (!in_array(getenv('DB_HOST'), ['localhost', '127.0.0.1', '::1'], true)) {
    throw new RuntimeException('Integration tests require a local MySQL server.');
}
// load_env() never overrides a variable that is already set, so blanking these
// here keeps the test server from reaching Resend or SMTP.
foreach (['RESEND_API_KEY', 'GMAIL_USERNAME', 'GMAIL_PASSWORD'] as $mailSetting) {
    putenv($mailSetting . '=');
}

$root = dirname(__DIR__, 3);
$conn = null;
$base = '';
$cookies = [];
$tokens = [];
$password = '';
$checks = 0;
$failures = 0;
$harness = ['database' => null, 'server' => null, 'log' => null, 'prefix' => '', 'cleanup' => []];

/** Create the database, migrate it, add $users accounts, and log each one in. */
function harness_start(string $prefix, int $users): void
{
    global $conn, $base, $password, $harness, $root;

    $harness['prefix'] = $prefix;
    $harness['database'] = 'dm_' . $prefix . '_test_' . bin2hex(random_bytes(6));
    $harness['log'] = tempnam(sys_get_temp_dir(), 'dm-' . $prefix . '-');
    putenv('DB_NAME=' . $harness['database']);
    require_once __DIR__ . '/../../database/db_connect.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $conn = db();
    register_shutdown_function('harness_cleanup');

    $log = $harness['log'];
    $migration = proc_open([PHP_BINARY, 'api/database/migrate_schema.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $root);
    if (proc_close($migration) !== 0) {
        throw new RuntimeException('Test schema migration failed; inspect ' . $log);
    }

    $password = bin2hex(random_bytes(16)) . 'Aa1!';
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare("INSERT INTO user_accounts (user_id, first_name, last_name, grad_month, grad_year, email, hash_pass)
                            VALUES (?, 'Harness', 'Test', 5, 2027, ?, ?)");
    for ($id = 1; $id <= $users; $id++) {
        $email = harness_email($id);
        $stmt->bind_param('iss', $id, $email, $hash);
        $stmt->execute();
    }
    $stmt->close();

    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $base = 'http://' . $address;
    $harness['server'] = proc_open([PHP_BINARY, '-S', $address, 'router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes, $root);
    for ($attempt = 0; $attempt < 50 && @file_get_contents($base . '/api/auth/get_csrf_token.php') === false; $attempt++) {
        usleep(100000);
    }

    for ($id = 1; $id <= $users; $id++) {
        harness_login($id);
    }
}

function harness_email(int $id): string
{
    global $harness;
    return $harness['prefix'] . $id . '@buffalo.edu';
}

/** Start a fresh session for $user (any cookie-jar key) and refresh its CSRF token. */
function harness_login($user, ?string $email = null, ?string $userPassword = null): void
{
    global $cookies, $password;
    if (isset($cookies[$user])) @unlink($cookies[$user]);
    $cookies[$user] = tempnam(sys_get_temp_dir(), 'dm-cookie-');
    $login = api($user, 'auth/login.php', ['email' => $email ?? harness_email((int)$user), 'password' => $userPassword ?? $password]);
    if (!ok($login)) {
        throw new RuntimeException('Fixture login failed: ' . json_encode($login));
    }
    harness_refresh_csrf($user);
}

function harness_refresh_csrf($user): void
{
    global $tokens;
    $tokens[$user] = api($user, 'auth/get_csrf_token.php', null)['body']['csrf_token'] ?? '';
}

/** A cookie jar with no session, for anonymous or unauthenticated requests. */
function harness_guest(string $name = 'guest'): string
{
    global $cookies, $tokens;
    if (isset($cookies[$name])) @unlink($cookies[$name]);
    $cookies[$name] = tempnam(sys_get_temp_dir(), 'dm-cookie-');
    $tokens[$name] = '';
    return $name;
}

/** Run $callback when the suite exits, even if it throws. */
function harness_on_cleanup(callable $callback): void
{
    global $harness;
    $harness['cleanup'][] = $callback;
}

function harness_cleanup(): void
{
    global $harness, $conn, $cookies;
    foreach (array_reverse($harness['cleanup']) as $callback) {
        try { $callback(); } catch (Throwable $e) { fwrite(STDERR, 'cleanup: ' . $e->getMessage() . PHP_EOL); }
    }
    $harness['cleanup'] = [];
    if (is_resource($harness['server'])) {
        proc_terminate($harness['server']);
        proc_close($harness['server']);
    }
    if ($conn instanceof mysqli && $harness['database']) {
        $conn->query('DROP DATABASE `' . $harness['database'] . '`');
        $conn->close();
        $harness['database'] = null;
    }
    foreach ($cookies as $cookie) @unlink($cookie);
    if ($harness['log'] && getenv('HARNESS_KEEP_LOG')) {
        fwrite(STDERR, 'Server log kept at ' . $harness['log'] . PHP_EOL);
    } elseif ($harness['log']) {
        @unlink($harness['log']);
    }
}

/** Print the tally and exit nonzero on any failure. */
function harness_finish(): void
{
    global $checks, $failures;
    echo "$checks checks, $failures failures" . PHP_EOL;
    exit($failures > 0 ? 1 : 0);
}

// --- checks -----------------------------------------------------------------

function check(bool $condition, string $message): void
{
    global $failures, $checks;
    $checks++;
    if (!$condition) $failures++;
    echo ($condition ? 'PASS ' : 'FAIL ') . $message . PHP_EOL;
}

function ok(array $response): bool { return $response['status'] === 200; }
function rejected(array $response): bool { return in_array($response['status'], [400, 403, 404, 409], true); }

/** True when the response has exactly this status and error text. */
function error_is(array $response, int $status, string $error): bool
{
    return $response['status'] === $status && ($response['body']['error'] ?? null) === $error;
}

function row(string $sql): array
{
    global $conn;
    return $conn->query($sql)->fetch_assoc() ?: [];
}

// --- requests ---------------------------------------------------------------

/**
 * Send a request as $user. A null $body sends a GET; an array is POSTed as JSON
 * with the user's CSRF token added unless the body already sets one.
 *
 * @return array{status: int, body: mixed, headers: string}
 */
function api($user, string $path, ?array $body = [], array $headers = []): array
{
    global $tokens;
    $options = [CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers)];
    if ($body !== null) {
        $body += ['csrf_token' => $tokens[$user] ?? ''];
        $options += [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)];
    }
    return harness_request($user, $path, $options);
}

/** POST multipart form fields (use CURLFile for uploads) with the user's CSRF token. */
function api_multipart($user, string $path, array $fields): array
{
    global $tokens;
    $fields += ['csrf_token' => $tokens[$user] ?? ''];
    return harness_request($user, $path, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $fields]);
}

/** GET without JSON decoding, for media: returns status, content type and raw bytes too. */
function http_get($user, string $path, array $headers = []): array
{
    return harness_request($user, $path, [CURLOPT_HTTPHEADER => $headers]);
}

function harness_request($user, string $path, array $options): array
{
    global $base, $cookies;
    $ch = curl_init($base . '/api/' . $path);
    curl_setopt_array($ch, $options + [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_COOKIEFILE => $cookies[$user],
        CURLOPT_COOKIEJAR => $cookies[$user],
    ]);
    $raw = (string)curl_exec($ch);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $response = [
        'status' => curl_getinfo($ch, CURLINFO_HTTP_CODE),
        'type' => (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE),
        'headers' => substr($raw, 0, $headerSize),
        'raw' => substr($raw, $headerSize),
    ];
    curl_close($ch);
    $response['body'] = json_decode($response['raw'], true);
    return $response;
}
```

</details>

<details>
<summary>api/tests/xss_encoding_test.php</summary>

[Open source](../api/tests/xss_encoding_test.php)

```php
<?php
/**
 * XSS Encoding Test File
 * This file demonstrates safe output encoding for suspicious input
 */

// Include security headers and functions
require_once __DIR__ . '/../security/security.php';

require_local_or_cli_access();

// Set security headers
set_security_headers();

header('Content-Type: text/html; charset=utf-8');

// Test XSS-safe output encoding
$testInput = $_GET['test'] ?? 'No input provided';

echo "<!DOCTYPE html>
<html>
<head>
    <title>XSS Encoding Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .safe { color: green; }
        .warning { color: red; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>XSS Encoding Test</h1>

    <div class='info'>
        <h3>Input Rendered Safely:</h3>
        <p>Input: " . escape_html($testInput) . "</p>
    </div>

    <div class='info'>
        <h3>Sanitized String Helper:</h3>
        <p>Sanitized: " . sanitize_string($testInput) . "</p>
    </div>

    <div class='info'>
        <h3>HTML Escaped:</h3>
        <p>HTML Escaped: " . escape_html($testInput) . "</p>
    </div>

    <div class='info'>
        <h3>Security Headers Applied:</h3>
        <ul>
            <li>Content Security Policy (CSP)</li>
            <li>X-Content-Type-Options</li>
            <li>X-Frame-Options</li>
        </ul>
    </div>

    <div class='info'>
        <h3>Test XSS Attempts:</h3>
        <p>Try these URLs to confirm payloads are displayed as text, not executed:</p>
        <ul>
            <li><a href='?test=" . urlencode("<script>alert(\"XSS\")</script>") . "'>Script Tag Test</a></li>
            <li><a href='?test=" . urlencode("<img src=x onerror=alert(\"XSS\")>") . "'>Image XSS Test</a></li>
            <li><a href='?test=" . urlencode("<svg onload=alert(\"XSS\")>") . "'>SVG XSS Test</a></li>
            <li><a href='?test=" . urlencode("javascript:alert(\"XSS\")") . "'>JavaScript URL Test</a></li>
        </ul>
    </div>

    <div class='safe'>
        <h3>OK: XSS Encoding Status</h3>
        <p>Suspicious input is encoded before HTML output, and security headers are applied.</p>
    </div>
</body>
</html>";
?>
```

</details>

### HTTP integration and scenario checks (12 files)

<details>
<summary>api/tests/integration/expired_token.php</summary>

[Open source](../api/tests/integration/expired_token.php)

```php
<?php
/**
 * Integration test: reset_password rejects invalid/expired tokens.
 * API: auth/reset_password.php (expects JSON token + uid + newPassword, all required).
 *
 * reset_password.php checks field presence/shape (token must be 64 hex
 * chars, uid must be > 0) BEFORE it ever looks up the token, and returns the
 * same generic "Token, user ID, and new password are required" message for
 * that. Without a uid, every request used to fail there instead of reaching
 * the actual token-lookup — so this always reported a false PASS by luck
 * (that message doesn't contain "invalid"/"expired" either, so really it
 * would have quietly started failing the moment reset_password.php began
 * requiring uid). Defaults now include a syntactically valid token (64 hex
 * chars, just not one stored for anyone) and a uid, so the request reaches
 * real token-lookup logic and gets "Invalid or expired reset token" for the
 * right reason. Override token/uid via JSON to test a specific captured
 * token instead.
 *
 * Set API_TEST_BASE_URL if auto-detection fails (e.g. CLI).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$token = isset($input['token']) && is_string($input['token']) && $input['token'] !== ''
    ? trim($input['token'])
    : bin2hex(random_bytes(32));
$uid = isset($input['uid']) ? (int) $input['uid'] : 1;
// Policy-valid password so the server reaches token validation (not policy errors).
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'Valid1!a';

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
    'uid' => $uid,
    'newPassword' => $newPassword,
]);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$looksLikeInvalidToken = $error !== ''
    && (stripos($error, 'expired') !== false || stripos($error, 'invalid') !== false);

if ($looksLikeInvalidToken) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API rejected token: ' . $error,
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected invalid/expired token message from API',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
```

</details>

<details>
<summary>api/tests/integration/invalid_email_test.php</summary>

[Open source](../api/tests/integration/invalid_email_test.php)

```php
<?php
/**
 * Integration test: forgot_password does NOT reveal whether a UB-formatted
 * email is registered. forgot_password.php deliberately returns the same
 * generic accepted-response (PASSWORD_RESET_ACCEPTED_MESSAGE, HTTP 202) for
 * both known and unknown emails, plus a padded response time, specifically
 * to prevent user-enumeration attacks — so an unregistered email must get
 * the identical response shape a registered one would, not a distinguishing
 * "not found" style error.
 *
 * Set API_TEST_BASE_URL when not running under the web server (see bootstrap.php).
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email is required']);
    exit;
}

$email = (string) $input['email'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with($email, '@buffalo.edu')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email must be a valid UB email address']);
    exit;
}

$result = api_test_post_json('auth/forgot_password.php', ['email' => $email]);
$response = is_array($result['json']) ? $result['json'] : [];

function api_test_forgot_password_leaks_account_existence(string $error): bool
{
    if ($error === 'Email not found') {
        return true;
    }
    $lower = strtolower($error);
    return str_contains($lower, 'not found')
        || str_contains($lower, 'no account')
        || str_contains($lower, 'does not exist');
}

$err = isset($response['error']) ? (string) $response['error'] : '';
$leaksExistence = api_test_forgot_password_leaks_account_existence($err);

// The correct, secure behavior is the generic accepted response — identical
// to what a registered email gets — at HTTP 202.
$isGenericAccepted = $result['http_code'] === 202
    && !empty($response['success'])
    && $response['success'] === true;

if ($isGenericAccepted && !$leaksExistence) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API returned the same generic accepted response for an unregistered email (no user-enumeration leak)',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => $leaksExistence
        ? 'FAIL — SECURITY: API revealed that this email is not registered (user-enumeration leak): ' . $err
        : 'FAIL — expected the generic accepted response (HTTP 202, success:true) for an unregistered email',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
```

</details>

<details>
<summary>api/tests/integration/items_with_year.php</summary>

[Open source](../api/tests/integration/items_with_year.php)

```php
<?php
/**
 * Thin proxy to the canonical endpoint purchase_history/fetch_transacted_items.php.
 * POST JSON: { "year": 2024 } — same validation and response shape as production.
 *
 * fetch_transacted_items.php requires a logged-in session, which this proxy
 * does not inherit from its own caller (it makes a fresh outbound request).
 * Set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD or every call here just
 * relays a 401 "Not authenticated", not the endpoint's real behavior.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['year'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'JSON body must include year']);
    exit;
}

$session = api_test_login_session();
if ($session === null) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed — this endpoint requires a logged-in session.']);
    exit;
}

$year = (int) $input['year'];
$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year], $session['cookie_jar']);

$code = $result['http_code'] > 0 ? $result['http_code'] : 502;
http_response_code($code);
echo $result['raw'] !== ''
    ? $result['raw']
    : json_encode(['success' => false, 'error' => 'Empty response from fetch-transacted-items']);
```

</details>

<details>
<summary>api/tests/integration/multiple_purchased_items.php</summary>

[Open source](../api/tests/integration/multiple_purchased_items.php)

```php
<?php
/**
 * Data-dependent check: current calendar year should return at least two legacy rows.
 *
 * fetch_transacted_items.php requires a logged-in session, and the rows this
 * checks for belong to whichever account API_TEST_LOGIN_EMAIL logs in as —
 * set it to the seeded account those rows actually belong to, or this will
 * correctly report a data-dependent FAIL (0 rows) for an unrelated account.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$year = (int) date('Y');
$session = api_test_login_session();
if ($session === null) {
    echo json_encode([
        'success' => false,
        'test_result' => 'FAIL — API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed; this endpoint requires a logged-in session.',
    ]);
    exit;
}

$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year], $session['cookie_jar']);

$json = is_array($result['json']) ? $result['json'] : [];
$data = isset($json['data']) && is_array($json['data']) ? $json['data'] : [];
$n = count($data);
$apiOk = !empty($json['success']);
$pass = $apiOk && $n >= 2;

echo json_encode([
    'success' => $pass,
    'year_queried' => $year,
    'item_count' => $n,
    'test_result' => $pass
        ? 'PASS — at least two purchased items for current calendar year'
        : ($apiOk
            ? "FAIL — expected at least two rows for {$year}, got {$n} (data-dependent)"
            : 'FAIL — API did not return success'),
    'api_http_code' => $result['http_code'],
    'data' => $data,
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
```

</details>

<details>
<summary>api/tests/integration/new_reset_password_invalid.php</summary>

[Open source](../api/tests/integration/new_reset_password_invalid.php)

```php
<?php
/**
 * Integration test: reset_password rejects passwords that fail policy.
 * API: auth/reset_password.php (token + uid + newPassword, all required).
 *
 * reset_password.php validates fields in this order: token format (64 hex
 * chars) + uid (> 0) + newPassword non-empty, THEN password length, THEN
 * password policy, THEN whether the token actually matches a stored,
 * unexpired reset_token_hash for that uid. A fake token/uid pair like the
 * old version of this test used never gets past the first check, so it
 * always hit "Token, user ID, and new password are required" — which
 * contains the substring "password" and used to be accepted by a loose
 * fallback here, making this test pass no matter what the real password
 * policy check did. To actually exercise policy validation this test writes
 * a real, valid, unexpired reset token straight into the database for a
 * dedicated local test account (the same way forgot_password.php would),
 * then submits a deliberately weak password against it.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/database/db_connect.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

$email = isset($input['email']) && is_string($input['email']) && $input['email'] !== ''
    ? $input['email']
    : 'testuser@buffalo.edu';
$newPassword = isset($input['newPassword']) ? (string) $input['newPassword'] : 'weak';

$conn = db();

$stmt = $conn->prepare('SELECT user_id FROM user_accounts WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    echo json_encode([
        'success' => false,
        'test_result' => "FAIL — setup: no local account for {$email}. Pass {\"email\":\"...\"} for an account that exists in this environment.",
    ]);
    exit;
}

$uid = (int) $row['user_id'];
$token = bin2hex(random_bytes(32));
$hashedToken = password_hash($token, PASSWORD_BCRYPT);
$expiresAt = (new DateTime('+1 hour', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');

$stmt = $conn->prepare('UPDATE user_accounts SET reset_token_hash = ?, reset_token_expires = ? WHERE user_id = ?');
$stmt->bind_param('ssi', $hashedToken, $expiresAt, $uid);
$stmt->execute();
$stmt->close();

$result = api_test_post_json('auth/reset_password.php', [
    'token' => $token,
    'uid' => $uid,
    'newPassword' => $newPassword,
]);

// Whether the endpoint rejected or (unexpectedly) accepted the weak
// password, this test-only token must not be left valid afterward.
$stmt = $conn->prepare('UPDATE user_accounts SET reset_token_hash = NULL, reset_token_expires = NULL WHERE user_id = ? AND reset_token_hash = ?');
$stmt->bind_param('is', $uid, $hashedToken);
$stmt->execute();
$stmt->close();
$conn->close();

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$policyRejection = $result['http_code'] === 400
    && $error === 'Password does not meet policy requirements';

if ($policyRejection) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API returned policy error as expected, with a real valid token+uid so the check was genuinely reached',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected "Password does not meet policy requirements" (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
```

</details>

<details>
<summary>api/tests/integration/no_purchased_item.php</summary>

[Open source](../api/tests/integration/no_purchased_item.php)

```php
<?php
/**
 * Calls the canonical purchase_history endpoint for a future calendar year.
 * Expects an empty list (no transactions dated in that year).
 *
 * fetch_transacted_items.php requires a logged-in session — without it this
 * would get a 401 and mislabel "not authenticated" as "no purchases".
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$futureYear = (int) date('Y') + 1;
$session = api_test_login_session();
if ($session === null) {
    echo json_encode([
        'success' => false,
        'test_result' => 'FAIL — API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed; this endpoint requires a logged-in session.',
    ]);
    exit;
}

$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $futureYear], $session['cookie_jar']);

$json = is_array($result['json']) ? $result['json'] : [];
$data = $json['data'] ?? null;
$isEmptyList = is_array($data) && count($data) === 0;
$success = !empty($json['success']) && $isEmptyList;

echo json_encode([
    'success' => $success,
    'year_queried' => $futureYear,
    'test_result' => $success
        ? 'PASS — fetch-transacted-items returned success with empty data for future year'
        : 'FAIL — expected success with empty data[] for a year with no transactions',
    'api_http_code' => $result['http_code'],
    'data' => is_array($data) ? $data : [],
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
```

</details>

<details>
<summary>api/tests/integration/one_purchased_item.php</summary>

[Open source](../api/tests/integration/one_purchased_item.php)

```php
<?php
/**
 * Data-dependent check: current calendar year should return exactly one legacy purchased_items row.
 * PASS only when the API reports success and count(data) === 1.
 *
 * fetch_transacted_items.php requires a logged-in session, and the row this
 * checks for belongs to whichever account API_TEST_LOGIN_EMAIL logs in as —
 * set it to the seeded account that row actually belongs to.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$year = (int) date('Y');
$session = api_test_login_session();
if ($session === null) {
    echo json_encode([
        'success' => false,
        'test_result' => 'FAIL — API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed; this endpoint requires a logged-in session.',
    ]);
    exit;
}

$result = api_test_post_json('purchase_history/fetch_transacted_items.php', ['year' => $year], $session['cookie_jar']);

$json = is_array($result['json']) ? $result['json'] : [];
$data = isset($json['data']) && is_array($json['data']) ? $json['data'] : [];
$n = count($data);
$apiOk = !empty($json['success']);
$pass = $apiOk && $n === 1;

echo json_encode([
    'success' => $pass,
    'year_queried' => $year,
    'item_count' => $n,
    'test_result' => $pass
        ? 'PASS — exactly one purchased item for current calendar year'
        : ($apiOk
            ? "FAIL — expected exactly one row for {$year}, got {$n} (data-dependent)"
            : 'FAIL — API did not return success'),
    'api_http_code' => $result['http_code'],
    'data' => $data,
    'api_response' => $json,
], JSON_UNESCAPED_UNICODE);
```

</details>

<details>
<summary>api/tests/integration/reset_password_missing_fields.php</summary>

[Open source](../api/tests/integration/reset_password_missing_fields.php)

```php
<?php
/**
 * Replaces the old "passwords do not match" test: this API has a single newPassword field.
 * Integration test: missing token, uid, or newPassword returns 400 from reset_password.php.
 *
 * reset_password.php now also requires uid (added after this test was
 * written), and its message changed to name all three fields — the old
 * exact-match assertion here ("Token and new password are required") no
 * longer matches, which would silently report FAIL on a correctly-behaving
 * endpoint forever.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    $input = [];
}

// Default case: empty body → API should require all three fields
$postBody = $input;
if ($postBody === []) {
    $postBody = ['token' => '', 'uid' => '', 'newPassword' => ''];
}

$result = api_test_post_json('auth/reset_password.php', $postBody);

$response = is_array($result['json']) ? $result['json'] : [];
$error = isset($response['error']) ? (string) $response['error'] : '';

$missingFields = $result['http_code'] === 400
    && $error === 'Token, user ID, and new password are required';

if ($missingFields) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — API requires token, uid, and newPassword',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected "Token, user ID, and new password are required" (HTTP 400)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
```

</details>

<details>
<summary>api/tests/integration/test_rate_limit_login.sh</summary>

[Open source](../api/tests/integration/test_rate_limit_login.sh)

```bash
#!/bin/bash

# Rate Limiting Test Script
# Tests that 5 failed login attempts trigger a 5-minute lockout
# and that attempt 6+ are blocked with 429 status

echo "=== Rate Limiting Test ==="
API_BASE="${API_TEST_BASE_URL:-${API_BASE_URL:-http://localhost:8080/api}}"

# Clean up any previous cookies
rm -f cookies.txt

# Attempt 1: Initial login attempt to get a session cookie
echo -e "\nAttempt 1"
curl -X POST "${API_BASE%/}/auth/login.php" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@buffalo.edu","password":"wrongpassword"}' \
  -c cookies.txt \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

# Attempts 2-6 using the same session cookie
for i in {2..6}; do 
  echo -e "\nAttempt $i"
  curl -X POST "${API_BASE%/}/auth/login.php" \
    -H "Content-Type: application/json" \
    -b cookies.txt \
    -c cookies.txt \
    -d '{"email":"test@buffalo.edu","password":"wrongpassword"}' \
    -w "\nHTTP Status: %{http_code}\n" \
    -s
  sleep 1 # Small delay to simulate user input
done

echo -e "\n=== Test Complete ==="
echo "Expected: Attempts 1-4 return 401, Attempt 5+ return 429"
echo "Cleaning up..."
rm -f cookies.txt
echo "Done!"
```

</details>

<details>
<summary>api/tests/integration/test_sql_injection.php</summary>

[Open source](../api/tests/integration/test_sql_injection.php)

```php
<?php
/**
 * SQL Injection Test Script
 * Tests various endpoints for SQL injection vulnerabilities.
 *
 * Every endpoint below requires a logged-in session except Login itself. Set
 * API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD to a real account before running
 * this script, or the auth-gated checks are skipped (and reported as skipped,
 * not silently counted as passing) instead of just recording an unauthenticated
 * 401 as a false "PASS".
 *
 * Usage: Run this script from command line or via web browser.
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/security/security.php';
set_security_headers();

header('Content-Type: text/html; charset=utf-8');

$session = api_test_login_session();

// Test payloads for SQL injection
$sqlPayloads = [
    "' OR '1'='1",
    "' OR '1'='1'--",
    "'; DROP TABLE users--",
    "' UNION SELECT NULL--",
    "' UNION SELECT password FROM users--",
    "1' OR '1'='1",
    "1' OR 1=1--",
    "admin'--",
    "' OR 1=1#",
    "') OR ('1'='1",
    "1' OR '1'='1' /*",
    "1' OR '1'='1' --",
    "1' OR '1'='1' #",
    "1' OR '1'='1' UNION SELECT NULL--",
    "1' OR '1'='1' UNION SELECT password FROM users--",
];

// Test endpoints. 'encoding' controls how the payload is sent: product_listing.php
// only accepts multipart/form-data (it rejects JSON with 415 before it ever looks
// at the fields), so a JSON-encoded request against it "passes" for a reason that
// has nothing to do with SQL injection.
$testEndpoints = [
    [
        'name' => 'Login',
        'url' => '/auth/login.php',
        'data' => ['email' => 'test@buffalo.edu', 'password' => 'test123'],
        'field' => 'email',
        'encoding' => 'json',
        'requires_auth' => false,
    ],
    [
        'name' => 'Search',
        'url' => '/search/get_search_items.php',
        'data' => ['q' => '', 'category' => ''],
        'field' => 'q',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Product Listing (Title)',
        'url' => '/seller_dashboard/product_listing.php',
        'data' => ['mode' => 'create', 'title' => '', 'description' => 'Test', 'price' => '10'],
        'field' => 'title',
        'encoding' => 'multipart',
        'requires_auth' => true,
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>SQL Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .skip { color: #a66a00; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>SQL Injection Test Results</h1>
    <p class='info'>This script tests endpoints for SQL injection vulnerabilities. All endpoints should reject SQL injection attempts.</p>
    <p class='info'><strong>Note:</strong> A &quot;PASS&quot; here only means the response looked like a validation or error outcome (e.g. HTTP 4xx, or JSON error flags). This is heuristic — not a substitute for code review or prepared statements.</p>";

if ($session === null) {
    echo "<p class='info'><strong>Unauthenticated:</strong> API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed. Auth-gated endpoints below are skipped rather than credited with a false PASS.</p>";
}

$baseUrl = api_test_api_base_url();

$totalTests = 0;
$passedTests = 0;
$skippedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";

    if ($endpoint['requires_auth'] && $session === null) {
        $skippedTests += count($sqlPayloads);
        echo "<p><span class='skip'>SKIPPED</span> requires a logged-in session — set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD.</p>";
        echo "</div>";
        continue;
    }

    foreach ($sqlPayloads as $payload) {
        $totalTests++;
        $testData = $endpoint['data'];
        $testData[$endpoint['field']] = $payload;

        if ($endpoint['requires_auth'] && $session !== null) {
            $testData['csrf_token'] = $session['csrf_token'];
        }

        $ch = curl_init($baseUrl . $endpoint['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);

        if ($endpoint['encoding'] === 'multipart') {
            // An associative array makes cURL send real multipart/form-data,
            // matching what the browser sends — a JSON string would be
            // rejected with 415 before any field is validated.
            curl_setopt($ch, CURLOPT_POSTFIELDS, $testData);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($testData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        if ($endpoint['requires_auth'] && $session !== null) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $session['cookie_jar']);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $session['cookie_jar']);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $result = json_decode($response, true);

        // A 5xx means the query itself broke — the actual signature of an
        // unescaped/unparameterized query being derailed by the payload — so
        // it can never count as safe, regardless of body shape.
        //
        // A 4xx, or a body that explicitly says ok:false / success:false /
        // an "invalid ..." error, is a clean rejection.
        //
        // Endpoints that succeed with a bare array (e.g. search results) or
        // any other shape with no ok/success key at all are judged safe too:
        // there is no bypass signal to find. The only way a 2xx counts as
        // unsafe here is an *explicit* ok:true / success:true — i.e. the
        // endpoint treated the payload as a normal, accepted value when it
        // should have been rejected on its own terms (missing fields,
        // invalid category, etc).
        if ($httpCode >= 500) {
            $isSafe = false;
        } elseif ($httpCode >= 400) {
            $isSafe = true;
        } elseif (is_array($result)) {
            if ((isset($result['ok']) && $result['ok'] === false) ||
                (isset($result['success']) && $result['success'] === false) ||
                (isset($result['error']) && stripos((string) $result['error'], 'invalid') !== false)) {
                $isSafe = true;
            } elseif ((isset($result['ok']) && $result['ok'] === true) ||
                (isset($result['success']) && $result['success'] === true)) {
                $isSafe = false;
            } else {
                // No ok/success key either way (e.g. search's bare results
                // array) — a well-formed 2xx body with no bypass signal.
                $isSafe = true;
            }
        } else {
            // 2xx but not valid JSON — unexpected shape, don't call it safe.
            $isSafe = false;
        }

        if ($isSafe) {
            $passedTests++;
        }

        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} Payload: <code>" . escape_html($payload) . "</code></p>";

        if (!$isSafe) {
            echo "<pre>Response: " . escape_html($response) . "</pre>";
        }
    }

    echo "</div>";
}

$passRate = $totalTests > 0 ? round(($passedTests / $totalTests) * 100, 2) : 0;

echo "<div class='test-section'>";
echo "<h2>Summary</h2>";
echo "<p>Total Tests Run: {$totalTests}</p>";
echo "<p>Skipped (no authenticated session): {$skippedTests}</p>";
echo "<p>Passed: <span class='pass'>{$passedTests}</span></p>";
echo "<p>Failed: <span class='fail'>" . ($totalTests - $passedTests) . "</span></p>";
echo "<p>Pass Rate: {$passRate}%</p>";
echo "</div>";

echo "</body>
</html>";
```

</details>

<details>
<summary>api/tests/integration/test_xss_injection.php</summary>

[Open source](../api/tests/integration/test_xss_injection.php)

```php
<?php
/**
 * XSS Injection Test Script
 * Tests endpoint responses for unsafe XSS reflection.
 *
 * Every endpoint below requires a logged-in session. Set API_TEST_LOGIN_EMAIL /
 * API_TEST_LOGIN_PASSWORD to a real account before running this script, or every
 * check is skipped (and reported as skipped) instead of recording an
 * unauthenticated 401 as a false "PASS" that never touched the field it claims
 * to test.
 *
 * Usage: Run this script from command line or via web browser
 */

require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__, 2) . '/security/security.php';
set_security_headers();

header('Content-Type: text/html; charset=utf-8');

$session = api_test_login_session();

// Test payloads for XSS
$xssPayloads = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert('XSS')>",
    "<svg onload=alert('XSS')>",
    "javascript:alert('XSS')",
    "<iframe src=javascript:alert('XSS')>",
    "<body onload=alert('XSS')>",
    "<input onfocus=alert('XSS') autofocus>",
    "<select onfocus=alert('XSS') autofocus>",
    "<textarea onfocus=alert('XSS') autofocus>",
    "<keygen onfocus=alert('XSS') autofocus>",
    "<video><source onerror=alert('XSS')>",
    "<audio src=x onerror=alert('XSS')>",
    "<details open ontoggle=alert('XSS')>",
    "<marquee onstart=alert('XSS')>",
    "<div onmouseover=alert('XSS')>",
    "<style>@import'javascript:alert(\"XSS\")';</style>",
    "<link rel=stylesheet href=javascript:alert('XSS')>",
    "<meta http-equiv=refresh content=0;url=javascript:alert('XSS')>",
    "<object data=javascript:alert('XSS')>",
    "<embed src=javascript:alert('XSS')>",
];

// Test endpoints. 'encoding' controls how the payload is sent: product_listing.php
// only accepts multipart/form-data (it rejects JSON with HTTP 415 before it ever
// looks at title/description), so sending JSON against it "passes" for a reason
// that has nothing to do with XSS handling. Every endpoint here also requires a
// logged-in session ('requires_auth'), so without real credentials the request
// never reaches the field being tested either.
$testEndpoints = [
    [
        'name' => 'Create Message',
        'url' => '/chat/create_message.php',
        'data' => ['receiver_id' => '1', 'content' => '', 'conv_id' => null],
        'field' => 'content',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Submit Review',
        'url' => '/reviews/submit_review.php',
        'data' => ['product_id' => 1, 'rating' => 5, 'product_rating' => 5, 'review_text' => ''],
        'field' => 'review_text',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Product Listing (Title)',
        'url' => '/seller_dashboard/product_listing.php',
        'data' => ['mode' => 'create', 'title' => '', 'description' => 'Test', 'price' => '10'],
        'field' => 'title',
        'encoding' => 'multipart',
        'requires_auth' => true,
    ],
    [
        'name' => 'Product Listing (Description)',
        'url' => '/seller_dashboard/product_listing.php',
        'data' => ['mode' => 'create', 'title' => 'Test', 'description' => '', 'price' => '10'],
        'field' => 'description',
        'encoding' => 'multipart',
        'requires_auth' => true,
    ],
    [
        'name' => 'Update Profile (Bio)',
        'url' => '/profile/update_profile.php',
        'data' => ['bio' => ''],
        'field' => 'bio',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
    [
        'name' => 'Search Query',
        'url' => '/search/get_search_items.php',
        'data' => ['q' => ''],
        'field' => 'q',
        'encoding' => 'json',
        'requires_auth' => true,
    ],
];

echo "<!DOCTYPE html>
<html>
<head>
    <title>XSS Injection Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .test-section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
        .pass { color: green; font-weight: bold; }
        .fail { color: red; font-weight: bold; }
        .skip { color: #a66a00; font-weight: bold; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
        .payload { font-family: monospace; background: #f9f9f9; padding: 2px 5px; }
    </style>
</head>
<body>
    <h1>XSS Injection Test Results</h1>
    <p class='info'>This script checks that XSS-looking payloads are not reflected as executable HTML. Endpoints may reject payloads or accept them as plain text.</p>
    <p class='info'><strong>Note:</strong> JSON responses may contain user text safely. Stored XSS still depends on escaped rendering in the React app.</p>";

if ($session === null) {
    echo "<p class='info'><strong>Unauthenticated:</strong> API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD are unset or login failed. Every endpoint below requires login, so all checks are skipped rather than credited with a false PASS.</p>";
}

$baseUrl = api_test_api_base_url();

$totalTests = 0;
$passedTests = 0;
$skippedTests = 0;

foreach ($testEndpoints as $endpoint) {
    echo "<div class='test-section'>";
    echo "<h2>{$endpoint['name']} ({$endpoint['field']})</h2>";

    if ($endpoint['requires_auth'] && $session === null) {
        $skippedTests += count($xssPayloads);
        echo "<p><span class='skip'>SKIPPED</span> requires a logged-in session — set API_TEST_LOGIN_EMAIL / API_TEST_LOGIN_PASSWORD.</p>";
        echo "</div>";
        continue;
    }

    foreach ($xssPayloads as $payload) {
        $totalTests++;
        $testData = $endpoint['data'];
        $testData[$endpoint['field']] = $payload;

        if ($endpoint['requires_auth'] && $session !== null) {
            $testData['csrf_token'] = $session['csrf_token'];
        }

        $ch = curl_init($baseUrl . $endpoint['url']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);

        if ($endpoint['encoding'] === 'multipart') {
            // An associative array makes cURL send real multipart/form-data,
            // matching what the browser sends — a JSON string would be
            // rejected with 415 before any field is validated.
            curl_setopt($ch, CURLOPT_POSTFIELDS, $testData);
        } else {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($testData));
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        if ($endpoint['requires_auth'] && $session !== null) {
            curl_setopt($ch, CURLOPT_COOKIEJAR, $session['cookie_jar']);
            curl_setopt($ch, CURLOPT_COOKIEFILE, $session['cookie_jar']);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE) ?: '';
        $curlError = curl_error($ch);
        curl_close($ch);

        $responseBody = is_string($response) ? $response : '';
        $result = json_decode($responseBody, true);
        $isRejected = $httpCode >= 400 ||
            (isset($result['ok']) && $result['ok'] === false) ||
            (isset($result['success']) && $result['success'] === false);
        $isHtmlResponse = stripos($contentType, 'text/html') !== false;
        $unsafeReflection = $isHtmlResponse && $responseBody !== '' && strpos($responseBody, $payload) !== false;
        $isSafe = $response !== false && ($isRejected || !$unsafeReflection);

        if ($isSafe) {
            $passedTests++;
        }

        if ($response === false) {
            $reason = 'curl error';
        } elseif ($isRejected) {
            $reason = 'rejected by endpoint';
        } elseif ($unsafeReflection) {
            $reason = 'unsafe raw HTML reflection';
        } else {
            $reason = 'no unsafe HTML reflection';
        }

        $status = $isSafe ? "<span class='pass'>PASS</span>" : "<span class='fail'>FAIL</span>";
        echo "<p>{$status} " . escape_html($reason) . " - Payload: <span class='payload'>" . escape_html($payload) . "</span></p>";

        if (!$isSafe) {
            $detail = $response === false ? $curlError : substr($responseBody, 0, 500);
            echo "<pre>Response: " . escape_html($detail) . "</pre>";
        }
    }

    echo "</div>";
}

$passRate = $totalTests > 0 ? round(($passedTests / $totalTests) * 100, 2) : 0;

echo "<div class='test-section'>";
echo "<h2>Summary</h2>";
echo "<p>Total Tests Run: {$totalTests}</p>";
echo "<p>Skipped (no authenticated session): {$skippedTests}</p>";
echo "<p>Passed: <span class='pass'>{$passedTests}</span></p>";
echo "<p>Failed: <span class='fail'>" . ($totalTests - $passedTests) . "</span></p>";
echo "<p>Pass Rate: {$passRate}%</p>";
echo "<p class='info'><strong>Note:</strong> Accepted payloads are okay when rendered as text/JSON and escaped in any HTML context.</p>";
echo "</div>";

echo "</body>
</html>";
```

</details>

<details>
<summary>api/tests/integration/valid_email_test.php</summary>

[Open source](../api/tests/integration/valid_email_test.php)

```php
<?php
/**
 * Integration test: forgot_password accepts a real UB email and returns success when mail can be sent.
 *
 * Environment:
 *   - Set API_TEST_BASE_URL to your api root if needed (e.g. http://localhost/f25-no-brainers/dorm-mart/api).
 *   - Repeated runs may hit rate limiting (see forgot_password.php); that is not a validation failure.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require_once dirname(__DIR__) . '/bootstrap.php';

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input) || !isset($input['email'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email is required']);
    exit;
}

$email = (string) $input['email'];

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with($email, '@buffalo.edu')) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Email must be a valid UB email address']);
    exit;
}

$result = api_test_post_json('auth/forgot_password.php', ['email' => $email]);
$response = is_array($result['json']) ? $result['json'] : [];
$err = isset($response['error']) ? (string) $response['error'] : '';

if (!empty($response['success']) && $response['success'] === true) {
    http_response_code(200);
    echo json_encode([
        'success' => true,
        'test_result' => 'PASS — forgot_password returned success',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

$rateLimited = $err !== '' && (stripos($err, 'wait') !== false || stripos($err, 'minute') !== false);
if ($rateLimited) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'inconclusive' => true,
        'test_result' => 'INCONCLUSIVE — rate limited; wait and retry (not an email-validation failure)',
        'api_http_code' => $result['http_code'],
        'api_response' => $response,
    ]);
    exit;
}

http_response_code(200);
echo json_encode([
    'success' => false,
    'test_result' => 'FAIL — expected success from forgot_password (check mail config)',
    'api_http_code' => $result['http_code'],
    'api_response' => $response,
    'api_raw' => $result['raw'],
]);
```

</details>

