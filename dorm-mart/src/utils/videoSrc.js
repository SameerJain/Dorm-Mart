/**
 * iOS Safari leaves a <video preload="metadata"> blank until it plays. Asking
 * for a start time just past zero makes it decode and show the first frame,
 * which gives thumbnails and chat bubbles a picture without a poster file.
 */
export function withFirstFrame(url) {
  if (typeof url !== "string" || url === "" || url.includes("#")) return url;
  return `${url}#t=0.001`;
}
