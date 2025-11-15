import React from "react";

/**
 * StarRating Component
 * 
 * A reusable star rating component that supports:
 * - Half-star increments (0.5)
 * - Both interactive (editable) and read-only modes
 * - Click-based rating selection
 * - Visual feedback with hover effects
 * - Synchronized numeric input
 * 
 * @param {number} rating - Current rating value (0-5)
 * @param {function} onRatingChange - Callback when rating changes
 * @param {boolean} readOnly - If true, disables interaction
 * @param {number} size - Size of stars in pixels (default: 32)
 */
function StarRating({ rating = 0, onRatingChange = null, readOnly = false, size = 32 }) {
  const [hoveredRating, setHoveredRating] = React.useState(null);

  const handleStarClick = (starValue) => {
    if (readOnly || !onRatingChange) return;
    onRatingChange(starValue);
  };

  const handleStarHover = (starValue) => {
    if (readOnly) return;
    setHoveredRating(starValue);
  };

  const handleMouseLeave = () => {
    setHoveredRating(null);
  };

  const displayRating = hoveredRating !== null ? hoveredRating : rating;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const fullStarValue = starIndex;
        const halfStarValue = starIndex - 0.5;

        return (
          <div
            key={starIndex}
            className="relative inline-block"
            style={{ width: size, height: size }}
            onMouseLeave={handleMouseLeave}
          >
            {/* Left half (for 0.5 increments) */}
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleStarClick(halfStarValue)}
              onMouseEnter={() => handleStarHover(halfStarValue)}
              className={`absolute left-0 top-0 w-1/2 h-full z-10 ${
                readOnly ? "cursor-default" : "cursor-pointer"
              }`}
              style={{ clipPath: "inset(0 50% 0 0)" }}
              aria-label={`Rate ${halfStarValue} stars`}
            >
              <Star
                filled={displayRating >= halfStarValue}
                partial={displayRating >= halfStarValue && displayRating < fullStarValue}
                size={size}
              />
            </button>

            {/* Right half (for full star) */}
            <button
              type="button"
              disabled={readOnly}
              onClick={() => handleStarClick(fullStarValue)}
              onMouseEnter={() => handleStarHover(fullStarValue)}
              className={`absolute left-0 top-0 w-full h-full ${
                readOnly ? "cursor-default" : "cursor-pointer"
              }`}
              aria-label={`Rate ${fullStarValue} stars`}
            >
              <Star
                filled={displayRating >= fullStarValue}
                partial={false}
                size={size}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Individual Star Component
 * Renders a single star with filled/empty/half-filled states
 */
function Star({ filled, partial, size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block"
    >
      <defs>
        <linearGradient id={`half-fill-${size}`}>
          <stop offset="50%" stopColor="#fbbf24" />
          <stop offset="50%" stopColor="#e5e7eb" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={filled && !partial ? "#fbbf24" : partial ? `url(#half-fill-${size})` : "#e5e7eb"}
        stroke="#fbbf24"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * StarRatingWithInput Component
 * 
 * Combines star rating with a numeric input field
 * Useful for forms where users can either click stars or type a value
 */
export function StarRatingWithInput({ rating, onRatingChange, readOnly = false }) {
  const handleInputChange = (e) => {
    if (readOnly) return;
    let value = parseFloat(e.target.value);
    if (isNaN(value)) value = 0;
    // Clamp between 0 and 5
    value = Math.max(0, Math.min(5, value));
    // Round to nearest 0.5
    value = Math.round(value * 2) / 2;
    onRatingChange(value);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <StarRating
          rating={rating}
          onRatingChange={onRatingChange}
          readOnly={readOnly}
          size={40}
        />
        <span className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          {rating.toFixed(1)}
        </span>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <label htmlFor="rating-input" className="text-sm text-gray-600 dark:text-gray-400">
            Or enter rating:
          </label>
          <input
            id="rating-input"
            type="number"
            min="0"
            max="5"
            step="0.5"
            value={rating}
            onChange={handleInputChange}
            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={readOnly}
          />
        </div>
      )}
    </div>
  );
}

export default StarRating;

