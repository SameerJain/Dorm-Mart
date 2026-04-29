import { API_BASE } from "./apiConfig";

let csrfTokenPromise = null;

export async function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_BASE}/auth/get_csrf_token.php`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.csrf_token) {
          throw new Error(data.error || "Unable to get CSRF token");
        }
        return data.csrf_token;
      })
      .catch((error) => {
        csrfTokenPromise = null;
        throw error;
      });
  }

  return csrfTokenPromise;
}

export function clearCsrfToken() {
  csrfTokenPromise = null;
}

function withCsrfToken(options, method, token) {
  const nextOptions = { ...options, method };

  if (nextOptions.body instanceof FormData) {
    const form = new FormData();
    nextOptions.body.forEach((value, key) => form.append(key, value));
    form.set("csrf_token", token);
    nextOptions.body = form;
    return nextOptions;
  }

  const headers = new Headers(nextOptions.headers || {});
  const contentType = headers.get("Content-Type") || "";

  if (!nextOptions.body || contentType.includes("application/json")) {
    headers.set("Content-Type", "application/json");
    let payload = {};
    if (nextOptions.body) {
      payload =
        typeof nextOptions.body === "string"
          ? JSON.parse(nextOptions.body)
          : nextOptions.body;
    }
    nextOptions.body = JSON.stringify({ ...payload, csrf_token: token });
    nextOptions.headers = headers;
  }

  return nextOptions;
}

export async function csrfFetch(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return fetch(url, options);
  }

  const token = await getCsrfToken();
  const response = await fetch(url, withCsrfToken(options, method, token));
  if (response.status !== 403) {
    return response;
  }

  clearCsrfToken();
  const freshToken = await getCsrfToken();
  return fetch(url, withCsrfToken(options, method, freshToken));
}
