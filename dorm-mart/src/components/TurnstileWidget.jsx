import { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileScript = null;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => {
        turnstileScript = null; // let a later render retry the download
        reject(new Error("Turnstile failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return turnstileScript;
}

// Cloudflare Turnstile check. Tokens are single-use, so the parent bumps
// `resetKey` after each submit to render a fresh widget.
function TurnstileWidget({ siteKey, resetKey, onToken, onLoadError }) {
  const containerRef = useRef(null);
  const callbacksRef = useRef({ onToken, onLoadError });

  useEffect(() => {
    callbacksRef.current = { onToken, onLoadError };
  }, [onToken, onLoadError]);

  useEffect(() => {
    let widgetId = null;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "light",
          callback: (token) => callbacksRef.current.onToken(token),
          "expired-callback": () => callbacksRef.current.onToken(""),
          "error-callback": () => callbacksRef.current.onToken(""),
        });
      })
      .catch(() => {
        if (!cancelled) callbacksRef.current.onLoadError?.();
      });

    return () => {
      cancelled = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, resetKey]);

  return <div ref={containerRef} className="flex justify-center min-h-[65px]" />;
}

export default TurnstileWidget;
