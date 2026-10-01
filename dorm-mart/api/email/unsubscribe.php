<?php
declare(strict_types=1);

// One-click unsubscribe from promotional digests (linked from each digest and
// from its List-Unsubscribe header).
//
//   GET  ?token=...  shows a confirmation button. Link scanners in mail
//                    systems fetch URLs, so a GET must never unsubscribe.
//   POST ?token=...  turns promotional email off. Mail clients send this for
//                    RFC 8058 one-click ("List-Unsubscribe=One-Click" body).
//
// The signed token is the credential, so no session or CSRF token is needed,
// and the page does not go through the credentialed-API CORS gate.

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../database/db_connect.php';
require_once __DIR__ . '/../helpers/promo_unsubscribe.php';

dm_enforce_https();
set_security_headers();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');

function unsubscribe_page(string $heading, string $body, string $extra = '', int $status = 200): void
{
    http_response_code($status);
    $settingsUrl = htmlspecialchars(dm_frontend_url('app/setting/user-preferences'), ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>' . htmlspecialchars($heading, ENT_QUOTES, 'UTF-8') . ' | Dorm Mart</title></head>'
        . '<body style="margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;">'
        . '<main style="max-width:480px;margin:10vh auto;padding:32px;background:#1e293b;border-radius:16px;">'
        . '<h1 style="margin-top:0;font-size:22px;">' . htmlspecialchars($heading, ENT_QUOTES, 'UTF-8') . '</h1>'
        . '<p style="line-height:1.5;">' . htmlspecialchars($body, ENT_QUOTES, 'UTF-8') . '</p>'
        . $extra
        . '<p style="margin-top:24px;font-size:14px;color:#94a3b8;">You can also manage email in '
        . '<a href="' . $settingsUrl . '" style="color:#38bdf8;">User Preferences</a>.</p>'
        . '</main></body></html>';
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$token = is_string($_GET['token'] ?? null) ? trim($_GET['token']) : '';
$userId = promo_unsubscribe_verify($token, promo_unsubscribe_secret());

if ($userId === null) {
    unsubscribe_page(
        'Link not valid',
        "This unsubscribe link isn't valid. Sign in and change promotional emails in your preferences instead.",
        '',
        400
    );
}

if ($method === 'GET') {
    $action = htmlspecialchars('?token=' . rawurlencode($token), ENT_QUOTES, 'UTF-8');
    unsubscribe_page(
        'Stop promotional emails?',
        "You'll stop getting Dorm Mart's listing digests. Account and security emails still arrive.",
        '<form method="post" action="' . $action . '">'
        . '<button type="submit" style="padding:10px 18px;border:0;border-radius:8px;background:#38bdf8;color:#0f172a;font-weight:700;cursor:pointer;">Unsubscribe</button>'
        . '</form>'
    );
}

if ($method !== 'POST') {
    header('Allow: GET, POST');
    unsubscribe_page('Not allowed', 'This page only accepts GET and POST.', '', 405);
}

try {
    $conn = db();
    $stmt = $conn->prepare("UPDATE user_accounts SET promotional = 0, promo_frequency = 'off' WHERE user_id = ?");
    if (!$stmt) {
        throw new RuntimeException('prepare failed');
    }
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->close();
    $conn->close();
} catch (Throwable $e) {
    error_log('promo unsubscribe failed: ' . $e->getMessage());
    unsubscribe_page('Something went wrong', "We couldn't update your preferences. Please try again later.", '', 500);
}

unsubscribe_page(
    "You're unsubscribed",
    "You won't get promotional listing emails anymore. You can turn them back on any time in your preferences."
);
