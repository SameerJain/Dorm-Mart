import {
  apiGetJson,
  csrfPostJson,
  readApiError,
  readJsonResponse,
} from "../utils/apiClient";
import { csrfFetch } from "../utils/csrfFetch";

jest.mock("../utils/csrfFetch", () => ({
  csrfFetch: jest.fn(),
}));

function response(body, init = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers || { "content-type": "application/json" }),
    text: jest.fn().mockResolvedValue(text),
  };
}

describe("apiClient adversarial boundaries", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    csrfFetch.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("readJsonResponse parses valid JSON and rejects malformed JSON deliberately", async () => {
    await expect(readJsonResponse(response({ ok: true }))).resolves.toEqual({
      ok: true,
    });
    await expect(readJsonResponse(response("{bad json"))).rejects.toThrow(
      "Invalid JSON response",
    );
  });

  test("readApiError prefers JSON error fields and falls back to non-JSON body text", async () => {
    await expect(
      readApiError(
        response({ error: "Specific failure" }, { ok: false, status: 400 }),
      ),
    ).resolves.toBe("Specific failure");

    await expect(
      readApiError(
        response("Plain failure", {
          ok: false,
          status: 500,
          headers: { "content-type": "text/plain" },
        }),
        "Fallback failure",
      ),
    ).resolves.toBe("Plain failure");
  });

  test("apiGetJson throws parsed API errors instead of leaking raw status handling", async () => {
    global.fetch.mockResolvedValueOnce(
      response({ message: "Nope" }, { ok: false, status: 403 }),
    );

    await expect(apiGetJson("/api/nope")).rejects.toThrow("Nope");
  });

  test("csrfPostJson sends a JSON CSRF request and returns parsed JSON", async () => {
    csrfFetch.mockResolvedValueOnce(response({ success: true }));

    await expect(csrfPostJson("/api/save", { title: "Lamp" })).resolves.toEqual(
      { success: true },
    );

    expect(csrfFetch).toHaveBeenCalledWith(
      "/api/save",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title: "Lamp" }),
      }),
    );
  });
});
