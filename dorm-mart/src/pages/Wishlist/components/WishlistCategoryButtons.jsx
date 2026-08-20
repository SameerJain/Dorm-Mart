export default function WishlistCategoryButtons({
  categories,
  selectedCategory,
  onSelect,
  mobile = false,
}) {
  const padding = mobile ? "px-4 py-2" : "px-4 py-1.5";
  const buttonClass = (selected) =>
    `${padding} rounded-full text-sm border ${
      selected
        ? "bg-blue-600 dark:bg-blue-800 text-white border-blue-600 dark:border-blue-700"
        : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
    }`;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={buttonClass(selectedCategory === null)}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={buttonClass(selectedCategory === category)}
        >
          {category}
        </button>
      ))}
    </div>
  );
}
