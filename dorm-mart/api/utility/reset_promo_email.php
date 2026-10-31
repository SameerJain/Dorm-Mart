<?php
declare(strict_types=1);

// Dev-only CLI tool for testing promotional email locally.
//
//   php api/utility/reset_promo_email.php          reset the intro-email flag and
//                                                  make every opted-in user due
//                                                  for a digest again
//   php api/utility/reset_promo_email.php <email>  the same, for one user
//
// Refuses to run against a non-local database, like migrate_data.php.
// (It used to also require REQUEST_METHOD=POST, which the CLI never sets, so
// it could not run at all; and it never reset promo_last_sent_at, which is what
// decides when the next digest goes out.)

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Forbidden']);
    exit;
}

require_once __DIR__ . '/../database/db_connect.php';

$host = strtolower(trim((string)getenv('DB_HOST')));
if (!in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
    fwrite(STDERR, "Refusing to reset promo state on a non-local database (DB_HOST={$host}).\n");
    exit(1);
}

$email = isset($argv[1]) ? trim((string)$argv[1]) : '';

try {
    $conn = db();
    if ($email !== '') {
        $stmt = $conn->prepare(
            'UPDATE user_accounts SET received_intro_promo_email = FALSE, promo_last_sent_at = NULL WHERE email = ?'
        );
        $stmt->bind_param('s', $email);
    } else {
        $stmt = $conn->prepare(
            'UPDATE user_accounts SET received_intro_promo_email = FALSE, promo_last_sent_at = NULL'
        );
    }
    $stmt->execute();
    $affectedRows = $stmt->affected_rows;
    $stmt->close();
    $conn->close();

    echo json_encode([
        'ok' => true,
        'affected_rows' => $affectedRows,
        'message' => $email !== ''
            ? "Reset promo state for {$email}"
            : "Reset promo state for {$affectedRows} users",
    ]) . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, 'reset_promo_email failed: ' . $e->getMessage() . "\n");
    exit(1);
}
