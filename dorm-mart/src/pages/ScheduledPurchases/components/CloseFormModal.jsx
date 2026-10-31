import { ConfirmDialog } from "../../../components/Dialog";

export default function CloseFormModal({ onClose, onConfirm }) {
  return (
    <ConfirmDialog
      title="Close This Form?"
      description="Are you sure you want to close? All information you've entered will be lost."
      confirmLabel="Close"
      cancelLabel="Stay"
      onConfirm={onConfirm}
      onCancel={onClose}
    />
  );
}
