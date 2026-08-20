import StarRating from "./StarRating";

export default function EditableStarRating({ label, rating, onChange }) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-4">
        <StarRating
          rating={rating}
          onRatingChange={onChange}
          readOnly={false}
          size={40}
        />
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
