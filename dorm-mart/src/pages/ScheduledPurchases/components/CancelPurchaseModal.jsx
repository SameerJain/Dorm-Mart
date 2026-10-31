import { ConfirmDialog } from "../../../components/Dialog";

export default function CancelPurchaseModal({
  actionError,
  busyRequestId,
  pendingCancelRequestId,
  onClose,
  onConfirm,
}) {
  return (
    <ConfirmDialog
      title="Cancel Scheduled Purchase?"
      description="Are you sure you want to cancel? This action cannot be undone."
      error={actionError}
      busy={busyRequestId === pendingCancelRequestId}
      confirmLabel="Yes, Cancel"
      busyLabel="Cancelling..."
      cancelLabel="No, Keep It"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
