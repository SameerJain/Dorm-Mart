import { coerceBoolean } from "../../../utils/formatters";
import { containsMemePrice, MAX_LISTING_PRICE } from "../../../utils/priceValidation";
import { MEET_LOCATION_OTHER_VALUE } from "../../../constants/meetLocations";

export function normalizeScheduleListing(listing) {
  if (!listing) return null;
  return {
    ...listing,
    priceNegotiable:
      coerceBoolean(listing.priceNegotiable ?? listing.price_nego) === true,
    acceptTrades: coerceBoolean(listing.acceptTrades ?? listing.trades) === true,
    meet_location: listing.meet_location || null,
  };
}

export function resolveMeetLocation(meetLocationChoice, customMeetLocation) {
  const trimmedCustomLocation = customMeetLocation.trim();
  return meetLocationChoice === MEET_LOCATION_OTHER_VALUE
    ? trimmedCustomLocation
    : meetLocationChoice;
}

export function validateNegotiatedPrice(
  negotiatedPrice,
  { isTrade = false, max = MAX_LISTING_PRICE } = {},
) {
  const trimmed = negotiatedPrice.trim();
  if (!trimmed) return { value: null, error: "" };
  if (isTrade) {
    return {
      value: null,
      error:
        "Cannot enter a price for a trade. Please clear the price field or uncheck the trade option.",
    };
  }

  const value = parseFloat(trimmed);
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return { value: null, error: "Please enter a valid price." };
  }
  if (containsMemePrice(negotiatedPrice, { digitsOnly: false })) {
    return {
      value: null,
      error: "The price has a meme input in it. Please try a different price.",
    };
  }
  if (value < 0) return { value: null, error: "Price cannot be negative." };
  if (value > max) {
    return { value: null, error: `Price must be $${max.toFixed(2)} or less` };
  }
  return { value, error: "" };
}
