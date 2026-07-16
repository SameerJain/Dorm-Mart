import { normalizeProductDetail } from "../utils/productDetails";

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
