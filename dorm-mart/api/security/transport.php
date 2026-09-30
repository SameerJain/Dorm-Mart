<?php
// Transport-level policy shared by router.php and the API. Kept free of
// dependencies so the router can load it before any app config.

function is_https_request(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

function security_csp_header(): string
{
    // connect-src: the app only talks to its own API (chat is HTTP polling; the
    // WebSocket experiment is retired) plus Cloudflare Turnstile. A bare `wss:`
    // would let injected script stream data to any host.
    // img-src keeps https: because seeded listings reference externally hosted photos.
    return "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://challenges.cloudflare.com; frame-ancestors 'none';";
}
