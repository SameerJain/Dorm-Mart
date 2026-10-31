import ListingGrid from "./ListingGrid";

export default function ExploreSection({ isLoading = false, items, wishlistedIds }) {
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
          Explore more
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Randomized picks from across campus.
        </p>
      </header>

      {items.length ? (
        <ListingGrid items={items} wishlistedIds={wishlistedIds} />
      ) : isLoading ? null : (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No active listings are available yet.
        </p>
      )}
    </section>
  );
}
