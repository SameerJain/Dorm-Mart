import { clearCsrfToken, csrfFetch, getCsrfToken } from "../../utils/csrfFetch";

// Plain async functions, not jest.fn(): react-scripts resets mocks before each
// test, which would empty responses built while the test.each tables are read.
const json = (body, init = {}) => {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  };
  response.clone = () => json(body, init);
  return response;
};
const notJson = (status = 200, ok = true) => {
  const response = {
    ok,
    status,
    json: async () => {
      throw new SyntaxError("not json");
    },
  };
  response.clone = () => notJson(status, ok);
  return response;
};
const tokenReply = (token) => json({ csrf_token: token });
const csrfRejected = () => json({ code: "csrf_invalid", error: "bad token" }, { ok: false, status: 403 });
const bodyOf = (callIndex) => JSON.parse(global.fetch.mock.calls[callIndex][1].body);

beforeEach(() => {
  clearCsrfToken();
  global.fetch = jest.fn();
});
afterEach(() => clearCsrfToken());

describe("getCsrfToken", () => {
  test("asks the server once, with the session cookie, and reuses the answer", async () => {
    global.fetch.mockResolvedValue(tokenReply("t1"));
    await expect(getCsrfToken()).resolves.toBe("t1");
    await expect(getCsrfToken()).resolves.toBe("t1");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/get_csrf_token\.php$/);
    expect(options).toEqual({
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  });

  test("simultaneous callers share one request", async () => {
    global.fetch.mockResolvedValue(tokenReply("t1"));
    await Promise.all([getCsrfToken(), getCsrfToken(), getCsrfToken()]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("clearing the token makes the next call ask again", async () => {
    global.fetch.mockResolvedValueOnce(tokenReply("t1")).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).resolves.toBe("t1");
    clearCsrfToken();
    await expect(getCsrfToken()).resolves.toBe("t2");
  });

  test.each([
    ["the server's own error message", json({ error: "Session expired" }, { ok: false, status: 401 }), "Session expired"],
    ["a default message when the error has no text", json({}, { ok: false, status: 500 }), "Unable to get CSRF token"],
    ["a default message when a good response carries no token", json({ ok: true }), "Unable to get CSRF token"],
    ["a default message when a good response has an empty token", json({ csrf_token: "" }), "Unable to get CSRF token"],
    ["a default message for an unreadable body", notJson(200, true), "Unable to get CSRF token"],
    ["a default message for an unreadable error body", notJson(500, false), "Unable to get CSRF token"],
  ])("fails with %s", async (_label, reply, message) => {
    global.fetch.mockResolvedValue(reply);
    await expect(getCsrfToken()).rejects.toThrow(message);
  });

  test("a failed lookup is not remembered; the next call tries again", async () => {
    global.fetch.mockResolvedValueOnce(json({}, { ok: false, status: 500 })).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).rejects.toThrow();
    await expect(getCsrfToken()).resolves.toBe("t2");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("a network failure is not remembered either", async () => {
    global.fetch.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(tokenReply("t2"));
    await expect(getCsrfToken()).rejects.toThrow("offline");
    await expect(getCsrfToken()).resolves.toBe("t2");
  });
});

describe("csrfFetch: requests that need no token", () => {
  test.each([undefined, "GET", "get", "HEAD", "OPTIONS"])("method %p goes straight through untouched", async (method) => {
    global.fetch.mockResolvedValue(json({ ok: true }));
    const options = method === undefined ? {} : { method };
    const result = await csrfFetch("/api/read", options);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/read", options);
    expect(result).toBe(await global.fetch.mock.results[0].value);
  });

  test("a call with no options at all is a plain fetch", async () => {
    global.fetch.mockResolvedValue(json({}));
    await csrfFetch("/api/read");
    expect(global.fetch).toHaveBeenCalledWith("/api/read", {});
  });
});

describe("csrfFetch: attaching the token", () => {
  beforeEach(() => {
    global.fetch.mockImplementation(async (url) => (String(url).includes("get_csrf_token") ? tokenReply("tok") : json({ ok: true })));
  });

  test.each(["POST", "post", "PUT", "PATCH", "DELETE", "delete"])("%s carries the token", async (method) => {
    await csrfFetch("/api/save", { method });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, options] = global.fetch.mock.calls[1];
    expect(url).toBe("/api/save");
    expect(options.method).toBe(method.toUpperCase());
    expect(JSON.parse(options.body)).toEqual({ csrf_token: "tok" });
    expect(options.headers.get("Content-Type")).toBe("application/json");
  });

  test("a JSON body keeps its fields and gains the token; the token cannot be overridden by the caller", async () => {
    await csrfFetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lamp", csrf_token: "forged" }),
    });
    expect(bodyOf(1)).toEqual({ name: "Lamp", csrf_token: "tok" });
  });

  test("other request options and headers are preserved", async () => {
    const signal = new AbortController().signal;
    await csrfFetch("/api/save", {
      method: "POST",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json", "X-Trace": "abc" },
      body: "{}",
    });
    const options = global.fetch.mock.calls[1][1];
    expect(options.credentials).toBe("include");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("X-Trace")).toBe("abc");
  });

  test("a body given as a plain object is merged the same way", async () => {
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: { a: 1 } });
    expect(bodyOf(1)).toEqual({ a: 1, csrf_token: "tok" });
  });

  test("JSON that is not an object (a list, null, a number) is replaced rather than merged", async () => {
    for (const body of ["[1,2]", "null", "5", '"text"', "true"]) {
      global.fetch.mockClear();
      await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      // The token is cached after the first pass, so the POST is the only call.
      expect(bodyOf(global.fetch.mock.calls.length - 1)).toEqual({ csrf_token: "tok" });
    }
    global.fetch.mockClear();
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: [1, 2] });
    expect(bodyOf(global.fetch.mock.calls.length - 1)).toEqual({ csrf_token: "tok" });
  });

  test("a body that is not valid JSON stops the request before it is sent", async () => {
    await expect(
      csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad" }),
    ).rejects.toThrow("Invalid JSON request body");
    expect(global.fetch.mock.calls.every(([url]) => String(url).includes("get_csrf_token"))).toBe(true);
  });

  test("a non-JSON body is sent as it was, with no token added", async () => {
    await csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hello" });
    const options = global.fetch.mock.calls[1][1];
    expect(options.body).toBe("hello");
    expect(options.method).toBe("POST");
  });

  test("form uploads get the token as a field and keep every other field; the original form is untouched", async () => {
    const form = new FormData();
    form.append("title", "Lamp");
    form.append("csrf_token", "forged");
    form.append("photo", new File(["x"], "a.png", { type: "image/png" }));

    await csrfFetch("/api/upload", { method: "POST", body: form });

    const sent = global.fetch.mock.calls[1][1].body;
    expect(sent).toBeInstanceOf(FormData);
    expect(sent).not.toBe(form);
    expect(sent.get("title")).toBe("Lamp");
    expect(sent.getAll("csrf_token")).toEqual(["tok"]);
    expect(sent.get("photo").name).toBe("a.png");
    expect(form.get("csrf_token")).toBe("forged");
    expect(global.fetch.mock.calls[1][1].headers).toBeUndefined();
  });

  test("the token is fetched once and reused across requests", async () => {
    await csrfFetch("/api/one", { method: "POST" });
    await csrfFetch("/api/two", { method: "POST" });
    expect(global.fetch.mock.calls.filter(([url]) => String(url).includes("get_csrf_token"))).toHaveLength(1);
  });
});

