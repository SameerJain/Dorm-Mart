<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/image_upload.php';
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/protect_test_accounts.php';

/*
 * Rebuilds the test fixtures in data/*.sql. Local databases only.
 *
 *   php api/database/migrate_data.php
 *
 * Seed accounts are the emails written in data/*.sql. Each run deletes
 * everything those accounts own (listings, chats, schedules, reviews, ...)
 * and replays the files, so the fixtures always come back in their pristine
 * state, including anything a tester added while logged in as one of them.
 * Rows that belong to anyone else, moderators included, are never touched.
 *
 * Run migrate_schema.php first: this script fills tables, it does not create them.
 */

/**
 * [table, columns that name a seed user]. A row is deleted when any listed
 * column holds a seed user_id. The order matters only where a foreign key
 * would otherwise just null a reference (ON DELETE SET NULL) and leave an
 * orphaned fixture row behind: chats, schedules and listings go first and
 * take their dependents with them, user_accounts goes last and cascades the rest.
 */
const SEED_OWNED_ROWS = [
    ['conversations', ['user1_id', 'user2_id']],
    ['scheduled_purchase_requests', ['buyer_user_id', 'seller_user_id']],
    ['INVENTORY', ['seller_id']],
    ['purchased_items', ['buyer_user_id', 'seller_user_id']],
    ['listing_reports', ['reporter_id', 'seller_id']],
    ['message_reports', ['reporter_id', 'reported_user_id']],
    ['moderation_actions', ['target_user_id']],
    ['user_accounts', ['user_id']],
];

function assert_local_database(): void
{
    $host = strtolower(trim((string)getenv('DB_HOST')));
    if (!in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
        throw new RuntimeException('Refusing to load test data into a non-local database');
    }
}

/** Delete every row the seed accounts own. Returns [table => rows deleted]. */
function reset_seed_data(mysqli $conn, array $emails): array
{
    if ($emails === []) {
        return [];
    }

    // Moderators are provisioned by hand, never by a fixture.
    $marks = implode(',', array_fill(0, count($emails), '?'));
    $stmt = $conn->prepare("SELECT user_id FROM user_accounts WHERE role = 'user' AND email IN ({$marks})");
    $stmt->bind_param(str_repeat('s', count($emails)), ...$emails);
    $stmt->execute();
    $ids = array_map('intval', array_column($stmt->get_result()->fetch_all(MYSQLI_ASSOC), 'user_id'));
    $stmt->close();
    if ($ids === []) {
        return [];
    }

    // Integers read back from the database, so nothing to escape.
    $idList = implode(',', $ids);
    $deleted = [];
    foreach (SEED_OWNED_ROWS as [$table, $columns]) {
        $where = implode(' OR ', array_map(fn(string $c) => "`{$c}` IN ({$idList})", $columns));
        $conn->query("DELETE FROM `{$table}` WHERE {$where}");
        $deleted[$table] = $conn->affected_rows;
    }
    return $deleted;
}

try {
    assert_local_database();
    $conn = db();
    $reset = reset_seed_data($conn, seed_account_emails());

    $dataDir = dirname(__DIR__, 2) . '/data';
    $testImagesDir = $dataDir . '/test-images';
    $imagesDir = data_images_dir();
    if (is_dir($testImagesDir) && ensure_upload_directory($imagesDir)) {
        foreach (glob($testImagesDir . '/*') ?: [] as $testImagePath) {
            if (is_file($testImagePath) && !copy($testImagePath, $imagesDir . '/' . basename($testImagePath))) {
                error_log('Warning: Failed to copy test image: ' . basename($testImagePath));
            }
        }
    }

    $files = glob($dataDir . '/*.sql') ?: [];
    natsort($files);
    $ran = [];

    // The seed accounts' data is gone (reset_seed_data); replay the fixtures.
    foreach ($files as $path) {
        $name = basename($path);
        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new RuntimeException('Unable to read data migration ' . $name);
        }

        try {
            $conn->begin_transaction();
            $conn->multi_query($sql);
            do {
                $result = $conn->store_result();
                if ($result instanceof mysqli_result) {
                    $result->free();
                }
                if (!$conn->more_results()) {
                    break;
                }
                $conn->next_result();
            } while (true);

            $conn->commit();
            $ran[] = $name;
        } catch (Throwable $e) {
            try {
                $conn->rollback();
            } catch (Throwable $ignored) {
            }
            throw new RuntimeException('Failed data migration ' . $name . ': ' . $e->getMessage(), 0, $e);
        }
    }

    $protection = protect_test_accounts($conn, $dataDir);
    $conn->close();
    echo json_encode([
        'success' => true,
        'reset' => $reset,
        'applied' => array_map('escape_html', $ran),
        'test_accounts' => $protection,
    ]);
} catch (Throwable $e) {
    error_log('data migration error: ' . $e->getMessage());
    fwrite(STDERR, json_encode(['success' => false, 'message' => $e->getMessage()]) . PHP_EOL);
    exit(1);
}
