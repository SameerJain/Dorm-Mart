import {
  ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  applyAccountRequestLockout,
  consumeAccountRequestAttempt,
  getAccountRequestRateLimit,
  submitAccountRequest,
} from "./accountCreationRequest";

const formData = {
  firstName: "Test",
  lastName: "User",
  gradMonth: 5,
  gradYear: 2027,
  email: "test@example.com",
  terms: true,
  promos: false,
};

test("accepts the generic account-request response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: true,
  });
});

test("returns safe validation errors from an HTTP response", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Invalid graduation date" }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: false,
    error: "Invalid graduation date",
  });
});

test("preserves network failures so the UI can distinguish them", async () => {
  const fetchImpl = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

  await expect(submitAccountRequest(formData, fetchImpl)).rejects.toThrow(
    "Failed to fetch",
  );
});

test("sends the terms acceptance required by the backend", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true }),
  });

  await submitAccountRequest(formData, fetchImpl);

  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
    terms: true,
    promos: false,
  });
});

test("recognizes backend account-request throttling without exposing email details", async () => {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: false,
    status: 429,
    json: async () => ({ retry_after_seconds: 90 }),
  });

  await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({
    accepted: false,
    rateLimited: true,
    retryAfterSeconds: 90,
    error: ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  });
});

test("blocks the browser after four account-request attempts", () => {
  const storage = {
    value: null,
    getItem: jest.fn(() => storage.value),
    setItem: jest.fn((key, value) => {
      storage.value = value;
    }),
  };
  const now = 1_000_000;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    expect(consumeAccountRequestAttempt(storage, now + attempt).allowed).toBe(true);
  }

  expect(getAccountRequestRateLimit(storage, now + 4).blocked).toBe(true);
  expect(consumeAccountRequestAttempt(storage, now + 4).allowed).toBe(false);
});

test("applies a backend lockout to browser state", () => {
  const storage = {
    value: null,
    getItem: jest.fn(() => storage.value),
    setItem: jest.fn((key, value) => {
      storage.value = value;
    }),
  };

  applyAccountRequestLockout(90, storage, 1_000_000);

  expect(getAccountRequestRateLimit(storage, 1_089_999).blocked).toBe(true);
  expect(getAccountRequestRateLimit(storage, 1_090_000).blocked).toBe(false);
});
