import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfPostJson } from "../../../utils/apiClient";
import {
  combineScheduleDateTime,
  getDateRangeMessage,
  validateScheduleDateTime,
} from "../utils/scheduleDateTimeUtils";
import {
  normalizeScheduleListing,
  resolveMeetLocation,
  validateNegotiatedPrice,
} from "../utils/schedulePurchaseFormUtils";
import { MEET_LOCATION_OTHER_VALUE } from "../../../constants/meetLocations";

export function useSchedulePurchaseForm() {
  const location = useLocation();
  const navigate = useNavigate();
  const navState =
    location.state && typeof location.state === "object"
      ? location.state
      : null;
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
  const [negotiatedPrice, setNegotiatedPrice] = useState("");
  const [isTrade, setIsTrade] = useState(false);
  const [tradeItemDescription, setTradeItemDescription] = useState("");
  const [selectedListing, setSelectedListing] = useState(null);

  useEffect(() => {
    if (!navState || !navState.productId || !navState.convId) {
      navigate("/app/chat");
    }
  }, [navState, navigate]);

  useEffect(() => {
    setDateTimeError(
      getDateRangeMessage(meetingMonth, meetingDay, meetingYear),
    );
  }, [meetingMonth, meetingDay, meetingYear]);

  useEffect(() => {
    const abort = new AbortController();
    async function loadListings() {
      setError("");
      try {
        const data = await csrfPostJson(
          `${API_BASE}/seller_dashboard/manage_seller_listings.php`,
          {},
          { signal: abort.signal },
        );
        if (!data?.success) {
          throw new Error(data?.error || "Failed to load listings");
        }
        setListings(Array.isArray(data.data) ? data.data : []);
      } catch (e) {
        if (e.name !== "AbortError") {
          setError("Unable to load your listings right now.");
        }
      }
    }

    loadListings();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const finalListingId = navState?.productId
      ? String(navState.productId)
      : null;
    if (finalListingId && listings.length > 0) {
      const listing = listings.find((item) => String(item.id) === finalListingId);
      setSelectedListing(normalizeScheduleListing(listing));
      setIsTrade(false);
      setTradeItemDescription("");
      setNegotiatedPrice("");
    } else {
      setSelectedListing(null);
    }
  }, [listings, navState]);

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

    if (!validateDateTime()) return;

    const trimmedCustomLocation = customMeetLocation.trim();
    const finalMeetLocation = resolveMeetLocation(
      meetLocationChoice,
      customMeetLocation,
    );
    const finalListingId = navState?.productId
      ? String(navState.productId)
      : null;
    const finalConversationId = navState?.convId ? String(navState.convId) : null;

    if (!finalListingId || !finalConversationId) {
      setFormError(
        "An error occurred. Please return to the chat page and try again.",
      );
      return;
    }
    if (!meetLocationChoice) {
      setFormError("Please select a meet location.");
      return;
    }
    if (
      meetLocationChoice === MEET_LOCATION_OTHER_VALUE &&
      !trimmedCustomLocation
    ) {
      setFormError("Please enter a custom meet location.");
      return;
    }
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
      setFormError("Please ensure all date and time fields are properly filled.");
      return;
    }
    if (negotiatedPrice.trim() && !selectedListing?.priceNegotiable) {
      setFormError("This item is not marked as price negotiable.");
      return;
    }
    if (isTrade && !selectedListing?.acceptTrades) {
      setFormError("This item does not accept trades.");
      return;
    }

    const priceValidation = validateNegotiatedPrice(negotiatedPrice, {
      isTrade,
    });
    if (priceValidation.error) {
      setFormError(priceValidation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await csrfPostJson(
        `${API_BASE}/scheduled_purchases/create.php`,
        {
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
          negotiated_price: priceValidation.value,
          is_trade: isTrade,
          trade_item_description: isTrade ? tradeItemDescription.trim() : null,
        },
      );

      if (!payload?.success) {
        throw new Error(payload?.error || "Failed to create schedule");
      }
      navigate(navState?.convId ? `/app/chat?conv=${navState.convId}` : "/app/chat");
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

  return {
    closeConfirmOpen,
    customMeetLocation,
    dateTimeError,
    dayInputRef,
    description,
    error,
    formError,
    handleSubmit,
    isSubmitting,
    isTrade,
    meetLocationChoice,
    meetingAmPm,
    meetingDay,
    meetingHour,
    meetingMinute,
    meetingMonth,
    meetingYear,
    monthInputRef,
    negotiatedPrice,
    selectedListing,
    setCloseConfirmOpen,
    setCustomMeetLocation,
    setDateTimeError,
    setDescription,
    setFormError,
    setIsTrade,
    setMeetLocationChoice,
    setMeetingAmPm,
    setMeetingDay,
    setMeetingHour,
    setMeetingMinute,
    setMeetingMonth,
    setMeetingYear,
    setNegotiatedPrice,
    setTradeItemDescription,
    tradeItemDescription,
    yearInputRef,
  };
}
