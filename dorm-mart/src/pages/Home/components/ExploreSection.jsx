import ItemCardNew from "../../../components/ItemCardNew";

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

      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(210px,1fr))] overflow-x-hidden min-w-0">
        {items.map((item, index) => (
          <ItemCardNew
            key={item.id ?? index}
            id={item.id}
            title={item.title}
            price={item.price}
            tags={item.tags}
            image={item.img || undefined}
            status={item.status}
            seller={item.seller}
            sellerUsername={item.sellerUsername}
            sellerEmail={item.sellerEmail}
            isWishlisted={wishlistedIds.has(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