describe("csrfFetch: a stale token", () => {
  const post = () => csrfFetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: '{"a":1}' });

  test("a CSRF rejection triggers exactly one retry with a fresh token, and the retry's answer is returned", async () => {
    const retryAnswer = json({ ok: true });
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(retryAnswer);
    const result = await post();
    expect(result).toBe(retryAnswer);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(bodyOf(1)).toEqual({ a: 1, csrf_token: "old" });
    expect(bodyOf(3)).toEqual({ a: 1, csrf_token: "new" });
  });

  test("if the retry is also rejected, that answer is returned and nothing more is sent", async () => {
    const second = csrfRejected();
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(second);
    await expect(post()).resolves.toBe(second);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  test("the refreshed token is kept for later requests", async () => {
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(tokenReply("new"))
      .mockResolvedValueOnce(json({ ok: true }))
      .mockResolvedValueOnce(json({ ok: true }));
    await post();
    await post();
    expect(bodyOf(4).csrf_token).toBe("new");
  });

  test.each([
    ["a permission denial", json({ error: "Forbidden" }, { ok: false, status: 403 })],
    ["a 403 with a different code", json({ code: "banned" }, { ok: false, status: 403 })],
    ["a 403 with an unreadable body", notJson(403, false)],
    ["a 401", json({ code: "csrf_invalid" }, { ok: false, status: 401 })],
    ["a 500", json({ code: "csrf_invalid" }, { ok: false, status: 500 })],
    ["a success", json({ code: "csrf_invalid" })],
    ["a 403 with no body at all", json(null, { ok: false, status: 403 })],
  ])("%s is returned as it is, without a retry", async (_label, reply) => {
    global.fetch.mockResolvedValueOnce(tokenReply("t")).mockResolvedValueOnce(reply);
    await expect(post()).resolves.toBe(reply);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("a failure while refreshing the token is reported, not swallowed", async () => {
    global.fetch
      .mockResolvedValueOnce(tokenReply("old"))
      .mockResolvedValueOnce(csrfRejected())
      .mockResolvedValueOnce(json({ error: "Session expired" }, { ok: false, status: 401 }));
    await expect(post()).rejects.toThrow("Session expired");
  });

  test("the original response is left readable for the caller when no retry happens", async () => {
    const reply = json({ error: "Forbidden" }, { ok: false, status: 403 });
    global.fetch.mockResolvedValueOnce(tokenReply("t")).mockResolvedValueOnce(reply);
    const result = await post();
    await expect(result.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
