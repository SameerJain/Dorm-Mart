import { useState } from "react";
import { API_BASE } from "../../../utils/apiConfig";
import { csrfFetch } from "../../../utils/csrfFetch";
import ReportMessageModal, {
  MESSAGE_REPORT_REASONS,
} from "../components/ReportMessageModal";

/**
 * Report + delete state for one message. Actions live in the message's ⋯ menu;
 * this only surfaces a short status line after the user does something.
 */
export default function useMessageActionState(messageId, onDelete) {
  const [reportState, setReportState] = useState("idle"); // idle | confirming | reporting | reported | failed
  const [deleteState, setDeleteState] = useState("idle"); // idle | confirming | deleting | failed
  const [deleteError, setDeleteError] = useState("");
  async function report(reason) {
    setReportState("reporting");
    try {
      const response = await csrfFetch(`${API_BASE}/moderation/report_message.php`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason ? { message_id: messageId, reason } : { message_id: messageId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Unable to report message");
      setReportState("reported");
    } catch (_) {
      setReportState("failed");
    }
  }

  async function remove() {
    setDeleteState("deleting");
    setDeleteError("");
    try {
      await onDelete(messageId);
      // The message re-renders as a "deleted" placeholder, unmounting this state.
    } catch (err) {
      setDeleteError(err?.message || "");
      setDeleteState("failed");
    }
  }

  const reported = reportState === "reported";
  const reportAction = {
    key: "report",
    label: reported ? "Reported" : reportState === "failed" ? "Retry report" : "Report message",
    icon: "report",
    danger: true,
    disabled: reported || reportState === "reporting",
    onSelect: () => setReportState("confirming"),
  };

  const deleteAction = onDelete && {
    key: "delete",
    label: deleteState === "failed" ? "Retry delete" : "Delete message",
    icon: "trash",
    danger: true,
    disabled: deleteState === "deleting",
    onSelect: () => setDeleteState("confirming"),
  };

  const status =
    deleteState === "failed"
      ? deleteError && deleteError !== "Internal server error"
        ? `Couldn't delete the message: ${deleteError}`
        : "Couldn't delete the message. Try again from the message menu."
      : reported
        ? "Reported · a moderator will review it"
        : reportState === "failed"
          ? "Couldn't send the report. Try again from the message menu."
          : "";

  const modal =
    reportState === "confirming" || reportState === "reporting" ? (
      <ReportMessageModal
        isReporting={reportState === "reporting"}
        reasons={MESSAGE_REPORT_REASONS}
        onCancel={() => setReportState("idle")}
        onConfirm={report}
      />
    ) : deleteState === "confirming" || deleteState === "deleting" ? (
      <ReportMessageModal
        title="Delete message?"
        body="This message will be removed for both of you and replaced with a note that it was deleted."
        confirmLabel="Delete"
        busyLabel="Deleting..."
        isReporting={deleteState === "deleting"}
        onCancel={() => setDeleteState("idle")}
        onConfirm={() => remove()}
      />
    ) : null;

  const statusIsError = reportState === "failed" || deleteState === "failed";
  return { reportAction, deleteAction, status, statusIsError, modal };
}
