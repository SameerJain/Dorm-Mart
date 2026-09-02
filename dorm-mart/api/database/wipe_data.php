<?php
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$rebuild = in_array('--confirm-rebuild', $argv, true);
$wipe = in_array('--confirm-wipe', $argv, true);

if (!$rebuild && !$wipe) {
    fwrite(STDERR, "Use --confirm-wipe to truncate data or --confirm-rebuild to drop every table\n");
    exit(2);
}

require __DIR__ . '/db_connect.php';

$conn = db();
$excludeMigrationLedger = $rebuild ? '' : "AND TABLE_NAME <> 'schema_migrations'";
$result = $conn->query(
    "SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        $excludeMigrationLedger
      ORDER BY TABLE_NAME"
);

$tables = array_column($result->fetch_all(MYSQLI_ASSOC), 'TABLE_NAME');
$changed = [];

try {
    $conn->query('SET FOREIGN_KEY_CHECKS = 0');

    foreach ($tables as $table) {
        $identifier = '`' . str_replace('`', '``', $table) . '`';
        $command = $rebuild ? 'DROP TABLE' : 'TRUNCATE TABLE';
        $conn->query("$command $identifier");
        $changed[] = $table;
    }
} finally {
    $conn->query('SET FOREIGN_KEY_CHECKS = 1');
    $conn->close();
}

echo json_encode([
    'success' => true,
    $rebuild ? 'dropped_tables' : 'wiped_tables' => $changed,
    'preserved_tables' => $rebuild ? [] : ['schema_migrations'],
], JSON_UNESCAPED_SLASHES) . PHP_EOL;
