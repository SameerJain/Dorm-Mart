import ProfileLink from "../../../components/ProfileLink";

export default function SellerMetaRow({ normalized }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm min-w-0">
      <span className="text-gray-600 dark:text-gray-400 flex-shrink-0">Sold by</span>
      <ProfileLink
        username={normalized.sellerUsername}
        email={normalized.sellerEmail}
        fallback={normalized.sellerName}
        className="font-medium text-gray-800 dark:text-gray-200 truncate min-w-0"
        hoverClass="hover:underline"
      >
        {normalized.sellerName}
      </ProfileLink>

      {normalized.tags && normalized.tags.length ? (
        <>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <div className="flex flex-wrap gap-1">
            {normalized.tags.slice(0, 3).map((tag, idx) => (
              <span
                key={`tag-top-${idx}`}
                className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-700 rounded-full px-2 py-0.5"
              >
                {String(tag)}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
