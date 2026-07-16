import { csrfFetch } from "./csrfFetch";

function mergeHeaders(baseHeaders, nextHeaders) {
  const headers = new Headers(baseHeaders);
  new Headers(nextHeaders || {}).forEach((value, key) => {
    headers.set(key, value);
  });
  return headers;
}

export async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response");
  }
}

export async function readApiError(response, fallbackMessage) {
  const fallback = fallbackMessage || `HTTP ${response.status}`;
  const contentType = response.headers?.get?.("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const payload = await readJsonResponse(response);
      return payload?.error || payload?.message || fallback;
    }

    const text = await response.text();
    return text ? text.substring(0, 200) : fallback;
  } catch {
    return fallback;
  }
}

export async function apiGetJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    method: "GET",
    credentials: options.credentials || "include",
    headers: mergeHeaders({ Accept: "application/json" }, options.headers),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return readJsonResponse(response);
}

export async function csrfPostJson(url, body = {}, options = {}) {
  const response = await csrfFetch(url, {
    ...options,
    method: options.method || "POST",
    credentials: options.credentials || "include",
    headers: mergeHeaders(
      {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      options.headers,
    ),
    body: JSON.stringify(body || {}),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return readJsonResponse(response);
}
