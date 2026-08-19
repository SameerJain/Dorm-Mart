import { API_BASE } from "../../utils/apiConfig";

export const ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE =
  "Too many account requests. Please try again in a few minutes.";

const RATE_LIMIT_STORAGE_KEY = "dormMartAccountRequestRateLimit";
const MAX_ATTEMPTS = 4;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_MS = 3 * 60 * 1000;

function browserStorage(storage) {
  if (storage) return storage;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRateLimit(storage, now) {
  try {
    const state = JSON.parse(storage?.getItem(RATE_LIMIT_STORAGE_KEY) || "null");
    if (!state || typeof state !== "object") return { attempts: 0 };
    if (Number(state.blockedUntil) > now) return state;
    if (
      Number(state.blockedUntil) > 0 ||
      Number(state.lastAttempt) <= now - ATTEMPT_WINDOW_MS
    ) {
      return { attempts: 0 };
    }
    return state;
  } catch {
    return { attempts: 0 };
  }
}

function writeRateLimit(storage, state) {
  try {
    browserStorage(storage)?.setItem(
      RATE_LIMIT_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // The backend remains authoritative when browser storage is unavailable.
  }
}

export function getAccountRequestRateLimit(storage, now = Date.now()) {
  const state = readRateLimit(browserStorage(storage), now);
  return {
    blocked: Number(state.blockedUntil) > now,
    blockedUntil: Number(state.blockedUntil) || 0,
  };
}

export function consumeAccountRequestAttempt(storage, now = Date.now()) {
  const target = browserStorage(storage);
  const state = readRateLimit(target, now);
  if (Number(state.blockedUntil) > now) {
    return { allowed: false, blockedUntil: Number(state.blockedUntil) };
  }

  const attempts = Number(state.attempts || 0) + 1;
  const blockedUntil = attempts >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;
  writeRateLimit(target, { attempts, lastAttempt: now, blockedUntil });
  return { allowed: true, blockedUntil };
}

export function applyAccountRequestLockout(retryAfterSeconds, storage, now = Date.now()) {
  const blockedUntil = now + Math.max(1, Number(retryAfterSeconds) || 180) * 1000;
  writeRateLimit(storage, {
    attempts: MAX_ATTEMPTS,
    lastAttempt: now,
    blockedUntil,
  });
  return blockedUntil;
}

export async function submitAccountRequest(formData, fetchImpl = fetch) {
  const response = await fetchImpl(`${API_BASE}/auth/create_account.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      gradMonth: formData.gradMonth,
      gradYear: formData.gradYear,
      email: formData.email.trim(),
      terms: formData.terms,
      promos: formData.promos,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (response.status === 429) {
    return {
      accepted: false,
      rateLimited: true,
      retryAfterSeconds: Number(payload.retry_after_seconds) || 180,
      error: ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
    };
  }
  return response.ok
    ? { accepted: true }
    : { accepted: false, error: payload.error || "Unable to submit your request." };
}
