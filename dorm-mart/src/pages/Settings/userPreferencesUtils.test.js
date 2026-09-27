import { isValidContactPhone, preferenceChanges } from "./userPreferencesUtils";

describe("isValidContactPhone", () => {
  it.each(["", "   ", "7165551234", "(716) 555-1234", "+1 716 555 1234", "1-716-555-1234"])(
    "accepts %p",
    (value) => {
      expect(isValidContactPhone(value)).toBe(true);
    },
  );

  it.each(["1", "+", "((((1", "716555123", "2716555123 4", "716-555-12345", "call me"])(
    "rejects %p",
    (value) => {
      expect(isValidContactPhone(value)).toBe(false);
    },
  );
});

describe("preferenceChanges", () => {
  const saved = {
    promoFrequency: "weekly",
    revealContact: true,
    contactPhone: "(716) 555-1234",
    interests: ["Books", "Electronics"],
  };

  it("returns null when nothing changed", () => {
    expect(preferenceChanges(saved, { ...saved, interests: ["Books", "Electronics"] })).toBeNull();
  });

  it("sends the page's fields once any of them changed", () => {
    expect(preferenceChanges(saved, { ...saved, revealContact: false })).toEqual({
      promoFrequency: "weekly",
      promoEmails: true,
      revealContact: false,
      contactPhone: "(716) 555-1234",
      interests: ["Books", "Electronics"],
    });
  });

  it("never includes theme, which the theme hook saves on its own", () => {
    const changes = preferenceChanges(saved, { ...saved, promoFrequency: "off", theme: "dark" });
    expect(changes).not.toHaveProperty("theme");
    expect(changes).toMatchObject({ promoFrequency: "off", promoEmails: false });
  });

  it("holds back a half-typed phone number instead of sending it", () => {
    expect(preferenceChanges(saved, { ...saved, contactPhone: "716 55" })).toBeNull();
    const changes = preferenceChanges(saved, {
      ...saved,
      contactPhone: "716 55",
      revealContact: false,
    });
    expect(changes).toMatchObject({ revealContact: false });
    expect(changes).not.toHaveProperty("contactPhone");
  });

  it("sends a cleared phone number", () => {
    expect(preferenceChanges(saved, { ...saved, contactPhone: "" })).toMatchObject({
      contactPhone: "",
    });
  });

  it("returns null before preferences have loaded", () => {
    expect(preferenceChanges(null, saved)).toBeNull();
  });
});
