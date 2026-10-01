/**
 * Pure helpers for the User Preferences page.
 */

/** Blank, or a 10-digit US number (an optional leading 1 is allowed). */
export function isValidContactPhone(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return true;
  if (!/^[0-9+().\-\s]{1,25}$/.test(text)) return false;
  const digits = text.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
}

function sameList(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((item, index) => item === b[index])
  );
}

/**
 * Build the POST body for the fields this page owns, or null when none of them
 * differ from the last saved values.
 *
 * Theme is never included: the theme hook saves it on its own, and the endpoint
 * only writes the keys it receives. A phone number that is still invalid
 * (mid-typing) is left out, so it neither blocks nor fails the other fields.
 */
export function preferenceChanges(saved, current) {
  if (!saved || !current) return null;

  const phoneChanged =
    current.contactPhone !== saved.contactPhone &&
    isValidContactPhone(current.contactPhone);
  const changed =
    current.promoFrequency !== saved.promoFrequency ||
    current.revealContact !== saved.revealContact ||
    phoneChanged ||
    !sameList(current.interests, saved.interests);
  if (!changed) return null;

  const body = {
    promoFrequency: current.promoFrequency,
    promoEmails: current.promoFrequency !== "off",
    revealContact: current.revealContact,
    interests: current.interests,
  };
  if (isValidContactPhone(current.contactPhone)) {
    body.contactPhone = current.contactPhone.trim();
  }
  return body;
}
