import { containsMemePrice } from "../../../utils/priceValidation";
import {
  CATEGORIES_MAX,
  LIMITS,
  hasListingPhoto,
} from "./listingFormConfig";

export const DRAFT_PHOTO_ERROR =
  "At least one photo is required. Videos are optional and count toward the 6-media limit.";

export function validateTitle(title) {
  if (!title.trim()) return "Title is required";
  if (title.length > LIMITS.title)
    return `Title must be ${LIMITS.title} characters or fewer`;
  return null;
}

/** Price error message, or null when valid. Drafts allow an empty price. */
export function validatePrice(price, { required = true } = {}) {
  if (price === "") return required ? "Price is required" : null;
  if (containsMemePrice(price))
    return "The price has a meme input in it. Please try a different price.";
  if (!Number.isFinite(Number(price))) return "Please enter a valid price";
  if (Number(price) < LIMITS.priceMin)
    return `Minimum price is $${LIMITS.priceMin.toFixed(2)}`;
  if (Number(price) > LIMITS.price)
    return `Price must be $${LIMITS.price} or less`;
  return null;
}

function assignIfError(errors, key, message) {
  if (message) errors[key] = message;
}

/** Full publish validation. Returns an errors object (empty = valid). */
export function validateListing({
  title,
  description,
  price,
  categories,
  itemLocation,
  condition,
  images,
}) {
  const errors = {};

  assignIfError(errors, "title", validateTitle(title));

  if (!description.trim()) {
    errors.description = "Description is required";
  } else if (description.length > LIMITS.description) {
    errors.description = `Description must be ${LIMITS.description} characters or fewer`;
  }

  assignIfError(errors, "price", validatePrice(price));

  if (!categories || categories.length === 0) {
    errors.categories = "Select at least one category";
  } else if (categories.length > CATEGORIES_MAX) {
    errors.categories = `Select at most ${CATEGORIES_MAX} categories`;
  }

  if (!itemLocation) errors.itemLocation = "Select an item location";
  if (!condition || condition === "") errors.condition = "Select an item condition";
  if (!hasListingPhoto(images)) errors.images = DRAFT_PHOTO_ERROR;

  return errors;
}

/** Draft validation: photo + title always, price only when non-empty. */
export function validateDraft({ title, price, images }) {
  const errors = {};
  if (!hasListingPhoto(images)) errors.images = DRAFT_PHOTO_ERROR;
  assignIfError(errors, "title", validateTitle(title));
  assignIfError(errors, "price", validatePrice(price, { required: false }));
  return errors;
}
