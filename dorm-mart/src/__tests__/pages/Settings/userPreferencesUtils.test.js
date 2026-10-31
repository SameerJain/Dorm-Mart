import { preferenceChanges } from "../../../pages/Settings/userPreferencesUtils";

describe("preferenceChanges", () => {
  const saved = {
    promoFrequency: "weekly",
    interests: ["Books", "Electronics"],
  };

  it("returns null when nothing changed", () => {
    expect(preferenceChanges(saved, { ...saved, interests: ["Books", "Electronics"] })).toBeNull();
  });

  it("sends the page's fields once any of them changed", () => {
    expect(preferenceChanges(saved, { ...saved, promoFrequency: "daily" })).toEqual({
      promoFrequency: "daily",
      promoEmails: true,
      interests: ["Books", "Electronics"],
    });
  });

  it("sends a change to interests alone, including a reorder", () => {
    expect(preferenceChanges(saved, { ...saved, interests: ["Books"] })).toMatchObject({
      interests: ["Books"],
    });
    expect(
      preferenceChanges(saved, { ...saved, interests: ["Electronics", "Books"] }),
    ).toMatchObject({ interests: ["Electronics", "Books"] });
    // Same length and first item, different second item.
    expect(
      preferenceChanges(saved, { ...saved, interests: ["Books", "Furniture"] }),
    ).toMatchObject({ interests: ["Books", "Furniture"] });
  });

  it("never includes theme, which the theme hook saves on its own", () => {
    const changes = preferenceChanges(saved, { ...saved, promoFrequency: "off", theme: "dark" });
    expect(changes).not.toHaveProperty("theme");
    expect(changes).toMatchObject({ promoFrequency: "off", promoEmails: false });
  });

  it("returns null before preferences have loaded", () => {
    expect(preferenceChanges(null, saved)).toBeNull();
  });
});
