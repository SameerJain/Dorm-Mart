import { enableBrowserPush, disableBrowserPush, browserPushWorkerUrl } from "../../utils/browserPush";
import { apiGetJson, csrfPostJson } from "../../utils/apiClient";
jest.mock("../../utils/apiClient", () => ({ apiGetJson: jest.fn(), csrfPostJson: jest.fn() }));

let subscription;
let registration;
beforeEach(() => {
  jest.resetAllMocks();
  subscription = { endpoint: "https://fcm.googleapis.com/test", toJSON: () => ({ endpoint: "https://fcm.googleapis.com/test", keys: {} }), unsubscribe: jest.fn().mockResolvedValue(true) };
  registration = { pushManager: { getSubscription: jest.fn().mockResolvedValue(null), subscribe: jest.fn().mockResolvedValue(subscription) } };
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  window.PushManager = function () {};
  window.Notification = { permission: "default", requestPermission: jest.fn().mockResolvedValue("granted") };
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: jest.fn().mockResolvedValue(registration), ready: Promise.resolve(registration), getRegistration: jest.fn().mockResolvedValue(registration) } });
  apiGetJson.mockResolvedValue({ data: { configured: true, publicKey: "BA", endpoints: [] } });
  csrfPostJson.mockResolvedValue({ success: true });
});

test("enabling asks permission and saves the real browser subscription", async () => {
  await enableBrowserPush("BA");
  expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  expect(registration.pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  expect(csrfPostJson).toHaveBeenCalledWith(expect.stringMatching(/push\/subscription.php$/), { subscription: subscription.toJSON() });
});

test("permission denial never creates a subscription", async () => {
  Notification.requestPermission.mockResolvedValue("denied");
  await expect(enableBrowserPush("BA")).rejects.toThrow(/permission/i);
  expect(registration.pushManager.subscribe).not.toHaveBeenCalled();
  expect(csrfPostJson).not.toHaveBeenCalled();
});

test("disabling removes the server subscription before unsubscribing locally", async () => {
  registration.pushManager.getSubscription.mockResolvedValue(subscription);
  await disableBrowserPush();
  expect(csrfPostJson).toHaveBeenCalledWith(expect.any(String), { action: "unsubscribe", endpoint: subscription.endpoint });
  expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
});

test("failed server registration removes the newly created browser subscription", async () => {
  csrfPostJson.mockRejectedValue(new Error("Offline"));
  await expect(enableBrowserPush("BA")).rejects.toThrow("Offline");
  expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
});

test("the production root PUBLIC_URL does not become a different hostname", () => {
  const previous = process.env.PUBLIC_URL;
  process.env.PUBLIC_URL = "/";
  expect(browserPushWorkerUrl()).toBe(`${window.location.origin}/push-worker.js`);
  if (previous === undefined) delete process.env.PUBLIC_URL;
  else process.env.PUBLIC_URL = previous;
});

test("reenabling cleans up the old browser subscription before replacing it", async () => {
  registration.pushManager.getSubscription.mockResolvedValue(subscription);
  await enableBrowserPush("BA");
  expect(csrfPostJson).toHaveBeenNthCalledWith(1, expect.any(String), { action: "unsubscribe", endpoint: subscription.endpoint });
  expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
  expect(csrfPostJson).toHaveBeenNthCalledWith(2, expect.any(String), { subscription: subscription.toJSON() });
});
