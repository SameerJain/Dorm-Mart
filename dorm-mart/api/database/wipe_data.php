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

require_once __DIR__ . '/db_connect.php';

// Same rule as migrate_data.php: never empty a shared or production database
// by accident (for example with a Railway .env loaded). Wiping a remote host
// on purpose requires naming it: --allow-remote-host=<the DB_HOST value>.
$dbHost = strtolower(trim((string)getenv('DB_HOST')));
$allowedRemote = '';
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--allow-remote-host=')) {
        $allowedRemote = strtolower(trim(substr($arg, strlen('--allow-remote-host='))));
    }
}
$isLocal = in_array($dbHost, ['127.0.0.1', 'localhost', '::1'], true);
if (!$isLocal && ($allowedRemote === '' || $allowedRemote !== $dbHost)) {
    fwrite(STDERR, "Refusing to wipe non-local database host '{$dbHost}'. "
        . "If you really mean it, add --allow-remote-host={$dbHost}\n");
    exit(2);
}

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

    // profanity_words was just emptied, but the ledger still says the word list
    // was seeded, so migrate_schema.php would never refill it. Forget the seed.
    if (!$rebuild) {
        $conn->query("DELETE FROM schema_migrations WHERE filename LIKE 'seed_profanity_wordlist%'");
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
