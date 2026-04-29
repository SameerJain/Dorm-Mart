export const MAX_LISTING_PRICE = 9999.99;

const MEME_PRICE_SEQUENCES = [
  "666",
  "67",
  "420",
  "69",
  "80085",
  "8008",
  "5318008",
  "1488",
  "42069",
  "6969",
  "42042",
  "66666",
];

export function containsMemePrice(priceString, { digitsOnly = true } = {}) {
  if (!priceString) return false;
  const value = digitsOnly
    ? String(priceString).replace(/[^\d]/g, "")
    : String(priceString);
  if (!value) return false;
  return MEME_PRICE_SEQUENCES.some((sequence) => value.includes(sequence));
}
