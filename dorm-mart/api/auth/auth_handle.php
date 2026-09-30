<?php
// Session + persistent login helpers

require_once __DIR__ . '/device_history.php';
require_once __DIR__ . '/../security/transport.php';
require_once __DIR__ . '/../helpers/response.php';

const REMEMBER_COOKIE = 'remember_token';
const REMEMBER_TTL_DAYS = 7; // persistent login length
const DEVICE_HISTORY_REFRESH_SECONDS = 300;

function auth_boot_session(): void
{
  static $booted = false;
  if ($booted) return;

  ini_set('session.use_strict_mode', '1');
  ini_set('session.cookie_httponly', '1');

  session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => is_https_request(),
    'httponly' => true,
    'samesite' => 'Lax', // if your frontend is cross-site XHR, set 'None' + secure=true
  ]);

  if (session_status() !== PHP_SESSION_ACTIVE) session_start();
  $booted = true;
}

function regenerate_session_on_login(): void
{
  auth_boot_session();
  session_regenerate_id(true);
  // regenerate_id keeps session data, so drop the pre-login CSRF token too.
  unset($_SESSION['csrf_token']);
}

/* ---------- Persistent login ("remember me") ---------- */

/** The one place the remember-me cookie's flags are set. Pass an expiry in the past to clear it. */
function set_remember_cookie(string $value, int $expires): void
{
  setcookie(REMEMBER_COOKIE, $value, [
    'expires'  => $expires,
    'path'     => '/',
    'secure'   => is_https_request(),
    'httponly' => true,
    'samesite' => 'Lax', // see comment in auth_boot_session
  ]);
}

function remember_cookie_expiry(): int
{
  return time() + REMEMBER_TTL_DAYS * 24 * 60 * 60;
}

function issue_remember_cookie(int $userId): void
{
  require_once __DIR__ . '/../database/db_connect.php';
  $token = bin2hex(random_bytes(32));                 // 64 hex chars
  $hash  = password_hash($token, PASSWORD_DEFAULT);   // store only the hash

  $conn = db();
  $stmt = $conn->prepare('UPDATE user_accounts SET hash_auth = ? WHERE user_id = ?');
  $stmt->bind_param('si', $hash, $userId);
  $stmt->execute();
  $stmt->close();
  $conn->close();

  set_remember_cookie($userId . ':' . $token, remember_cookie_expiry());
}

