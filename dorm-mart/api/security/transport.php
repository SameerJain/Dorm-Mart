<?php
// Transport-level policy shared by router.php and the API. Kept free of
// dependencies so the router can load it before any app config.

// Only explicitly configured peers may supply forwarding headers. Never trust
// all private addresses: other hosts on that network are not necessarily proxies.
function request_from_trusted_proxy(): bool
{
    $remote = @inet_pton((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    if ($remote === false) return false;
    foreach (explode(',', (string)getenv('TRUSTED_PROXY_IPS')) as $entry) {
        $parts = explode('/', trim($entry), 2);
        $network = @inet_pton($parts[0]);
        if ($network === false || strlen($network) !== strlen($remote)) continue;
        $bits = $parts[1] ?? (string)(strlen($network) * 8);
        if (!ctype_digit($bits) || (int)$bits > strlen($network) * 8) continue;
        $bytes = intdiv((int)$bits, 8);
        $remaining = (int)$bits % 8;
        if (substr($remote, 0, $bytes) !== substr($network, 0, $bytes)) continue;
        if ($remaining && ((ord($remote[$bytes]) ^ ord($network[$bytes])) & (255 << (8 - $remaining)))) continue;
        return true;
    }
    return false;
}

function request_client_ip(): string
{
    $remote = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    if (request_from_trusted_proxy()) {
        // The configured edge must append or overwrite the connecting client's
        // address. Earlier entries may have been supplied by the client itself.
        $chain = explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
        $forwarded = trim((string)end($chain));
        if (filter_var($forwarded, FILTER_VALIDATE_IP)) return inet_ntop(inet_pton($forwarded));
    }
    return filter_var($remote, FILTER_VALIDATE_IP) ? inet_ntop(inet_pton($remote)) : 'unknown';
}

function is_https_request(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (request_from_trusted_proxy()
            && strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''))) === 'https');
}

function security_csp_header(): string
{
    // Stripe.js/Payment Element and Link require these specific origins.
    // https://docs.stripe.com/security/guide#content-security-policy
    // img-src keeps https: because seeded listings reference externally hosted photos.
    return "default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com; frame-src https://challenges.cloudflare.com https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' https://challenges.cloudflare.com https://api.stripe.com https://link.com https://*.link.com; frame-ancestors 'none';";
}
