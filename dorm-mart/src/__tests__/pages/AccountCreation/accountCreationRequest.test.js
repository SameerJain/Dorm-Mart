import {
  ACCOUNT_REQUEST_RATE_LIMIT_MESSAGE,
  applyAccountRequestLockout,
  consumeAccountRequestAttempt,
  getAccountRequestRateLimit,
  submitAccountRequest,
} from "../../../pages/AccountCreation/accountCreationRequest";

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

describe("browser-side account request throttle", () => {
  const WINDOW = 10 * 60 * 1000;
  const LOCKOUT = 3 * 60 * 1000;
  const KEY = "dormMartAccountRequestRateLimit";
  const T = 5_000_000;
  const fakeStorage = (initial = null) => {
    const storage = {
      value: initial,
      getItem: jest.fn(() => storage.value),
      setItem: jest.fn((key, value) => {
        storage.key = key;
        storage.value = value;
      }),
    };
    return storage;
  };
  const saved = (storage) => JSON.parse(storage.value);

  test("the first three attempts are allowed and leave no block; the fourth starts a three-minute lockout", () => {
    const storage = fakeStorage();
    for (let i = 1; i <= 3; i += 1) {
      expect(consumeAccountRequestAttempt(storage, T + i)).toEqual({ allowed: true, blockedUntil: 0 });
      expect(getAccountRequestRateLimit(storage, T + i)).toEqual({ blocked: false, blockedUntil: 0 });
    }
    expect(consumeAccountRequestAttempt(storage, T + 4)).toEqual({ allowed: true, blockedUntil: T + 4 + LOCKOUT });
    expect(getAccountRequestRateLimit(storage, T + 5)).toEqual({ blocked: true, blockedUntil: T + 4 + LOCKOUT });
    expect(storage.key).toBe(KEY);
    expect(saved(storage)).toEqual({ attempts: 4, lastAttempt: T + 4, blockedUntil: T + 4 + LOCKOUT });
  });

  test("each attempt is recorded with its count and time", () => {
    const storage = fakeStorage();
    consumeAccountRequestAttempt(storage, T);
    expect(saved(storage)).toEqual({ attempts: 1, lastAttempt: T, blockedUntil: 0 });
    consumeAccountRequestAttempt(storage, T + 1000);
    expect(saved(storage)).toEqual({ attempts: 2, lastAttempt: T + 1000, blockedUntil: 0 });
  });

  test("while locked out, attempts are refused and nothing is rewritten", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 4, lastAttempt: T, blockedUntil: T + LOCKOUT }));
    expect(consumeAccountRequestAttempt(storage, T + 1)).toEqual({ allowed: false, blockedUntil: T + LOCKOUT });
    expect(consumeAccountRequestAttempt(storage, T + LOCKOUT - 1)).toEqual({ allowed: false, blockedUntil: T + LOCKOUT });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  test("the lockout ends exactly at its deadline and the count starts again", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 4, lastAttempt: T, blockedUntil: T + LOCKOUT }));
    expect(getAccountRequestRateLimit(storage, T + LOCKOUT - 1).blocked).toBe(true);
    expect(getAccountRequestRateLimit(storage, T + LOCKOUT)).toEqual({ blocked: false, blockedUntil: 0 });
    expect(consumeAccountRequestAttempt(storage, T + LOCKOUT)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(storage).attempts).toBe(1);
  });

  test("attempts older than ten minutes stop counting, exactly at the boundary", () => {
    const stale = (attempts = 3) => fakeStorage(JSON.stringify({ attempts, lastAttempt: T, blockedUntil: 0 }));

    const justInside = stale();
    consumeAccountRequestAttempt(justInside, T + WINDOW - 1);
    expect(saved(justInside).attempts).toBe(4);

    const atBoundary = stale();
    expect(consumeAccountRequestAttempt(atBoundary, T + WINDOW)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(atBoundary).attempts).toBe(1);

    const wellPast = stale();
    consumeAccountRequestAttempt(wellPast, T + 2 * WINDOW);
    expect(saved(wellPast).attempts).toBe(1);
  });

  test("a recent attempt count carries over from earlier ones", () => {
    const storage = fakeStorage(JSON.stringify({ attempts: 2, lastAttempt: T, blockedUntil: 0 }));
    consumeAccountRequestAttempt(storage, T + 1000);
    expect(saved(storage).attempts).toBe(3);
  });

  test.each([
    ["nothing saved", null],
    ["the text null", "null"],
    ["a number", "5"],
    ["a string", '"blocked"'],
    ["broken JSON", "{oops"],
    ["an empty string", ""],
  ])("saved state that is %s means a fresh start", (_label, value) => {
    const storage = fakeStorage(value);
    expect(getAccountRequestRateLimit(storage, T)).toEqual({ blocked: false, blockedUntil: 0 });
    expect(consumeAccountRequestAttempt(storage, T)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(saved(storage).attempts).toBe(1);
  });

  test("unreadable or unwritable storage never blocks or breaks the form", () => {
    const unreadable = { getItem: () => { throw new Error("denied"); }, setItem: jest.fn() };
    expect(getAccountRequestRateLimit(unreadable, T).blocked).toBe(false);
    expect(consumeAccountRequestAttempt(unreadable, T).allowed).toBe(true);

    const unwritable = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(consumeAccountRequestAttempt(unwritable, T)).toEqual({ allowed: true, blockedUntil: 0 });
    expect(() => applyAccountRequestLockout(60, unwritable, T)).not.toThrow();
  });

  test("without a storage argument the browser's localStorage is used", () => {
    window.localStorage.removeItem(KEY);
    consumeAccountRequestAttempt(undefined, T);
    expect(JSON.parse(window.localStorage.getItem(KEY)).attempts).toBe(1);
    for (let i = 1; i < 4; i += 1) consumeAccountRequestAttempt(undefined, T + i);
    expect(getAccountRequestRateLimit(undefined, T + 5).blocked).toBe(true);
    window.localStorage.removeItem(KEY);
  });

  test("with localStorage itself unavailable, requests are still allowed", () => {
    const spy = jest.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("blocked");
    });
    try {
      expect(getAccountRequestRateLimit(undefined, T).blocked).toBe(false);
      expect(consumeAccountRequestAttempt(undefined, T).allowed).toBe(true);
      expect(applyAccountRequestLockout(60, undefined, T)).toBe(T + 60_000);
    } finally {
      spy.mockRestore();
    }
  });

  test("the current time is the default clock", () => {
    const storage = fakeStorage();
    const before = Date.now();
    consumeAccountRequestAttempt(storage);
    const { lastAttempt } = saved(storage);
    expect(lastAttempt).toBeGreaterThanOrEqual(before);
    expect(lastAttempt).toBeLessThanOrEqual(Date.now());
    expect(getAccountRequestRateLimit(fakeStorage()).blocked).toBe(false);
    const locked = fakeStorage();
    const until = applyAccountRequestLockout(60, locked);
    expect(until).toBeGreaterThan(Date.now());
    expect(getAccountRequestRateLimit(locked).blocked).toBe(true);
  });

  describe("applyAccountRequestLockout", () => {
    test("blocks for the number of seconds the server asked for, and records a full set of attempts", () => {
      const storage = fakeStorage();
      expect(applyAccountRequestLockout(90, storage, T)).toBe(T + 90_000);
      expect(saved(storage)).toEqual({ attempts: 4, lastAttempt: T, blockedUntil: T + 90_000 });
      expect(consumeAccountRequestAttempt(storage, T + 1).allowed).toBe(false);
    });

    test("uses three minutes when the server gave no usable number, and at least one second otherwise", () => {
      const seconds = (value) => applyAccountRequestLockout(value, fakeStorage(), T) - T;
      expect(seconds(undefined)).toBe(180_000);
      expect(seconds(null)).toBe(180_000);
      expect(seconds("abc")).toBe(180_000);
      expect(seconds(0)).toBe(180_000);
      expect(seconds("45")).toBe(45_000);
      expect(seconds(1)).toBe(1_000);
      expect(seconds(0.2)).toBe(1_000);
      expect(seconds(-30)).toBe(1_000);
    });
  });
});

