import { useState } from "react";
import Dialog from "../../../components/Dialog";
import GalleryVideoPlayer from "../../ItemDetails/components/GalleryVideoPlayer";
import { API_BASE } from "../../../utils/apiConfig";
import { resolveStoredImageUrl } from "../../../utils/imageFallback";
import { withFirstFrame } from "../../../utils/videoSrc";

export default function ReviewVideo({ url }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <div className="mb-6">
      <button type="button" onClick={() => setOpen(true)}
        className="rounded-lg border border-blue-300 px-4 py-2 font-medium text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-gray-700">
        Play review video
      </button>
      {open && <Dialog onClose={() => setOpen(false)} title="Review video" className="max-w-3xl">
        <div className="h-[min(60vh,28rem)] w-full overflow-hidden rounded-lg">
          <GalleryVideoPlayer src={withFirstFrame(resolveStoredImageUrl(url, API_BASE))} label="Product review video" />
        </div>
        <button type="button" onClick={() => setOpen(false)} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">Close video</button>
      </Dialog>}
    </div>
  );
}
