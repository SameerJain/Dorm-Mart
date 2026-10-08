/**
 * Pure helpers for the User Preferences page.
 */

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
 * only writes the keys it receives.
 */
export function preferenceChanges(saved, current) {
  if (!saved || !current) return null;

  const changed =
    current.promoFrequency !== saved.promoFrequency ||
    !sameList(current.interests, saved.interests);
  if (!changed) return null;

  return {
    promoFrequency: current.promoFrequency,
    promoEmails: current.promoFrequency !== "off",
    interests: current.interests,
  };
}
