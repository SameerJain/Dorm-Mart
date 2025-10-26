
<?php
// Used to test db connection
require __DIR__ . '/db_connect.php';

try {
    $conn = db();
    echo "Database connection successful\n";
} catch (Throwable $e) {
    echo "Database connection failed: " . $e->getMessage() . "\n";
}
