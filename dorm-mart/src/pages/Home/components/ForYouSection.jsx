import ItemCardNew from "../../../components/ItemCardNew";

export default function ForYouSection({
  interests,
  itemsByInterest,
  navigate,
  wishlistedIds,
}) {
  if (!interests.length) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 p-4">
        <p className="text-sm text-gray-700 dark:text-gray-200 mb-2">
          Add interested categories to see your personalized feed.
        </p>
        <button
          onClick={() => navigate("/app/setting/user-preferences")}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          Set interested categories
        </button>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-blue-600 dark:text-blue-400">
            For you
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Based on your categories
          </p>
        </div>
        <button
          onClick={() => navigate("/app/setting/user-preferences")}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Manage interests
        </button>
      </header>

      <div className="space-y-5">
        {interests.map((category) => {
          const categoryItems = itemsByInterest[category] || [];
          return (
            <div key={category} className="space-y-3">
              <h4 className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                {category}
              </h4>
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-blue-700 w-full max-w-full min-w-0">
                {categoryItems.length ? (
                  categoryItems.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex-shrink-0">
                      <ItemCardNew
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
                        fixedWidth={true}
                      />
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    No items in this category yet.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
