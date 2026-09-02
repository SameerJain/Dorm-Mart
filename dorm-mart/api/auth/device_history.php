<?php
declare(strict_types=1);

function login_device_details(string $userAgent): array
{
    $operatingSystem = 'Unknown OS';
    if (preg_match('/iPhone|iPad|iPod/i', $userAgent)) {
        $operatingSystem = 'iOS';
    } elseif (preg_match('/Android/i', $userAgent)) {
        $operatingSystem = 'Android';
    } elseif (preg_match('/CrOS/i', $userAgent)) {
        $operatingSystem = 'Chrome OS';
    } elseif (preg_match('/Windows/i', $userAgent)) {
        $operatingSystem = 'Windows';
    } elseif (preg_match('/Macintosh|Mac OS X/i', $userAgent)) {
        $operatingSystem = 'macOS';
    } elseif (preg_match('/Linux/i', $userAgent)) {
        $operatingSystem = 'Linux';
    }

    $browser = 'Unknown browser';
    if (preg_match('/Edg(?:A|iOS)?\//i', $userAgent)) {
        $browser = 'Microsoft Edge';
    } elseif (preg_match('/OPR\//i', $userAgent)) {
        $browser = 'Opera';
    } elseif (preg_match('/SamsungBrowser\//i', $userAgent)) {
        $browser = 'Samsung Internet';
    } elseif (preg_match('/CriOS\/|Chrome\//i', $userAgent)) {
        $browser = 'Google Chrome';
    } elseif (preg_match('/FxiOS\/|Firefox\//i', $userAgent)) {
        $browser = 'Mozilla Firefox';
    } elseif (preg_match('/Safari\//i', $userAgent)) {
        $browser = 'Safari';
    }

    $deviceType = 'Desktop';
    if (preg_match('/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i', $userAgent)) {
        $deviceType = 'Tablet';
    } elseif (preg_match('/Mobile|iPhone|iPod/i', $userAgent)) {
        $deviceType = 'Mobile';
    }

    return [
        'device_type' => $deviceType,
        'browser' => $browser,
        'operating_system' => $operatingSystem,
    ];
}

function login_request_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? '',
        $_SERVER['HTTP_X_REAL_IP'] ?? '',
    ];
    $forwarded = explode(',', (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    $candidates[] = trim($forwarded[0] ?? '');
    $candidates[] = $_SERVER['REMOTE_ADDR'] ?? '';

    foreach ($candidates as $candidate) {
        $ip = trim((string)$candidate);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }

    return 'Unknown';
}

function login_request_location(): ?string
{
    $parts = [
        $_SERVER['HTTP_X_VERCEL_IP_CITY'] ?? $_SERVER['HTTP_CF_IPCITY'] ?? '',
        $_SERVER['HTTP_X_VERCEL_IP_COUNTRY_REGION'] ?? $_SERVER['HTTP_CF_REGION'] ?? '',
        $_SERVER['HTTP_X_VERCEL_IP_COUNTRY'] ?? $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '',
    ];

    $parts = array_values(array_unique(array_filter(array_map(static function ($value): string {
        $decoded = rawurldecode(trim((string)$value));
        $clean = str_replace(["\0", "\r", "\n", "\t"], '', $decoded);
        return substr($clean, 0, 80);
    }, $parts))));

    return $parts ? substr(implode(', ', $parts), 0, 160) : null;
}

function record_login_device(int $userId): bool
{
    $sessionId = session_id();
    if ($userId <= 0 || $sessionId === '') {
        return false;
    }

    $conn = null;
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $userAgent = substr((string)($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown'), 0, 512);
        $details = login_device_details($userAgent);
        $sessionHash = hash('sha256', $sessionId);
        $ipAddress = login_request_ip();
        $location = login_request_location();
        $deviceType = $details['device_type'];
        $browser = $details['browser'];
        $operatingSystem = $details['operating_system'];

        $stmt = $conn->prepare(
            'INSERT INTO login_history
                (user_id, session_hash, device_type, browser, operating_system, user_agent, ip_address, location)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                device_type = VALUES(device_type), browser = VALUES(browser),
                operating_system = VALUES(operating_system), user_agent = VALUES(user_agent),
                ip_address = VALUES(ip_address), location = COALESCE(VALUES(location), location),
                last_seen_at = CURRENT_TIMESTAMP, signed_out_at = NULL'
        );
        $stmt->bind_param(
            'isssssss',
            $userId,
            $sessionHash,
            $deviceType,
            $browser,
            $operatingSystem,
            $userAgent,
            $ipAddress,
            $location
        );
        $stmt->execute();
        $stmt->close();
        $conn->close();

        $_SESSION['device_history_touched_at'] = time();
        return true;
    } catch (Throwable $e) {
        if ($conn instanceof mysqli) {
            $conn->close();
        }
        error_log('device history record error: ' . $e->getMessage());
        return false;
    }
}

function mark_login_device_signed_out(int $userId): void
{
    $sessionId = session_id();
    if ($userId <= 0 || $sessionId === '') {
        return;
    }

    $conn = null;
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $sessionHash = hash('sha256', $sessionId);
        $stmt = $conn->prepare(
            'UPDATE login_history SET signed_out_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP
             WHERE user_id = ? AND session_hash = ?'
        );
        $stmt->bind_param('is', $userId, $sessionHash);
        $stmt->execute();
        $stmt->close();
        $conn->close();
    } catch (Throwable $e) {
        if ($conn instanceof mysqli) {
            $conn->close();
        }
        error_log('device history sign-out error: ' . $e->getMessage());
    }
}

function mark_all_login_devices_signed_out(int $userId): void
{
    $conn = null;
    try {
        require_once __DIR__ . '/../database/db_connect.php';
        $conn = db();
        $stmt = $conn->prepare(
            'UPDATE login_history SET signed_out_at = CURRENT_TIMESTAMP WHERE user_id = ? AND signed_out_at IS NULL'
        );
        $stmt->bind_param('i', $userId);
        $stmt->execute();
        $stmt->close();
        $conn->close();
    } catch (Throwable $e) {
        if ($conn instanceof mysqli) {
            $conn->close();
        }
        error_log('device history bulk sign-out error: ' . $e->getMessage());
    }
}
