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
