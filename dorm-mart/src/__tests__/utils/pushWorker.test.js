const fs = require("fs");
const path = require("path");
const vm = require("vm");

let handlers;
let worker;
beforeEach(() => {
  handlers = {};
  worker = {
    addEventListener: (name, handler) => { handlers[name] = handler; },
    registration: { scope: "https://dorm.test/market/", showNotification: jest.fn().mockResolvedValue() },
    clients: { matchAll: jest.fn().mockResolvedValue([]), openWindow: jest.fn().mockResolvedValue() },
  };
  vm.runInNewContext(fs.readFileSync(path.join(process.cwd(), "public/push-worker.js"), "utf8"), { self: worker, URL });
});

test("push displays a notification with an app-relative icon", async () => {
  let done;
  handlers.push({ data: { json: () => ({ title: "New message", body: "Open Dorm Mart", path: "/app/chat?conv=7" }) }, waitUntil: (promise) => { done = promise; } });
  await done;
  expect(worker.registration.showNotification).toHaveBeenCalledWith("New message", expect.objectContaining({ icon: "https://dorm.test/market/web-app-manifest-192x192.png", data: { path: "/app/chat?conv=7" } }));
});

test("a notification click opens the right hash route under the app scope", async () => {
  let done;
  handlers.notificationclick({ notification: { close: jest.fn(), data: { path: "/app/chat?conv=7" } }, waitUntil: (promise) => { done = promise; } });
  await done;
  expect(worker.clients.openWindow).toHaveBeenCalledWith("https://dorm.test/market/#/app/chat?conv=7");
});

test("notification data cannot navigate outside the app", async () => {
  let done;
  handlers.notificationclick({ notification: { close: jest.fn(), data: { path: "https://evil.test/" } }, waitUntil: (promise) => { done = promise; } });
  await done;
  expect(worker.clients.openWindow).toHaveBeenCalledWith("https://dorm.test/market/#/app/notification");
});
