import { useEffect, useState } from "react";
import { onProductImageError } from "../../../utils/imageFallback";

export default function ProductImageGallery({ photoUrls = [], title }) {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    setActiveIdx(0);
  }, [photoUrls.length]);

  const hasPhotos = photoUrls.length > 0;
  const hasMultiplePhotos = photoUrls.length > 1;
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < photoUrls.length - 1;

  return (
    <section className="flex gap-3 items-start justify-center lg:sticky lg:top-20">
      {hasMultiplePhotos ? (
        <div className="hidden md:flex md:flex-col gap-2 md:max-h-[32rem] overflow-y-auto pr-1">
          {photoUrls.map((url, idx) => (
            <GalleryThumb
              key={`thumb-${idx}`}
              url={url}
              idx={idx}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
            />
          ))}
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm w-full max-w-[28rem] md:max-w-[32rem] aspect-square mx-auto overflow-hidden relative">
        {hasPhotos ? (
          <img
            alt={title}
            src={photoUrls[activeIdx]}
            onError={onProductImageError}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            No image
          </div>
        )}

        {hasMultiplePhotos ? (
          <>
            <button
              onClick={() =>
                hasPrev && setActiveIdx((idx) => Math.max(0, idx - 1))
              }
              disabled={!hasPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
              aria-label="Previous image"
            >
              &lsaquo;
            </button>
            <button
              onClick={() =>
                hasNext &&
                setActiveIdx((idx) => Math.min(photoUrls.length - 1, idx + 1))
              }
              disabled={!hasNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 dark:bg-gray-700/80 hover:bg-white dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-full h-9 w-9 flex items-center justify-center disabled:opacity-40"
              aria-label="Next image"
            >
              &rsaquo;
            </button>
          </>
        ) : null}
      </div>

      {hasMultiplePhotos ? (
        <div className="md:hidden absolute -bottom-12 left-0 right-0 flex gap-2 justify-center">
          {photoUrls.map((url, idx) => (
            <GalleryThumb
              key={`thumb-sm-${idx}`}
              url={url}
              idx={idx}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
              small
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function GalleryThumb({ url, idx, activeIdx, onSelect, small = false }) {
  const sizeClass = small ? "h-12 w-12" : "h-16 w-16";
  const activeClass =
    idx === activeIdx
      ? "border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-700"
      : "border-gray-200 dark:border-gray-700";

  return (
    <button
      onClick={() => onSelect(idx)}
      className={`${sizeClass} rounded-md overflow-hidden border bg-white dark:bg-gray-800 ${activeClass}`}
    >
      <img
        src={url}
        alt={`thumb-${idx}`}
        onError={onProductImageError}
        className="h-full w-full object-cover"
      />
    </button>
  );
}
