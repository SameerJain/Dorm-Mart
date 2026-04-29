
<?php
// Used to test db connection
if (php_sapi_name() !== 'cli') {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Not found']);
    exit;
}

require __DIR__ . '/db_connect.php';

try {
    $conn = db();
    echo "Database connection successful\n";
} catch (Throwable $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
}
