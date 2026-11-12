import { API_BASE } from "./apiConfig";
import { apiGetJson, csrfPostJson } from "./apiClient";

const endpoint = `${API_BASE}/push/subscription.php`;
export const browserPushWorkerUrl = () => new URL(`${(process.env.PUBLIC_URL || ".").replace(/\/$/, "")}/push-worker.js`, window.location.href).href;

export function browserPushSupported() {
  return window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function browserPushState() {
  if (!browserPushSupported()) return { supported: false, enabled: false };
  const { data } = await apiGetJson(endpoint);
  const registration = await navigator.serviceWorker.getRegistration(browserPushWorkerUrl());
  const subscription = await registration?.pushManager.getSubscription();
  return { ...data, supported: true, permission: Notification.permission, enabled: Boolean(subscription && data.endpoints.includes(subscription.endpoint)) };
}

export async function enableBrowserPush(publicKey) {
  if (!browserPushSupported()) throw new Error("This browser does not support push notifications.");
  if (!publicKey) throw new Error("Browser notifications are not configured yet.");
  // Must run directly from the user's button click, never automatically on page load.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted. You can allow it in your browser’s site settings.");
  await navigator.serviceWorker.register(browserPushWorkerUrl(), { updateViaCache: "none" });
  const registration = await navigator.serviceWorker.ready;
  const previous = await registration.pushManager.getSubscription();
  if (previous) {
    await csrfPostJson(endpoint, { action: "unsubscribe", endpoint: previous.endpoint });
    await previous.unsubscribe();
  }
  const key = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  try {
    await csrfPostJson(endpoint, { subscription: subscription.toJSON() });
  } catch (error) {
    await subscription.unsubscribe();
    throw error;
  }
}

export async function disableBrowserPush() {
  const registration = await navigator.serviceWorker.getRegistration(browserPushWorkerUrl());
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await csrfPostJson(endpoint, { action: "unsubscribe", endpoint: subscription.endpoint });
  await subscription.unsubscribe();
  const notifications = await registration.getNotifications?.();
  notifications?.forEach((notification) => notification.close());
}
