import { ConfirmDialog } from "../../../components/Dialog";

/**
 * Confirms hiding a conversation from the current user's list. The server
 * (delete_conversation.php) only hides it for this user; messages, scheduled
 * purchases and the other person's copy are untouched, and a new message from
 * the other person brings it back.
 */
export default function DeleteConversationModal({
  deleteError,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  return (
    <ConfirmDialog
      title="Remove this conversation?"
      description={
        <>
          <p>It will be removed from your chat list only.</p>
          <p>
            The other person keeps the conversation, and any scheduled
            purchase stays as it is. If they send you a new message, the
            conversation comes back.
          </p>
        </>
      }
      error={deleteError}
      busy={isDeleting}
      confirmLabel="Remove"
      busyLabel="Removing…"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
