import { renderHook, waitFor } from "@testing-library/react";
import useCategories from "./useCategories";

const reply = (status, body) =>
  Promise.resolve({
    ok: status < 400,
    status,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
  });

afterEach(() => jest.restoreAllMocks());

test("loads the category list", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(200, ["Books", "Kitchen"]));
  const { result } = renderHook(() => useCategories());

  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.categories).toEqual(["Books", "Kitchen"]);
  expect(result.current.error).toBeNull();
});

test("reports a response that is not a list", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(200, { ok: true }));
  const { result } = renderHook(() => useCategories());

  await waitFor(() => expect(result.current.error).toBe("Invalid categories format"));
  expect(result.current.categories).toEqual([]);
});

test("reports the server's error message", async () => {
  jest.spyOn(global, "fetch").mockReturnValue(reply(500, { error: "Server error" }));
  const { result } = renderHook(() => useCategories());

  await waitFor(() => expect(result.current.error).toBe("Server error"));
  expect(result.current.loading).toBe(false);
});
