
<?php
// Used to test db connection
header('Content-Type: text/plain; charset=UTF-8');
require __DIR__ . '/db_connect.php';

try {
    $conn = db();
    echo "Database connection successful\n";
} catch (Throwable $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
}