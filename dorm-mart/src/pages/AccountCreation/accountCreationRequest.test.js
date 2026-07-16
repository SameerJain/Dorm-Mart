import { submitAccountRequest } from "./accountCreationRequest";

const formData = {
  firstName: "Test",
  lastName: "User",
  gradMonth: 5,
  gradYear: 2027,
  email: "test@example.com",
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
