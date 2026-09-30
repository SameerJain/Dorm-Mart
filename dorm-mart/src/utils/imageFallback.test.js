import {
  FALLBACK_IMAGE_URL,
  isVideoMediaUrl,
  onProductImageError,
  resolveProductPhotoUrl,
  resolveProductPhotoUrls,
  resolveStoredImageUrl,
  withFallbackImage,
} from "./imageFallback";

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
