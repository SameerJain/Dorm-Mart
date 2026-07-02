import {
  FALLBACK_IMAGE_URL,
  resolveProductPhotoUrl,
  resolveProductPhotoUrls,
  withFallbackImage,
} from "../utils/imageFallback";

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
});
