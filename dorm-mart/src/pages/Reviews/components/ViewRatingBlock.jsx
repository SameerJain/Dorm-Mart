import StarRating from "../StarRating";

/** Read-only rating row used by the review view mode. */
export default function ViewRatingBlock({ label, rating }) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <StarRating rating={rating} readOnly={true} size={32} />
        <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {rating.toFixed(1)} / 5.0
        </span>
      </div>
    </div>
  );
}
