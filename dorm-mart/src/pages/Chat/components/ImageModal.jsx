import React, { useEffect, useRef, useState, useCallback } from "react";

export default function ImageModal({
  open,
  onClose,
  onSelect,
  title = "Add image",
}) {
  const closeBtnRef = useRef(null);
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null); // blob URL for quick preview

  // Clear local selection + preview (so nothing shows next time)
  const resetPicker = useCallback(() => {
    setFile(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old); // release blob URL
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = ""; // allow re-selecting same file
  }, []);

  // Centralized close: reset first, then bubble up
  const handleClose = useCallback(() => {
    resetPicker();
    onClose?.();
  }, [resetPicker, onClose]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  if (!open) return null;

  function openPicker() {
    if (fileInputRef.current) fileInputRef.current.value = ""; // ensures change fires for same file
    fileInputRef.current?.click();
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) return; // ignore non-images

    setFile(f);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f); // local preview
    });
  }

  function confirm() {
    // Send file up, then reset + close so preview disappears immediately
    onSelect?.(file);
    handleClose();
  }

  const labelledBy = "image-modal-title";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 p-4 flex items-center justify-center"
      onClick={handleClose}                            /* close on backdrop */
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="w-full max-w-sm rounded-2xl border-2 border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}           /* keep clicks inside */
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 id={labelledBy} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            ref={closeBtnRef}
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"                             /* only images */
            className="hidden"
            onChange={onFileChange}
          />

          {/* Taller preview area */}
          <div className="h-56 sm:h-72 max-h-[65vh] rounded-lg border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900/30">
            {previewUrl ? (
              <img src={previewUrl} alt="Selected preview" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">No image selected</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openPicker}                        /* open OS picker */
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Upload photo
            </button>

            <button
              type="button"
              onClick={confirm}                           /* send + reset + close */
              disabled={!file}
              className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Use image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
