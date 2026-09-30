import { apiGetJson, apiPostJson, csrfPostJson, readApiError, readJsonResponse } from "../../utils/apiClient";
import { csrfFetch } from "../../utils/csrfFetch";

jest.mock("../../utils/csrfFetch", () => ({ csrfFetch: jest.fn() }));

const reply = (body, init = {}) => {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: init.noHeaders ? undefined : new Headers(init.headers || { "content-type": "application/json" }),
    text: init.text || jest.fn().mockResolvedValue(text),
  };
};

beforeEach(() => {
  global.fetch = jest.fn();
  csrfFetch.mockReset();
});

describe("readJsonResponse", () => {
  test("empty bodies are null; JSON is parsed; anything else is a deliberate error", async () => {
    await expect(readJsonResponse(reply(""))).resolves.toBeNull();
    await expect(readJsonResponse(reply('{"a":1}'))).resolves.toEqual({ a: 1 });
    await expect(readJsonResponse(reply("[1,2]"))).resolves.toEqual([1, 2]);
    await expect(readJsonResponse(reply("0"))).resolves.toBe(0);
    await expect(readJsonResponse(reply("<html>"))).rejects.toThrow("Invalid JSON response");
  });
});

describe("readApiError", () => {
  const failure = (body, init = {}) => reply(body, { ok: false, status: 400, ...init });

  test("JSON errors prefer error, then message, then the fallback", async () => {
    await expect(readApiError(failure({ error: "E", message: "M" }))).resolves.toBe("E");
    await expect(readApiError(failure({ message: "M" }))).resolves.toBe("M");
    await expect(readApiError(failure({}), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure({ error: "" }), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure(""), "Fallback")).resolves.toBe("Fallback");
    await expect(readApiError(failure("null"), "Fallback")).resolves.toBe("Fallback");
  });

  test("the default fallback names the HTTP status", async () => {
    await expect(readApiError(failure({}, { status: 418 }))).resolves.toBe("HTTP 418");
    await expect(readApiError(failure({}, { status: 418 }), "")).resolves.toBe("HTTP 418");
  });

  test("a JSON content type is recognised anywhere in the header", async () => {
    const headers = { "content-type": "application/json; charset=utf-8" };
    await expect(readApiError(failure({ error: "E" }, { headers }))).resolves.toBe("E");
  });

  test("non-JSON bodies are shown as text, cut to 200 characters", async () => {
    const headers = { "content-type": "text/plain" };
    await expect(readApiError(failure("Plain failure", { headers }))).resolves.toBe("Plain failure");
    await expect(readApiError(failure("x".repeat(300), { headers }))).resolves.toBe("x".repeat(200));
    await expect(readApiError(failure("", { headers }), "Fallback")).resolves.toBe("Fallback");
  });

  test("a response with no headers is treated as plain text", async () => {
    await expect(readApiError(failure("Boom", { noHeaders: true }))).resolves.toBe("Boom");
    const noGet = failure("Boom");
    noGet.headers = {};
    await expect(readApiError(noGet)).resolves.toBe("Boom");
  });

  test("unreadable bodies fall back instead of throwing", async () => {
    await expect(readApiError(failure("{bad", {}), "Fallback")).resolves.toBe("Fallback");
    const broken = failure("x", { headers: { "content-type": "text/plain" }, text: jest.fn().mockRejectedValue(new Error("gone")) });
    await expect(readApiError(broken, "Fallback")).resolves.toBe("Fallback");
  });
});

describe("apiGetJson", () => {
  test("sends a credentialed GET asking for JSON, and returns the parsed answer", async () => {
    global.fetch.mockResolvedValue(reply({ items: [1] }));
    await expect(apiGetJson("/api/list")).resolves.toEqual({ items: [1] });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/list");
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Accept")).toBe("application/json");
    expect(options.body).toBeUndefined();
  });

  test("the caller's options are respected, but the method is always GET", async () => {
    global.fetch.mockResolvedValue(reply({}));
    const signal = new AbortController().signal;
    await apiGetJson("/api/list", {
      method: "POST",
      credentials: "omit",
      signal,
      headers: { "X-Trace": "abc", Accept: "text/plain" },
    });
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe("GET");
    expect(options.credentials).toBe("omit");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("X-Trace")).toBe("abc");
    expect(options.headers.get("Accept")).toBe("text/plain");
  });

  test("an empty answer is null, and an error status throws the server's message", async () => {
    global.fetch.mockResolvedValueOnce(reply(""));
    await expect(apiGetJson("/api/list")).resolves.toBeNull();
    global.fetch.mockResolvedValueOnce(reply({ error: "Nope" }, { ok: false, status: 403 }));
    await expect(apiGetJson("/api/list")).rejects.toThrow("Nope");
    global.fetch.mockResolvedValueOnce(reply("", { ok: false, status: 502 }));
    await expect(apiGetJson("/api/list")).rejects.toThrow("HTTP 502");
  });
});

