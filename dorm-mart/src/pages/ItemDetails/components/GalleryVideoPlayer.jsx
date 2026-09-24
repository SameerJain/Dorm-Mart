import { useEffect, useRef, useState } from "react";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * Listing video with site-styled controls in place of the browser's black
 * player chrome: a soft letterbox, a blue play button, and a light control bar.
 */
export default function GalleryVideoPlayer({ src, label }) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Pause when the gallery unmounts this slide mid-playback.
  useEffect(() => {
    const video = videoRef.current;
    return () => video?.pause();
  }, []);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function seek(event) {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(event.target.value);
    video.currentTime = next;
    setCurrentTime(next);
  }

  function toggleFullscreen() {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else if (wrapper?.requestFullscreen) {
      wrapper.requestFullscreen().catch(() => {});
    } else {
      // iOS Safari only allows the video element itself to go fullscreen.
      video?.webkitEnterFullscreen?.();
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      className="group relative h-full w-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900"
    >
      <video
        ref={videoRef}
        src={src}
        aria-label={label}
        preload="metadata"
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        className="h-full w-full object-contain cursor-pointer bg-transparent"
      />

      {!playing ? (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white shadow-lg ring-4 ring-white/70 dark:ring-gray-900/60 transition duration-150 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-blue-300/70"
        >
          <svg className="h-7 w-7 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.5-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" />
          </svg>
        </button>
      ) : null}

      <div
        className={`absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg border border-gray-200/80 dark:border-gray-700/80 bg-white/90 dark:bg-gray-800/90 px-2 py-1.5 shadow-sm backdrop-blur-sm transition-opacity duration-200 ${
          playing ? "mouse:opacity-0 group-hover:opacity-100 focus-within:opacity-100" : "opacity-100"
        }`}
      >
        <ControlButton label={playing ? "Pause video" : "Play video"} onClick={togglePlay}>
          {playing ? (
            <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" stroke="none" />
          ) : (
            <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.5-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" fill="currentColor" stroke="none" />
          )}
        </ControlButton>

        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-9 text-right">
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          onChange={seek}
          aria-label="Seek video"
          className="flex-1 h-1.5 min-w-0 cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-track]:bg-transparent"
          style={{
            background: `linear-gradient(to right, rgb(37 99 235) ${progress}%, rgb(209 213 219 / 0.9) ${progress}%)`,
          }}
        />

        <span className="text-xs tabular-nums text-gray-600 dark:text-gray-300 w-9">
          {formatTime(duration)}
        </span>

        <ControlButton label={muted ? "Unmute video" : "Mute video"} onClick={toggleMute}>
          <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" stroke="none" />
          {muted ? (
            <path d="m16 9 5 6m0-6-5 6" />
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
          )}
        </ControlButton>

        <ControlButton label="Toggle fullscreen" onClick={toggleFullscreen}>
          <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 shrink-0 rounded-md flex items-center justify-center text-gray-700 dark:text-gray-200 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-gray-700 dark:hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}
