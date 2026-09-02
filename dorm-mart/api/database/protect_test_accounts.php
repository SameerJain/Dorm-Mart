<?php
declare(strict_types=1);

require_once __DIR__ . '/db_connect.php';

function protect_test_accounts(mysqli $conn, ?string $dataDir = null): array
{
    $dataDir ??= dirname(__DIR__, 2) . '/data';
    $emails = [];

    foreach (glob(rtrim($dataDir, '/\\') . '/*.sql') ?: [] as $path) {
        $sql = file_get_contents($path);
        if ($sql === false) continue;
        preg_match_all('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $sql, $matches);
        foreach ($matches[0] as $email) $emails[strtolower($email)] = true;
    }

    $emails = array_keys($emails);
    if ($emails === []) return ['emails_found' => 0, 'accounts_protected' => 0];

    $placeholders = implode(',', array_fill(0, count($emails), '?'));
    $stmt = $conn->prepare(
        'UPDATE user_accounts SET is_protected = 1 WHERE email IN (' . $placeholders . ')'
    );
    if (!$stmt) throw new RuntimeException('Failed to prepare test account protection update');

    $types = str_repeat('s', count($emails));
    $params = [$types];
    foreach ($emails as $index => $_) $params[] = &$emails[$index];
    $stmt->bind_param(...$params);
    $stmt->execute();
    $protected = $stmt->affected_rows;
    $stmt->close();

    return ['emails_found' => count($emails), 'accounts_protected' => $protected];
}

if (realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? '')) === __FILE__) {
    if (php_sapi_name() !== 'cli') {
        http_response_code(403);
        exit("CLI only\n");
    }

    try {
        $conn = db();
        $result = protect_test_accounts($conn);
        $conn->close();
        echo json_encode(['success' => true] + $result, JSON_UNESCAPED_SLASHES) . PHP_EOL;
    } catch (Throwable $e) {
        fwrite(STDERR, 'Failed to protect test accounts: ' . $e->getMessage() . PHP_EOL);
        exit(1);
    }
}
