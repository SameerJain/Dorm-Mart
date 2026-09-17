<?php
declare(strict_types=1);

function login_ip_scope(string $ip): string
{
    if (str_starts_with(strtolower($ip), '::ffff:')) $ip = substr($ip, 7);
    if (!filter_var($ip, FILTER_VALIDATE_IP)) return 'unknown';
    if ($ip === '::1' || str_starts_with($ip, '127.')) return 'local';
    return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)
        ? 'public' : 'private';
}

function fetch_login_ip_location(string $ip): ?array
{
    if (!function_exists('curl_init')) {
        error_log('login location lookup skipped: curl extension is not available');
        return null;
    }
    // Only the public IP is sent, never account or session information.
    $curl = curl_init('https://ipwho.is/' . $ip . '?fields=success,city,region,country');
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT_MS => 1500,
        CURLOPT_TIMEOUT_MS => 2500,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
    ]);
    $body = curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    $curlError = curl_errno($curl) !== 0 ? curl_error($curl) : null;
    curl_close($curl);
    if ($curlError !== null) {
        error_log("login location lookup curl error: $curlError");
        return null;
    }
    if ($status !== 200 || !is_string($body)) {
        error_log("login location lookup failed: unexpected HTTP status $status");
        return null;
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        error_log('login location lookup failed: could not decode provider response');
        return null;
    }
    return $data;
}

function login_ip_location(string $ip, ?callable $lookup = null): ?string
{
    if (login_ip_scope($ip) !== 'public') return null;
    $cached = $_SESSION['login_location_cache'][$ip] ?? null;
    if ($cached && $cached['expires'] > time()) return $cached['location'];

    // Bound lookup latency even when opening a long history with missing locations.
    static $lookups = 0;
    if ($lookups >= 3) return null;
    $lookups++;
    $data = ($lookup ?? 'fetch_login_ip_location')($ip);
    $location = null;
    if (($data['success'] ?? false) === true) {
        $parts = [];
        foreach (['city', 'region', 'country'] as $key) {
            if (!is_string($data[$key] ?? null)) continue;
            $part = trim(str_replace(["\0", "\r", "\n", "\t"], '', $data[$key]));
            if ($part !== '') $parts[] = substr($part, 0, 80);
        }
        if ($parts) $location = substr(implode(', ', array_unique($parts)), 0, 160);
    }
    $_SESSION['login_location_cache'][$ip] = [
        'location' => $location,
        'expires' => time() + ($location === null ? 300 : 86400),
    ];
    $_SESSION['login_location_cache'] = array_slice($_SESSION['login_location_cache'], -50, null, true);
    return $location;
}
