import {
  MEET_LOCATION_OPTIONS,
  MEET_LOCATION_OTHER_VALUE,
} from "../../../constants/meetLocations";

export default function MeetLocationField({
  customMeetLocation,
  meetLocationChoice,
  selectedListing,
  setCustomMeetLocation,
  setMeetLocationChoice,
}) {
  return (
    <div className="max-w-xs">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        Meet Location <span className="text-red-500">*</span>
      </label>
      <select
        value={meetLocationChoice}
        onChange={(e) => {
          const value = e.target.value;
          setMeetLocationChoice(value);
          if (value !== MEET_LOCATION_OTHER_VALUE) setCustomMeetLocation("");
        }}
        className={`w-full bg-white dark:bg-gray-900 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          selectedListing?.meet_location &&
          meetLocationChoice === selectedListing.meet_location
            ? "border-blue-500 dark:border-blue-400"
            : "border-gray-300 dark:border-gray-700"
        }`}
      >
        <option value="" disabled>
          Select An Option
        </option>
        {MEET_LOCATION_OPTIONS.filter((option) => option.value !== "").map(
          (option) => {
            const itemLocation = selectedListing?.meet_location;
            const isItemLocation =
              itemLocation &&
              (option.value === itemLocation ||
                (option.value === MEET_LOCATION_OTHER_VALUE &&
                  itemLocation !== "North Campus" &&
                  itemLocation !== "South Campus" &&
                  itemLocation !== "Ellicott"));
            return (
              <option
                key={option.value || "unselected"}
                value={option.value}
                style={isItemLocation ? { backgroundColor: "#dbeafe" } : {}}
              >
                {option.label}
                {isItemLocation ? " (Listed on item form)" : ""}
              </option>
            );
          },
        )}
      </select>
      {meetLocationChoice === MEET_LOCATION_OTHER_VALUE && (
        <input
          type="text"
          value={customMeetLocation}
          onChange={(e) => setCustomMeetLocation(e.target.value.slice(0, 30))}
          maxLength={30}
          placeholder="Enter meet location"
          className="mt-2 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      {selectedListing?.meet_location &&
        (meetLocationChoice === selectedListing.meet_location ||
        (meetLocationChoice === MEET_LOCATION_OTHER_VALUE &&
          customMeetLocation.trim() === selectedListing.meet_location) ? (
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
            This location matches the one listed on your item form
          </p>
        ) : (
          meetLocationChoice && (
            <div className="mt-1 flex items-start gap-2">
              <svg
                className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <p className="text-sm text-orange-600 dark:text-orange-400 break-words">
                Please note that this location is different from the one listed
                on your item form ({selectedListing.meet_location})
              </p>
            </div>
          )
        ))}
    </div>
  );
}
