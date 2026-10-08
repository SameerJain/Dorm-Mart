import { useEffect } from "react";

// Overlays can stack: a page locks scroll for its modal while the shared Dialog
// inside it locks too. Only the first lock touches the page and only the last
// release restores it. A second lock would otherwise read scrollY as 0 from the
// already-fixed body, so the page would jump to the top.
let activeLocks = 0;
let restore = null;

function lockPage() {
  const root = document.documentElement.style;
  const body = document.body.style;
  const scrollY = window.scrollY;
  const previous = {
    rootOverflow: root.overflow,
    overflow: body.overflow,
    position: body.position,
    top: body.top,
    width: body.width,
  };
  root.overflow = "hidden";
  body.overflow = "hidden";
  body.position = "fixed";
  body.top = `-${scrollY}px`;
  body.width = "100%";
  restore = () => {
    root.overflow = previous.rootOverflow;
    body.overflow = previous.overflow;
    body.position = previous.position;
    body.top = previous.top;
    body.width = previous.width;
    window.scrollTo(0, scrollY);
  };
}

export function useBodyScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return undefined;
    if (activeLocks === 0) lockPage();
    activeLocks += 1;
    return () => {
      activeLocks -= 1;
      if (activeLocks === 0 && restore) {
        restore();
        restore = null;
      }
    };
  }, [isLocked]);
}
