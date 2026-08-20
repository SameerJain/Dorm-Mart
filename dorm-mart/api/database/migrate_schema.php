<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

ini_set('display_errors', '0');
error_reporting(E_ALL);
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/db_connect.php';

try {
    $conn = db();
    $conn->query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB'
    );

    $applied = [];
    $result = $conn->query('SELECT filename FROM schema_migrations');
    while ($row = $result->fetch_assoc()) {
        $applied[$row['filename']] = true;
    }

    $files = glob(dirname(__DIR__, 2) . '/migrations/*.sql') ?: [];
    natsort($files);
    $ran = [];

    foreach ($files as $path) {
        $name = basename($path);
        if (isset($applied[$name])) {
            continue;
        }

        $sql = file_get_contents($path);
        if ($sql === false) {
            throw new RuntimeException('Unable to read migration ' . $name);
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

            $stmt = $conn->prepare('INSERT INTO schema_migrations (filename) VALUES (?)');
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
            throw new RuntimeException('Failed migration ' . $name . ': ' . $e->getMessage(), 0, $e);
        }
    }

    $conn->close();
    echo json_encode(['success' => true, 'applied' => array_map('escape_html', $ran)]);
} catch (Throwable $e) {
    error_log('schema migration error: ' . $e->getMessage());
    fwrite(STDERR, json_encode(['success' => false, 'message' => $e->getMessage()]) . PHP_EOL);
    exit(1);
}
