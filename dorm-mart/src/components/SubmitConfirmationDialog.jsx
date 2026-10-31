import { ConfirmDialog } from "./Dialog";

export default function SubmitConfirmationDialog({
  isOpen,
  message,
  onCancel,
  onConfirm,
}) {
  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!onConfirm) return onCancel();
    try {
      await onConfirm();
    } catch (_) {
      onCancel();
    }
  };

  // Opens over the review and rating modals, so it needs the higher layer.
  return (
    <ConfirmDialog
      title="Ready to Submit?"
      description={<p className="break-words">{message}</p>}
      tone="primary"
      onConfirm={handleConfirm}
      onCancel={onCancel}
      layerClassName="z-[70]"
    />
  );
}
