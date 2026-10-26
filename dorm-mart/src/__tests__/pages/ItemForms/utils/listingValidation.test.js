import { validateDraft, validateListing } from "../../../../pages/ItemForms/utils/listingValidation";

test("allows saving a draft without photos", () => {
  expect(validateDraft({ title: "Desk", price: "", images: [] })).toEqual({});
});

test("still requires a photo when publishing", () => {
  expect(validateListing({
    title: "Desk",
    description: "Wooden desk",
    price: "20",
    categories: ["Furniture"],
    itemLocation: "Campus",
    condition: "Good",
    images: [],
  }).images).toMatch(/At least one photo is required/);
});
