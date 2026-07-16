import { formatDateTime } from "../../../utils/formatters";

export const BADGE_BASE = "px-2 py-1 text-xs font-semibold rounded";

const STATUS_BADGE_CLASSES = {
  pending:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  accepted:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  cancelled:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 line-through",
  expired:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  unsuccessful:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  default: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export const CARD_TONES = {
  negative: {
    cardBorder: "border-red-500 dark:border-red-600",
    cardBg: "bg-red-50 dark:bg-red-900/20",
    roleBadge:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    metaText: "text-red-600 dark:text-red-300",
    bodyText: "text-red-700 dark:text-red-200",
    codeText: "text-red-600 dark:text-red-300",
    panelBg: "bg-red-400 dark:bg-red-500",
    inactive: true,
    redCost: true,
  },
  expired: {
    cardBorder: "border-amber-500 dark:border-amber-600",
    cardBg: "bg-amber-50 dark:bg-amber-900/20",
    roleBadge:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    metaText: "text-amber-600 dark:text-amber-300",
    bodyText: "text-amber-700 dark:text-amber-200",
    codeText: "text-amber-600 dark:text-amber-300",
    panelBg: "bg-amber-400 dark:bg-amber-500",
    inactive: true,
    redCost: true,
  },
  completed: {
    cardBorder: "border-gray-400 dark:border-gray-600",
    cardBg: "bg-gray-50 dark:bg-gray-800/50",
    roleBadge: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    metaText: "text-gray-600 dark:text-gray-400",
    bodyText: "text-gray-600 dark:text-gray-400",
    codeText: "text-gray-500 dark:text-gray-500",
    panelBg: "bg-gray-400 dark:bg-gray-600",
    inactive: true,
  },
  buyer: {
    cardBorder: "border-green-500 dark:border-green-600",
    cardBg: "bg-green-50 dark:bg-green-900/20",
    roleBadge:
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
    metaText: "text-gray-500 dark:text-gray-400",
    bodyText: "text-gray-700 dark:text-gray-200",
    partyText: "text-gray-600 dark:text-gray-300",
    codeText: "text-blue-600 dark:text-blue-400",
    locationBg: "bg-blue-600 dark:bg-blue-800",
    meetingBg: "bg-teal-600 dark:bg-teal-700",
  },
  seller: {
    cardBorder: "border-blue-500 dark:border-blue-600",
    cardBg: "bg-blue-50 dark:bg-blue-900/20",
    roleBadge:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    metaText: "text-gray-500 dark:text-gray-400",
    bodyText: "text-gray-700 dark:text-gray-200",
    partyText: "text-gray-600 dark:text-gray-300",
    codeText: "text-blue-600 dark:text-blue-400",
    locationBg: "bg-indigo-600 dark:bg-indigo-700",
    meetingBg: "bg-purple-600 dark:bg-purple-700",
  },
};

export const INFO_BOX_CLASSES = {
  red: {
    box: "bg-red-50 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-700 rounded-lg p-1.5 mb-1.5",
    icon: "text-red-600 dark:text-red-300",
    label: "text-red-700 dark:text-red-200",
    detail: "text-red-600 dark:text-red-300",
  },
  amber: {
    box: "bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-700 rounded-lg p-1.5 mb-1.5",
    icon: "text-amber-600 dark:text-amber-300",
    label: "text-amber-700 dark:text-amber-200",
    detail: "text-amber-600 dark:text-amber-300",
  },
  gray: {
    box: "bg-gray-50 dark:bg-gray-800/50 border-2 border-gray-400 dark:border-gray-600 rounded-lg p-1.5 mb-1.5",
    icon: "text-gray-600 dark:text-gray-400",
    label: "text-gray-700 dark:text-gray-300",
    detail: "text-gray-600 dark:text-gray-400",
  },
};

export function getRequestState(req) {
  if (req.has_unsuccessful_confirm === true) return "unsuccessful";
  if (req.has_completed_confirm === true) return "completed";
  return req.status || "default";
}

export function getStatusLabel(req) {
  const state = getRequestState(req);
  if (state === "unsuccessful") return "Unsuccessful";
  if (state === "completed") return "Completed";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function getStatusBadgeClass(req) {
  const state = getRequestState(req);
  return `${BADGE_BASE} ${
    STATUS_BADGE_CLASSES[state] || STATUS_BADGE_CLASSES.default
  }`;
}

export function getCardTone(req, isBuyer) {
  const state = getRequestState(req);
  if (["declined", "cancelled", "unsuccessful"].includes(state)) {
    return CARD_TONES.negative;
  }
  if (state === "expired") return CARD_TONES.expired;
  if (state === "completed") return CARD_TONES.completed;
  return isBuyer ? CARD_TONES.buyer : CARD_TONES.seller;
}

export function formatPersonName(person) {
  return `${person?.first_name || ""} ${person?.last_name || ""}`.trim();
}

export function formatPurchaseDateTime(value) {
  return value ? formatDateTime(value) : "";
}
