import { useEffect, useRef, useState } from "react";
import {
  isVideoMediaUrl,
  onProductImageError,
} from "../../../utils/imageFallback";

export default function ProductImageGallery({ photoUrls = [], title }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const touchStart = useRef(null);
  // iPadOS can identify itself as a Mac. Touch support alone also matches PCs.
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  function handleTouchEnd(event) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    setActiveIdx((idx) => Math.max(0, Math.min(photoUrls.length - 1, idx + (dx < 0 ? 1 : -1))));
  }

  useEffect(() => {
    setActiveIdx(0);
  }, [photoUrls.length]);

  const hasPhotos = photoUrls.length > 0;
  const hasMultiplePhotos = photoUrls.length > 1;
  const hasPrev = activeIdx > 0;
  const hasNext = activeIdx < photoUrls.length - 1;

  return (
    <section className={`flex gap-3 items-start justify-center lg:sticky lg:top-20 ${isMobileDevice ? "flex-col" : ""}`}>
      {hasMultiplePhotos && !isMobileDevice ? (
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

      <div
        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200/70 dark:border-gray-700/70 shadow-sm w-full max-w-[28rem] md:max-w-[32rem] aspect-square mx-auto overflow-hidden relative"
        style={isMobileDevice && hasMultiplePhotos ? { touchAction: "pan-y pinch-zoom" } : undefined}
        onTouchStart={(event) => {
          touchStart.current = isMobileDevice && hasMultiplePhotos && event.touches.length === 1
            ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
            : null;
        }}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStart.current = null; }}
      >
        {hasPhotos ? (
          <GalleryMedia url={photoUrls[activeIdx]} alt={title} controls />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-400 dark:text-gray-500">
            No image
          </div>
        )}

        {hasMultiplePhotos && !isMobileDevice ? (
          <>
            <GalleryArrowButton
              direction="previous"
              onClick={() =>
                hasPrev && setActiveIdx((idx) => Math.max(0, idx - 1))
              }
              disabled={!hasPrev}
            />
            <GalleryArrowButton
              direction="next"
              onClick={() =>
                hasNext &&
                setActiveIdx((idx) => Math.min(photoUrls.length - 1, idx + 1))
              }
              disabled={!hasNext}
            />
          </>
        ) : null}
      </div>

      {hasMultiplePhotos && isMobileDevice ? (
        <div className="flex flex-wrap justify-center w-full" aria-label="Media navigation">
          {photoUrls.map((url, idx) => (
            <button
              key={`dot-${idx}`}
              type="button"
              aria-label={`Show media ${idx + 1}`}
              aria-current={idx === activeIdx ? "true" : undefined}
              onClick={() => setActiveIdx(idx)}
              className="h-11 w-11 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <span className={`h-3 w-3 rounded-full ${idx === activeIdx ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`} />
            </button>
          ))}
        </div>
      ) : hasMultiplePhotos ? (
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

function GalleryArrowButton({ direction, onClick, disabled }) {
  if (disabled) return null;
  const isPrevious = direction === "previous";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute ${isPrevious ? "left-2" : "right-2"} top-1/2 -translate-y-1/2 h-12 w-12 p-0 rounded-full flex items-center justify-center bg-gray-950/75 hover:bg-blue-600 text-white shadow-lg backdrop-blur-sm transition duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300/70`}
      aria-label={`${isPrevious ? "Previous" : "Next"} media`}
    >
      <svg
        className="h-10 w-10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={isPrevious ? "m15 18-6-6 6-6" : "m9 6 6 6-6 6"} />
      </svg>
    </button>
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
      <GalleryMedia url={url} alt={`thumb-${idx}`} />
    </button>
  );
}

function GalleryMedia({ url, alt, controls = false }) {
  if (isVideoMediaUrl(url)) {
    return (
      <video
        src={url}
        aria-label={alt}
        controls={controls}
        muted={!controls}
        preload="metadata"
        className="h-full w-full object-contain"
      />
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      onError={onProductImageError}
      className={`h-full w-full ${controls ? "object-contain" : "object-cover"}`}
    />
  );
}
