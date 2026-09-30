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
} from "./listingFormConfig";
import { MAX_LISTING_PRICE } from "../../../utils/priceValidation";

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
