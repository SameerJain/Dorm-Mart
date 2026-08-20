import ItemCardNew from "../../../components/ItemCardNew";

export default function ListingGrid({ items, wishlistedIds }) {
  return (
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
  );
}
