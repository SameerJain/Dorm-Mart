import ItemCardNew from "../../../components/ItemCardNew";

export default function ForYouSection({
  hasPersonalization,
  items,
  navigate,
  wishlistedIds,
}) {
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
            For you
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {hasPersonalization
              ? "Ranked from what you view, save, buy, and select as interests."
              : "Popular and recently listed items while we learn what you like."}
          </p>
        </div>
        <button
          onClick={() => navigate("/app/setting/user-preferences")}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Manage interests
        </button>
      </header>

      {items.length ? (
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
      ) : (
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No active listings are available yet.
        </p>
      )}
    </section>
  );
}