function clear_remember_cookie(?int $userId = null): void
{
  // clear server-side
  if ($userId) {
    require_once __DIR__ . '/../database/db_connect.php';
    $conn = db();
    $stmt = $conn->prepare('UPDATE user_accounts SET hash_auth = NULL WHERE user_id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $stmt->close();
    $conn->close();
  }
  // clear client cookie
  set_remember_cookie('', time() - 3600);
}

/**
 * Ensure a session exists; if not, hydrate it from the persistent cookie.
 */
function ensure_session(): void
{
  auth_boot_session();
  if (!empty($_SESSION['user_id'])) return;

  if (empty($_COOKIE[REMEMBER_COOKIE])) return;
  $parts = explode(':', $_COOKIE[REMEMBER_COOKIE], 2);
  if (count($parts) !== 2) return;

  [$uidStr, $token] = $parts;
  if (!ctype_digit($uidStr) || $token === '' || strlen($token) > 256) return;
  $uid = (int)$uidStr;

  require_once __DIR__ . '/../database/db_connect.php';
  $conn = db();
  $stmt = $conn->prepare('SELECT hash_auth, auth_version FROM user_accounts WHERE user_id = ? LIMIT 1');
  $stmt->bind_param('i', $uid);
  $stmt->execute();
  $res  = $stmt->get_result();
  if ($res->num_rows !== 1) {
    $stmt->close();
    $conn->close();
    return;
  }
  $row  = $res->fetch_assoc();
  $stmt->close();

  $hash = (string)($row['hash_auth'] ?? '');
  if ($hash === '' || !password_verify($token, $hash)) {
    $conn->close();
    return;
  }

  // success → hydrate session and rotate token
  session_regenerate_id(true);
  unset($_SESSION['csrf_token']);
  $_SESSION['user_id'] = $uid;
  $_SESSION['auth_version'] = (int)$row['auth_version'];
  claim_or_record_login_device($uid);

  $newToken = bin2hex(random_bytes(32));
  $newHash  = password_hash($newToken, PASSWORD_DEFAULT);
  // Rotate only if nobody else has since the verify above. A concurrent restore
  // that already rotated keeps its cookie; this request still gets its session
  // but must not send a token whose hash is about to be overwritten.
  $upd = $conn->prepare('UPDATE user_accounts SET hash_auth = ? WHERE user_id = ? AND hash_auth = ?');
  $upd->bind_param('sis', $newHash, $uid, $hash);
  $upd->execute();
  $rotated = $upd->affected_rows === 1;
  $upd->close();
  $conn->close();
  if (!$rotated) return;

  set_remember_cookie($uid . ':' . $newToken, remember_cookie_expiry());
}

/**
 * Send an auth failure in the shape clients expect, then stop.
 *
 * @return never
 */
function auth_reject(int $status, string $error, array $extra = []): void
{
  json_response(['ok' => false, 'success' => false, 'error' => $error] + $extra, $status);
}

/** Require auth (calls ensure_session) */
function require_login(): int
{
  ensure_session();
  if (empty($_SESSION['user_id'])) {
    auth_reject(401, 'Not authenticated');
  }
  $userId = (int) $_SESSION['user_id'];
  $account = auth_account($userId);
  if (!$account || !isset($_SESSION['auth_version'])
      || (int)$_SESSION['auth_version'] !== (int)$account['auth_version']) {
    logout_destroy_session();
    auth_reject(401, 'Not authenticated');
  }
  if ((int)$account['is_banned'] === 1) {
    logout_destroy_session();
    auth_reject(403, 'Account suspended');
  }
  $lastTouched = (int)($_SESSION['device_history_touched_at'] ?? 0);
  if (time() - $lastTouched >= DEVICE_HISTORY_REFRESH_SECONDS) {
    record_login_device($userId);
  }
  return $userId;
}

function auth_account(int $userId): ?array
{
  static $accounts = [];
  if (array_key_exists($userId, $accounts)) return $accounts[$userId];

  require_once __DIR__ . '/../database/db_connect.php';
  $conn = db();
  $stmt = $conn->prepare('SELECT user_id, role, is_banned, auth_version FROM user_accounts WHERE user_id = ? LIMIT 1');
  $stmt->bind_param('i', $userId);
  $stmt->execute();
  $account = $stmt->get_result()->fetch_assoc() ?: null;
  $stmt->close();
  $conn->close();
  $accounts[$userId] = $account;
  return $account;
}

function require_moderator(): int
{
  $userId = require_login();
  $account = auth_account($userId);
  if (($account['role'] ?? 'user') !== 'moderator') {
    auth_reject(403, 'Moderator access required');
  }
  return $userId;
}

/** Destroy session + clear persistent cookie */
function logout_destroy_session(): void
{
  auth_boot_session();
  $uid = $_SESSION['user_id'] ?? null;

  if ($uid) {
    mark_login_device_signed_out((int)$uid);
  }

  $_SESSION = [];
  $params = session_get_cookie_params();
  setcookie(session_name(), '', [
    'expires'  => time() - 42000,
    'path'     => $params['path'] ?? '/',
    'domain'   => $params['domain'] ?? '',
    'secure'   => (bool)($params['secure'] ?? false),
    'httponly' => (bool)($params['httponly'] ?? true),
    'samesite' => 'Lax',
  ]);
  session_destroy();

  clear_remember_cookie($uid);
}

/* ---------- CSRF Protection ---------- */

/**
 * Generate or retrieve CSRF token from session
 * @return string CSRF token (64-character hex string)
 */
function generate_csrf_token(): string {
  auth_boot_session();
  
  if (!isset($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
  }
  return $_SESSION['csrf_token'];
}

/**
 * Validate CSRF token using timing-safe comparison
 * @param string $token Token to validate
 * @return bool True if token is valid
 */
function validate_csrf_token(string $token): bool {
  auth_boot_session();
  
  if (!isset($_SESSION['csrf_token'])) {
    return false;
  }
  
  return hash_equals($_SESSION['csrf_token'], $token);
}

function require_csrf_token($token): void {
  if (!is_string($token) || $token === '' || !validate_csrf_token($token)) {
    auth_reject(403, 'CSRF token validation failed', ['code' => 'csrf_invalid']);
  }
}
