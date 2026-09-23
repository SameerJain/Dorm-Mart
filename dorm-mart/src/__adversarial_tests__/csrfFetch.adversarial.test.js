import { clearCsrfToken, csrfFetch } from "../utils/csrfFetch";

function jsonResponse(body, init = {}) {
  const response = {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers || { "content-type": "application/json" }),
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
  response.clone = () => jsonResponse(body, init);
  return response;
}

describe("csrfFetch adversarial boundaries", () => {
  beforeEach(() => {
    clearCsrfToken();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    clearCsrfToken();
    jest.restoreAllMocks();
  });

  test("reports malformed JSON request bodies with a deliberate boundary error", async () => {
    global.fetch.mockResolvedValueOnce(jsonResponse({ csrf_token: "token-1" }));

    await expect(
      csrfFetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"broken"',
      }),
    ).rejects.toThrow("Invalid JSON request body");

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("refreshes the CSRF token once after a mutating request is rejected for CSRF", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "stale-token" }))
      .mockResolvedValueOnce(
        jsonResponse({ error: "CSRF token validation failed", code: "csrf_invalid" }, { ok: false, status: 403 }),
      )
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "fresh-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const response = await csrfFetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Lamp" }),
    });

    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(global.fetch.mock.calls[1][1].body).toContain("stale-token");
    expect(global.fetch.mock.calls[3][1].body).toContain("fresh-token");
  });

  test("does not retry a 403 that is a permission denial rather than a CSRF failure", async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ csrf_token: "token-1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "Forbidden" }, { ok: false, status: 403 }));

    const response = await csrfFetch("/api/moderation/ban_user.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: 7 }),
    });

    expect(response.status).toBe(403);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