describe("apiPostJson", () => {
  test("sends a credentialed JSON POST", async () => {
    global.fetch.mockResolvedValue(reply({ ok: true }));
    await expect(apiPostJson("/api/search", { q: "lamp" })).resolves.toEqual({ ok: true });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/search");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Accept")).toBe("application/json");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.body).toBe('{"q":"lamp"}');
  });

  test("a missing or empty body is sent as an empty object", async () => {
    global.fetch.mockResolvedValue(reply({}));
    await apiPostJson("/api/x");
    await apiPostJson("/api/x", null);
    await apiPostJson("/api/x", undefined, {});
    for (const [, options] of global.fetch.mock.calls) expect(options.body).toBe("{}");
  });

  test("a falsy-but-real body is still sent as given only when it is an object", async () => {
    global.fetch.mockResolvedValue(reply({}));
    await apiPostJson("/api/x", []);
    expect(global.fetch.mock.calls[0][1].body).toBe("[]");
    await apiPostJson("/api/x", 0);
    expect(global.fetch.mock.calls[1][1].body).toBe("{}");
  });

  test("custom headers and credentials override the defaults; the method cannot be changed", async () => {
    global.fetch.mockResolvedValue(reply({}));
    const signal = new AbortController().signal;
    await apiPostJson("/api/x", { a: 1 }, {
      method: "DELETE",
      credentials: "same-origin",
      signal,
      headers: { "Content-Type": "application/vnd.api+json", "X-Trace": "abc" },
    });
    const options = global.fetch.mock.calls[0][1];
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("same-origin");
    expect(options.signal).toBe(signal);
    expect(options.headers.get("Content-Type")).toBe("application/vnd.api+json");
    expect(options.headers.get("X-Trace")).toBe("abc");
    expect(options.headers.get("Accept")).toBe("application/json");
  });

  test("failures throw the server's message", async () => {
    global.fetch.mockResolvedValue(reply({ message: "Bad input" }, { ok: false, status: 422 }));
    await expect(apiPostJson("/api/x", {})).rejects.toThrow("Bad input");
  });
});

describe("csrfPostJson", () => {
  test("goes through csrfFetch as a credentialed JSON POST by default", async () => {
    csrfFetch.mockResolvedValue(reply({ saved: true }));
    await expect(csrfPostJson("/api/save", { title: "Lamp" })).resolves.toEqual({ saved: true });
    expect(global.fetch).not.toHaveBeenCalled();
    const [url, options] = csrfFetch.mock.calls[0];
    expect(url).toBe("/api/save");
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers.get("Content-Type")).toBe("application/json");
    expect(options.body).toBe('{"title":"Lamp"}');
  });

  test("another mutating method can be requested", async () => {
    csrfFetch.mockResolvedValue(reply({}));
    await csrfPostJson("/api/save", {}, { method: "PUT" });
    await csrfPostJson("/api/save", {}, { method: "DELETE" });
    expect(csrfFetch.mock.calls.map(([, options]) => options.method)).toEqual(["PUT", "DELETE"]);
  });

  test("an empty body is an empty object, and failures throw the server's message", async () => {
    csrfFetch.mockResolvedValueOnce(reply({}));
    await csrfPostJson("/api/save");
    expect(csrfFetch.mock.calls[0][1].body).toBe("{}");
    csrfFetch.mockResolvedValueOnce(reply({ error: "Forbidden" }, { ok: false, status: 403 }));
    await expect(csrfPostJson("/api/save", {})).rejects.toThrow("Forbidden");
  });
});
