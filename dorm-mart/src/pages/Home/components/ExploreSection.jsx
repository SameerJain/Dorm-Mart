import ListingGrid from "./ListingGrid";

export default function ExploreSection({ items, wishlistedIds }) {
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
          Explore more
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Randomized picks from across campus.
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Showing at least 30 items so you can browse deeper.
        </p>
      </header>

      <ListingGrid items={items} wishlistedIds={wishlistedIds} />
    </section>
  );
}