describe("submitAccountRequest details", () => {
  test("posts the trimmed details as JSON to the account endpoint", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await submitAccountRequest(
      { firstName: "  Ava ", lastName: " Lee  ", gradMonth: 5, gradYear: 2027, email: "  ava@buffalo.edu ", terms: true, promos: true },
      fetchImpl,
    );
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/\/auth\/create_account\.php$/);
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(options.body)).toEqual({
      firstName: "Ava",
      lastName: "Lee",
      gradMonth: 5,
      gradYear: 2027,
      email: "ava@buffalo.edu",
      terms: true,
      promos: true,
    });
  });

  test("uses the global fetch when none is supplied", async () => {
    const original = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    try {
      await expect(submitAccountRequest(formData)).resolves.toEqual({ accepted: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = original;
    }
  });

  test("a throttled reply falls back to three minutes when the server gives no usable wait", async () => {
    for (const payload of [{}, { retry_after_seconds: 0 }, { retry_after_seconds: "soon" }]) {
      const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => payload });
      await expect(submitAccountRequest(formData, fetchImpl)).resolves.toMatchObject({
        rateLimited: true,
        retryAfterSeconds: 180,
      });
    }
    const unreadable = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => { throw new Error("html"); } });
    await expect(submitAccountRequest(formData, unreadable)).resolves.toMatchObject({ rateLimited: true, retryAfterSeconds: 180 });
  });

  test("other failures use the server's message, or a default when there is none", async () => {
    const unreadable = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error("html"); } });
    await expect(submitAccountRequest(formData, unreadable)).resolves.toEqual({
      accepted: false,
      error: "Unable to submit your request.",
    });
    const empty = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "" }) });
    await expect(submitAccountRequest(formData, empty)).resolves.toEqual({
      accepted: false,
      error: "Unable to submit your request.",
    });
  });

  test("a success is accepted even when the body is unreadable", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new Error("empty"); } });
    await expect(submitAccountRequest(formData, fetchImpl)).resolves.toEqual({ accepted: true });
  });
});
