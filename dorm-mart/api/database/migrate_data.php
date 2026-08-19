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

function reset_local_data(mysqli $conn): array
{
    $host = strtolower(trim((string)getenv('DB_HOST')));
    if (!in_array($host, ['127.0.0.1', 'localhost', '::1'], true)) {
        throw new RuntimeException('Refusing to reset data on a non-local database');
    }

    $preserved = ['schema_migrations', 'profanity_words'];
    $tables = [];
    $result = $conn->query(
        "SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
    );
    while ($row = $result->fetch_row()) {
        if (!in_array(strtolower($row[0]), $preserved, true)) {
            $tables[] = $row[0];
        }
    }
    $result->free();

    $conn->query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        foreach ($tables as $table) {
            $conn->query('TRUNCATE TABLE `' . str_replace('`', '``', $table) . '`');
        }
    } finally {
        $conn->query('SET FOREIGN_KEY_CHECKS = 1');
    }

    return $tables;
}

try {
    $conn = db();
    $conn->query(
        'CREATE TABLE IF NOT EXISTS data_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB'
    );
    $reset = reset_local_data($conn);

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

    // Every run starts from an empty local data set, then rebuilds the test fixtures.
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

            $stmt = $conn->prepare(
                'INSERT INTO data_migrations (filename) VALUES (?)
                 ON DUPLICATE KEY UPDATE applied_at = CURRENT_TIMESTAMP'
            );
            $stmt->bind_param('s', $name);
            $stmt->execute();
            $stmt->close();
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

    require_once __DIR__ . '/protect_test_accounts.php';
    $protection = protect_test_accounts($conn, $dataDir);
    $conn->close();
    echo json_encode([
        'success' => true,
        'reset' => array_map('escape_html', $reset),
        'applied' => array_map('escape_html', $ran),
        'test_accounts' => $protection,
    ]);
} catch (Throwable $e) {
    error_log('data migration error: ' . $e->getMessage());
    fwrite(STDERR, json_encode(['success' => false, 'message' => $e->getMessage()]) . PHP_EOL);
    exit(1);
}
