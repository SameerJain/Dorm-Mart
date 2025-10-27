<?php
// Session + persistent login helpers

const REMEMBER_COOKIE = 'remember_token';
const REMEMBER_TTL_DAYS = 30; // persistent login length

function auth_boot_session(): void
{
  static $booted = false;
  if ($booted) return;

  ini_set('session.use_strict_mode', '1');
  ini_set('session.cookie_httponly', '1');

  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

  session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $secure,
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
}

/* ---------- Persistent login ("remember me") ---------- */

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

  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  setcookie(REMEMBER_COOKIE, $userId . ':' . $token, [
    'expires'  => time() + REMEMBER_TTL_DAYS * 24 * 60 * 60,
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Lax', // see comment above
  ]);
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
  setcookie(REMEMBER_COOKIE, '', [
    'expires'  => time() - 3600,
    'path'     => '/',
    'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
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
  $stmt = $conn->prepare('SELECT hash_auth FROM user_accounts WHERE user_id = ? LIMIT 1');
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
  $_SESSION['user_id'] = $uid;

  $newToken = bin2hex(random_bytes(32));
  $newHash  = password_hash($newToken, PASSWORD_DEFAULT);
  $upd = $conn->prepare('UPDATE user_accounts SET hash_auth = ? WHERE user_id = ?');
  $upd->bind_param('si', $newHash, $uid);
  $upd->execute();
  $upd->close();
  $conn->close();

  $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
  setcookie(REMEMBER_COOKIE, $uid . ':' . $newToken, [
    'expires'  => time() + REMEMBER_TTL_DAYS * 24 * 60 * 60,
    'path'     => '/',
    'secure'   => $secure,
    'httponly' => true,
    'samesite' => 'Lax',
  ]);
}

/** Require auth (calls ensure_session) */
function require_login(): int
{
  ensure_session();
  if (empty($_SESSION['user_id'])) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not authenticated']);
    exit;
  }
  return (int) $_SESSION['user_id'];
}

/** Destroy session + clear persistent cookie */
function logout_destroy_session(): void
{
  auth_boot_session();
  $uid = $_SESSION['user_id'] ?? null;

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
