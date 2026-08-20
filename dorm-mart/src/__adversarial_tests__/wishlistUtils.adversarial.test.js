import {
  filterWishlistItems,
  getWishlistCategories,
  normalizeWishlistItems,
  selectedCategoryAfterRemoval,
} from "../pages/Wishlist/utils/wishlistUtils";

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
