import { API_BASE } from "../../../utils/apiConfig";

/** Grace period after scheduled meet time before the card moves to Past */
const ACTIVE_AFTER_MEETING_MS = 30 * 60 * 1000;

export function parseMeetingAtMs(req) {
  if (!req?.meeting_at) return null;
  const t = new Date(req.meeting_at).getTime();
  return Number.isFinite(t) ? t : null;
}

export function createdAtMs(req) {
  if (!req?.created_at) return 0;
  const t = new Date(req.created_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function getScheduleBucket(req, nowMs) {
  if (
    ["declined", "cancelled", "expired"].includes(req.status) ||
    req.has_completed_confirm === true ||
    req.has_unsuccessful_confirm === true
  ) {
    return "past";
  }
  const meetingMs = parseMeetingAtMs(req);
  if (meetingMs != null && nowMs >= meetingMs + ACTIVE_AFTER_MEETING_MS) {
    return "past";
  }
  if (
    meetingMs != null &&
    nowMs >= meetingMs &&
    nowMs < meetingMs + ACTIVE_AFTER_MEETING_MS
  ) {
    return "active";
  }
  if (req.status === "pending" && meetingMs == null) {
    return "needsResponse";
  }
  if (meetingMs != null && nowMs < meetingMs) {
    return "upcoming";
  }
  return "upcoming";
}

export function partitionAndSortPurchases(purchases, nowMs) {
  const buckets = {
    active: [],
    needsResponse: [],
    upcoming: [],
    past: [],
  };
  for (const req of purchases) {
    buckets[getScheduleBucket(req, nowMs)].push(req);
  }
  buckets.active.sort(
    (a, b) => (parseMeetingAtMs(a) ?? 0) - (parseMeetingAtMs(b) ?? 0),
  );
  buckets.needsResponse.sort((a, b) => createdAtMs(b) - createdAtMs(a));
  buckets.upcoming.sort(
    (a, b) =>
      (parseMeetingAtMs(a) ?? Infinity) - (parseMeetingAtMs(b) ?? Infinity),
  );
  buckets.past.sort((a, b) => {
    const ma = parseMeetingAtMs(a);
    const mb = parseMeetingAtMs(b);
    if (ma != null && mb != null) return mb - ma;
    if (ma != null) return -1;
    if (mb != null) return 1;
    return createdAtMs(b) - createdAtMs(a);
  });
  return buckets;
}

const BUCKET_ORDER = ["active", "needsResponse", "upcoming", "past"];
const BUCKET_PRIORITY = { active: 0, needsResponse: 1, upcoming: 2, past: 3 };

function bestBucketKey(buckets) {
  for (const k of BUCKET_ORDER) {
    if (buckets[k].length > 0) return k;
  }
  return "past";
}

export function compareItemGroups(a, b) {
  const ba = bestBucketKey(a.buckets);
  const bb = bestBucketKey(b.buckets);
  const pa = BUCKET_PRIORITY[ba];
  const pb = BUCKET_PRIORITY[bb];
  if (pa !== pb) return pa - pb;

  const arrA = a.buckets[ba];
  const arrB = b.buckets[bb];
  if (ba === "active") {
    const minA = Math.min(...arrA.map((r) => parseMeetingAtMs(r) ?? Infinity));
    const minB = Math.min(...arrB.map((r) => parseMeetingAtMs(r) ?? Infinity));
    if (minA !== minB) return minA - minB;
  } else if (ba === "needsResponse") {
    const maxA = Math.max(...arrA.map(createdAtMs));
    const maxB = Math.max(...arrB.map(createdAtMs));
    if (maxA !== maxB) return maxB - maxA;
  } else if (ba === "upcoming") {
    const minA = Math.min(...arrA.map((r) => parseMeetingAtMs(r) ?? Infinity));
    const minB = Math.min(...arrB.map((r) => parseMeetingAtMs(r) ?? Infinity));
    if (minA !== minB) return minA - minB;
  } else {
    const sortKey = (r) => {
      const m = parseMeetingAtMs(r);
      return m != null ? m : createdAtMs(r);
    };
    const maxA = Math.max(...arrA.map(sortKey));
    const maxB = Math.max(...arrB.map(sortKey));
    if (maxA !== maxB) return maxB - maxA;
  }

  const flatA = [
    ...a.buckets.active,
    ...a.buckets.needsResponse,
    ...a.buckets.upcoming,
    ...a.buckets.past,
  ];
  const flatB = [
    ...b.buckets.active,
    ...b.buckets.needsResponse,
    ...b.buckets.upcoming,
    ...b.buckets.past,
  ];
  const newestA = Math.max(0, ...flatA.map(createdAtMs));
  const newestB = Math.max(0, ...flatB.map(createdAtMs));
  if (newestA !== newestB) return newestB - newestA;
  return String(a.productId).localeCompare(String(b.productId), undefined, {
    numeric: true,
  });
}

export function groupScheduledPurchasesByItem(buyerRequests, sellerRequests, nowMs) {
  const allRequests = [
    ...buyerRequests.map((req) => ({ ...req, perspective: "buyer" })),
    ...sellerRequests.map((req) => ({ ...req, perspective: "seller" })),
  ];

  const grouped = {};
  allRequests.forEach((req) => {
    const productId = req.inventory_product_id;
    if (!grouped[productId]) {
      grouped[productId] = {
        item: req.item || { title: "Unknown Item" },
        productId,
        purchases: [],
      };
    }
    grouped[productId].purchases.push(req);
  });

  return Object.values(grouped)
    .map((group) => ({
      ...group,
      buckets: partitionAndSortPurchases(group.purchases, nowMs),
    }))
    .sort(compareItemGroups);
}

async function fetchScheduledPurchaseList(path, signal) {
  const res = await fetch(`${API_BASE}/scheduled_purchases/${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "include",
    signal,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (!payload.success) {
    throw new Error(payload.error || "Failed to load scheduled purchases");
  }
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loadScheduledPurchases(signal) {
  const [buyerRequests, sellerRequests] = await Promise.all([
    fetchScheduledPurchaseList("list_buyer.php", signal),
    fetchScheduledPurchaseList("list_seller.php", signal),
  ]);

  return { buyerRequests, sellerRequests };
}
