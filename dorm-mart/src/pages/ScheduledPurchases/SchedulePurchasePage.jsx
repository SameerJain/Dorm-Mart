import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import {
  MEET_LOCATION_OPTIONS,
  MEET_LOCATION_OTHER_VALUE,
} from "../../constants/meetLocations";
import { decimalNumericKeyDownHandler } from "../../utils/numericInputKeyHandlers";
import { API_BASE } from "../../utils/apiConfig";
import { csrfFetch } from "../../utils/csrfFetch";
import {
  MAX_LISTING_PRICE,
  containsMemePrice,
} from "../../utils/priceValidation";
import {
  combineScheduleDateTime,
  getDateRangeMessage,
  getEasternTime,
  validateScheduleDateTime,
} from "./utils/scheduleDateTimeUtils";
// Price limits - max matches ProductListingPage exactly
const PRICE_LIMITS = {
  max: MAX_LISTING_PRICE,
};

function SchedulePurchasePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState =
    location.state && typeof location.state === "object"
      ? location.state
      : null;

  // Redirect if navState is missing - form should only be accessible from chat
  useEffect(() => {
    if (!navState || !navState.productId || !navState.convId) {
      navigate("/app/chat");
    }
  }, [navState, navigate]);

  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [meetLocationChoice, setMeetLocationChoice] = useState("");
  const [customMeetLocation, setCustomMeetLocation] = useState("");
  const [meetingMonth, setMeetingMonth] = useState("");
  const [meetingDay, setMeetingDay] = useState("");
  const [meetingYear, setMeetingYear] = useState("");
  const monthInputRef = useRef(null);
  const dayInputRef = useRef(null);
  const yearInputRef = useRef(null);
  const [meetingHour, setMeetingHour] = useState("");
  const [meetingMinute, setMeetingMinute] = useState("");
  const [meetingAmPm, setMeetingAmPm] = useState("");
  const [dateTimeError, setDateTimeError] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  useBodyScrollLock(closeConfirmOpen);

  // New fields for price negotiation and trades
  const [negotiatedPrice, setNegotiatedPrice] = useState("");
  const [isTrade, setIsTrade] = useState(false);
  const [tradeItemDescription, setTradeItemDescription] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);

  // Real-time date range feedback once both month and day are complete
  useEffect(() => {
    setDateTimeError(
      getDateRangeMessage(meetingMonth, meetingDay, meetingYear),
    );
  }, [meetingMonth, meetingDay, meetingYear]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const abort = new AbortController();
    async function loadListings() {
      setError("");
      try {
        const res = await csrfFetch(
          `${API_BASE}/seller_dashboard/manage_seller_listings.php`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            credentials: "include",
            signal: abort.signal,
            body: JSON.stringify({}),
          },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Failed to load listings");
        }
        const listingsData = Array.isArray(data.data) ? data.data : [];
        setListings(listingsData);
      } catch (e) {
        if (e.name !== "AbortError") {
          setError("Unable to load your listings right now.");
        }
      }
    }

    loadListings();
    return () => abort.abort();
  }, []);

  // Update selectedListing when listings are loaded and navState.productId is available
  useEffect(() => {
    const finalListingId = navState?.productId
      ? String(navState.productId)
      : null;
    if (finalListingId && listings.length > 0) {
      const listing = listings.find((l) => String(l.id) === finalListingId);
      if (listing) {
        // Normalize boolean values - handle both true/false and 1/0 from API
        const fullListing = {
          ...listing,
          priceNegotiable:
            listing.priceNegotiable === true ||
            listing.priceNegotiable === 1 ||
            listing.priceNegotiable === "1",
          acceptTrades:
            listing.acceptTrades === true ||
            listing.acceptTrades === 1 ||
            listing.acceptTrades === "1",
          meet_location: listing.meet_location || null,
        };
        setSelectedListing(fullListing);
      } else {
        setSelectedListing(null);
      }
      // Reset trade-related fields when listing changes
      setIsTrade(false);
      setTradeItemDescription("");
      setNegotiatedPrice("");
    } else {
      setSelectedListing(null);
    }
  }, [listings, navState]);

  // Validate date and time (using Eastern Time)
  const validateDateTime = () => {
    setDateTimeError("");
    const validationError = validateScheduleDateTime({
      meetingMonth,
      meetingDay,
      meetingYear,
      meetingHour,
      meetingMinute,
      meetingAmPm,
    });
    if (validationError) {
      setDateTimeError(validationError);
      return false;
    }
    return true;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setDateTimeError("");

    // Validate date and time first
    if (!validateDateTime()) {
      return;
    }

    const trimmedCustomLocation = customMeetLocation.trim();
    const finalMeetLocation =
      meetLocationChoice === MEET_LOCATION_OTHER_VALUE
        ? trimmedCustomLocation
        : meetLocationChoice;

    // Get values from navState (required since form is only accessible from chat)
    const finalListingId = navState?.productId
      ? String(navState.productId)
      : null;
    const finalConversationId = navState?.convId
      ? String(navState.convId)
      : null;

    // Validate required fields with specific error messages
    if (!finalListingId || !finalConversationId) {
      setFormError(
        "An error occurred. Please return to the chat page and try again.",
      );
      return;
    }

    // Check meet location
    if (!meetLocationChoice) {
      setFormError("Please select a meet location.");
      return;
    }

    // Check custom meet location if "Other" is selected
    if (
      meetLocationChoice === MEET_LOCATION_OTHER_VALUE &&
      !trimmedCustomLocation
    ) {
      setFormError("Please enter a custom meet location.");
      return;
    }

    // Validate trade item description if trade is selected
    if (isTrade && !tradeItemDescription.trim()) {
      setFormError("Please describe the item you are trading for.");
      return;
    }

    const meetingDateTimeISO = combineScheduleDateTime({
      meetingMonth,
      meetingDay,
      meetingYear,
      meetingHour,
      meetingMinute,
      meetingAmPm,
    });
    if (!meetingDateTimeISO) {
      // This should not happen if validateDateTime passed, but keep as safety check
      setFormError(
        "Please ensure all date and time fields are properly filled.",
      );
      return;
    }

    // Validate that negotiated price is only provided if item is price negotiable
    if (negotiatedPrice.trim() && !selectedListing?.priceNegotiable) {
      setFormError("This item is not marked as price negotiable.");
      return;
    }

    // Validate that trade is only selected if item accepts trades
    if (isTrade && !selectedListing?.acceptTrades) {
      setFormError("This item does not accept trades.");
      return;
    }

    // Validate that price cannot be entered if trade is selected
    if (isTrade && negotiatedPrice.trim()) {
      setFormError(
        "Cannot enter a price for a trade. Please clear the price field or uncheck the trade option.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const negotiatedPriceValue = negotiatedPrice.trim()
        ? parseFloat(negotiatedPrice)
        : null;
      if (negotiatedPriceValue !== null) {
        if (isNaN(negotiatedPriceValue) || !isFinite(negotiatedPriceValue)) {
          setFormError("Please enter a valid price.");
          setIsSubmitting(false);
          return;
        }
        if (containsMemePrice(negotiatedPrice, { digitsOnly: false })) {
          setFormError(
            "The price has a meme input in it. Please try a different price.",
          );
          setIsSubmitting(false);
          return;
        }
        if (negotiatedPriceValue < 0) {
          setFormError("Price cannot be negative.");
          setIsSubmitting(false);
          return;
        }
        if (negotiatedPriceValue > PRICE_LIMITS.max) {
          setFormError(`Price must be $${PRICE_LIMITS.max.toFixed(2)} or less`);
          setIsSubmitting(false);
          return;
        }
      }

      const res = await csrfFetch(`${API_BASE}/scheduled_purchases/create.php`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          inventory_product_id: Number(finalListingId),
          conversation_id: Number(finalConversationId),
          meet_location: finalMeetLocation,
          meet_location_choice: meetLocationChoice,
          custom_meet_location:
            meetLocationChoice === MEET_LOCATION_OTHER_VALUE
              ? trimmedCustomLocation
              : null,
          meeting_at: meetingDateTimeISO,
          description: description.trim() || null,
          negotiated_price: negotiatedPriceValue,
          is_trade: isTrade,
          trade_item_description: isTrade ? tradeItemDescription.trim() : null,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const payload = await res.json();
      if (!payload.success) {
        throw new Error(payload.error || "Failed to create schedule");
      }

      // Redirect back to chat page, optionally to the specific conversation
      if (navState?.convId) {
        navigate(`/app/chat?conv=${navState.convId}`);
      } else {
        navigate("/app/chat");
      }
    } catch (err) {
      setFormError(
        err.message === "Failed to create schedule"
          ? err.message
          : "Could not create the schedule. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Schedule a Purchase
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Coordinate a meetup with this buyer. They will either accept or deny
            this meetup request.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="max-w-xs">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Meet Location <span className="text-red-500">*</span>
              </label>
              <select
                value={meetLocationChoice}
                onChange={(e) => {
                  const value = e.target.value;
                  setMeetLocationChoice(value);
                  if (value !== MEET_LOCATION_OTHER_VALUE) {
                    setCustomMeetLocation("");
                  }
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
                {MEET_LOCATION_OPTIONS.filter(
                  (option) => option.value !== "",
                ).map((option) => {
                  // Compare meet location - handle both predefined options and custom locations
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
                      style={
                        isItemLocation ? { backgroundColor: "#dbeafe" } : {}
                      }
                    >
                      {option.label}
                      {isItemLocation ? " (Listed on item form)" : ""}
                    </option>
                  );
                })}
              </select>
              {meetLocationChoice === MEET_LOCATION_OTHER_VALUE && (
                <input
                  type="text"
                  value={customMeetLocation}
                  onChange={(e) =>
                    setCustomMeetLocation(e.target.value.slice(0, 30))
                  }
                  maxLength={30}
                  placeholder="Enter meet location"
                  className="mt-2 w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
              {selectedListing?.meet_location && (
                <>
                  {meetLocationChoice === selectedListing.meet_location ||
                  (meetLocationChoice === MEET_LOCATION_OTHER_VALUE &&
                    customMeetLocation.trim() ===
                      selectedListing.meet_location) ? (
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
                          Please note that this location is different from the
                          one listed on your item form (
                          {selectedListing.meet_location})
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Meeting Date &amp; Time <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Date
                  </label>
                  <div className="flex items-center w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                    <input
                      ref={monthInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="MM"
                      value={meetingMonth}
                      maxLength={2}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                        if (raw === "") { setMeetingMonth(""); setDateTimeError(""); return; }
                        const first = parseInt(raw[0]);
                        if (raw.length === 1) {
                          if (first > 1) {
                            setMeetingMonth("0" + raw);
                            setDateTimeError("");
                            dayInputRef.current?.focus();
                            dayInputRef.current?.select();
                          } else {
                            setMeetingMonth(raw);
                            setDateTimeError("");
                          }
                        } else {
                          const val = parseInt(raw);
                          if (val >= 1 && val <= 12) {
                            setMeetingMonth(raw);
                            setDateTimeError("");
                            dayInputRef.current?.focus();
                            dayInputRef.current?.select();
                          }
                        }
                      }}
                      className="w-7 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
                    />
                    <span className="text-gray-400 dark:text-gray-500 select-none">/</span>
                    <input
                      ref={dayInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="DD"
                      value={meetingDay}
                      maxLength={2}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
                        if (raw === "") { setMeetingDay(""); setDateTimeError(""); return; }
                        const maxDay = meetingMonth
                          ? new Date(getEasternTime().getFullYear(), parseInt(meetingMonth), 0).getDate()
                          : 31;
                        const first = parseInt(raw[0]);
                        if (raw.length === 1) {
                          if (first > 3) {
                            const padded = "0" + raw;
                            if (parseInt(padded) <= maxDay) {
                              setMeetingDay(padded);
                              setDateTimeError("");
                              yearInputRef.current?.focus();
                              yearInputRef.current?.select();
                            }
                          } else {
                            setMeetingDay(raw);
                            setDateTimeError("");
                          }
                        } else {
                          const val = parseInt(raw);
                          if (val >= 1 && val <= maxDay) {
                            setMeetingDay(raw);
                            setDateTimeError("");
                            yearInputRef.current?.focus();
                            yearInputRef.current?.select();
                          }
                        }
                      }}
                      className="w-7 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
                    />
                    <span className="text-gray-400 dark:text-gray-500 select-none">/</span>
                    <input
                      ref={yearInputRef}
                      type="text"
                      inputMode="numeric"
                      placeholder="YYYY"
                      value={meetingYear}
                      maxLength={4}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setMeetingYear(digits);
                        setDateTimeError("");
                      }}
                      className="w-10 bg-transparent outline-none placeholder-gray-400 dark:placeholder-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Hour
                  </label>
                  <select
                    value={meetingHour}
                    onChange={(e) => {
                      setMeetingHour(e.target.value);
                      setDateTimeError("");
                    }}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                      <option key={hour} value={String(hour)}>
                        {hour}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Minute
                  </label>
                  <select
                    value={meetingMinute}
                    onChange={(e) => {
                      setMeetingMinute(e.target.value);
                      setDateTimeError("");
                    }}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    {Array.from({ length: 12 }, (_, i) => i * 5).map(
                      (minute) => {
                        const minuteStr = String(minute).padStart(2, "0");
                        return (
                          <option key={minuteStr} value={minuteStr}>
                            {minuteStr}
                          </option>
                        );
                      },
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    AM/PM
                  </label>
                  <select
                    value={meetingAmPm}
                    onChange={(e) => {
                      setMeetingAmPm(e.target.value);
                      setDateTimeError("");
                    }}
                    className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">--</option>
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Price negotiation field - only show if item is price negotiable */}
            {selectedListing?.priceNegotiable && (
              <div className="max-w-xs">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Negotiated Price (Optional)
                </label>
                {selectedListing?.price && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
                    Listed price: ${Number(selectedListing.price).toFixed(2)}
                  </p>
                )}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={negotiatedPrice}
                      maxLength={7}
                      onKeyDown={decimalNumericKeyDownHandler}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          setNegotiatedPrice("");
                          return;
                        }
                        if (!/^\d{0,4}(?:\.\d{0,2})?$/.test(value)) return;
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue) && numValue <= PRICE_LIMITS.max) {
                          setNegotiatedPrice(value);
                        }
                      }}
                      placeholder=""
                      disabled={isTrade}
                      className={`w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isTrade ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                  </div>
                  {selectedListing?.acceptTrades && (
                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isTrade}
                        onChange={(e) => {
                          setIsTrade(e.target.checked);
                          if (e.target.checked) {
                            // Clear price when trade is selected
                            setNegotiatedPrice("");
                          } else {
                            setTradeItemDescription("");
                          }
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        This is an item trade
                      </span>
                    </label>
                  )}
                </div>
                {/* Price comparison messages */}
                {negotiatedPrice.trim() &&
                  selectedListing?.price &&
                  (() => {
                    const negotiatedPriceValue = parseFloat(negotiatedPrice);
                    const listedPriceValue = parseFloat(selectedListing.price);
                    if (
                      !isNaN(negotiatedPriceValue) &&
                      !isNaN(listedPriceValue)
                    ) {
                      if (negotiatedPriceValue > listedPriceValue) {
                        // Orange warning for higher price
                        return (
                          <div className="mt-2 flex items-start gap-2">
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
                            <p className="text-sm text-orange-600 dark:text-orange-400">
                              Please note that this is higher than the listed
                              price
                            </p>
                          </div>
                        );
                      } else if (negotiatedPriceValue < listedPriceValue) {
                        // Blue indication for lower price
                        return (
                          <div className="mt-2 flex items-start gap-2">
                            <svg
                              className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              />
                            </svg>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              This is lower than the listed price
                            </p>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
              </div>
            )}

            {/* Trade toggle - show separately if item accepts trades but is NOT price negotiable */}
            {selectedListing?.acceptTrades &&
              !selectedListing?.priceNegotiable && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTrade}
                      onChange={(e) => {
                        setIsTrade(e.target.checked);
                        if (e.target.checked) {
                          // Clear price when trade is selected
                          setNegotiatedPrice("");
                        } else {
                          setTradeItemDescription("");
                        }
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      This is an item trade
                    </span>
                  </label>
                </div>
              )}

            {/* Trade item description - only show if item accepts trades and trade is selected */}
            {selectedListing?.acceptTrades && isTrade && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Item You Are Trading For{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={tradeItemDescription}
                  onChange={(e) => setTradeItemDescription(e.target.value)}
                  rows={3}
                  maxLength={100}
                  placeholder="Describe the item you are trading..."
                  className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                  required={isTrade}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {tradeItemDescription.length}/100 characters
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Add any additional details about the meeting..."
                className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {description.length}/1000 characters
              </p>
            </div>

            {/* Error messages at bottom - mobile friendly */}
            {(formError || dateTimeError) && (
              <div className="mt-4 space-y-2">
                {formError && (
                  <div className="text-sm text-red-600 dark:text-red-400 break-words px-1">
                    {formError}
                  </div>
                )}
                {dateTimeError && (
                  <div className="text-sm text-red-600 dark:text-red-400 break-words px-1">
                    {dateTimeError}
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setCloseConfirmOpen(true)}
                className="inline-flex items-center px-4 py-2 border-2 border-red-500 text-red-600 dark:text-red-400 text-sm font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-blue-700 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                {isSubmitting ? "Scheduling..." : "Schedule Purchase"}
              </button>
            </div>
          </form>
        </div>

        {error && (
          <div className="mt-6 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Close Confirmation Modal */}
        {closeConfirmOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setCloseConfirmOpen(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Close This Form?
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to close? All information you've entered
                  will be lost.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setCloseConfirmOpen(false)}
                    className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    No, Keep Editing
                  </button>
                  <button
                    onClick={() => {
                      if (navState?.convId) {
                        navigate(`/app/chat?conv=${navState.convId}`);
                      } else {
                        navigate("/app/chat");
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700"
                  >
                    Yes, Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SchedulePurchasePage;
