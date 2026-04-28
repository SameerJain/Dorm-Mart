import { useEffect, useState } from "react";
import { API_BASE } from "../utils/apiConfig";

export function useEmailPolicy() {
  const [allowAllEmails, setAllowAllEmails] = useState(false);
  const [emailPolicyLoading, setEmailPolicyLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadEmailPolicy() {
      try {
        const response = await fetch(`${API_BASE}/config/email_policy.php`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!active || !response.ok) return;

        const data = await response.json();
        if (data.ok) {
          setAllowAllEmails(Boolean(data.allowAllEmails));
        }
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Failed to fetch email policy:", error);
        }
      } finally {
        if (active) {
          setEmailPolicyLoading(false);
        }
      }
    }

    loadEmailPolicy();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { allowAllEmails, emailPolicyLoading };
}
