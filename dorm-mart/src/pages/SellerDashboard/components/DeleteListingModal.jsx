import { ConfirmDialog } from "../../../components/Dialog";

/** Confirms deleting one of the seller's listings. */
export default function DeleteListingModal({ onClose, onDelete, busy = false, error = "" }) {
  return (
    <ConfirmDialog
      title="Delete this listing?"
      description={
        <p>
          It comes down right away, open chats about it are closed, and anyone
          who saved it is told. This can't be undone.
        </p>
      }
      error={error}
      busy={busy}
      confirmLabel="Delete"
      busyLabel="Deleting…"
      onConfirm={onDelete}
      onCancel={onClose}
    />
  );
}
