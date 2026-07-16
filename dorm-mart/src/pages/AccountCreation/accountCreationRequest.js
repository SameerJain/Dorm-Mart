import { API_BASE } from "../../utils/apiConfig";

export async function submitAccountRequest(formData, fetchImpl = fetch) {
  const response = await fetchImpl(`${API_BASE}/auth/create_account.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      gradMonth: formData.gradMonth,
      gradYear: formData.gradYear,
      email: formData.email.trim(),
      promos: formData.promos,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return response.ok
    ? { accepted: true }
    : { accepted: false, error: payload.error || "Unable to submit your request." };
}
