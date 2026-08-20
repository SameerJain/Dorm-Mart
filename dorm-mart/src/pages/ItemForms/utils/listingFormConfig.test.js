import {
  hasListingPhoto,
  isAllowedListingMedia,
  isListingVideo,
  LIMITS,
} from "./listingFormConfig";

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
