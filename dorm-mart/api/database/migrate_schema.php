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
require_once __DIR__ . '/schema_sync.php';
require_once __DIR__ . '/seed_profanity_wordlist.php';

/*
 * Brings the database in line with schema/<table>.sql, one file per table.
 * Edit a table's file and run this; there are no numbered migrations.
 *
 *   php api/database/migrate_schema.php                     apply the changes
 *   php api/database/migrate_schema.php --dry-run           print the plan, change nothing
 *   php api/database/migrate_schema.php --prune             also drop tables no file declares
 *   php api/database/migrate_schema.php --reseed-profanity  re-run the word-list import
 *   php api/database/migrate_schema.php --schema-dir=PATH   read table files from PATH
 *
 * Dropping a column from a file drops it from the database. Tables that no
 * file declares are only listed ("unmanaged"), never dropped, unless --prune.
 */

$flags = array_slice($argv ?? [], 1);
$schemaDir = dirname(__DIR__, 2) . '/schema';
foreach ($flags as $flag) {
    if (str_starts_with($flag, '--schema-dir=')) {
        $schemaDir = substr($flag, strlen('--schema-dir='));
    } elseif (!in_array($flag, ['--dry-run', '--prune', '--reseed-profanity'], true)) {
        fwrite(STDERR, "Unknown option {$flag}\n");
        exit(2);
    }
}

try {
    $conn = db();

    $report = schema_sync_run($conn, $schemaDir, [
        'dry_run' => in_array('--dry-run', $flags, true),
        'prune' => in_array('--prune', $flags, true),
        'force_seed' => ['profanity_words' => in_array('--reseed-profanity', $flags, true)],
        // The starter words live in schema/profanity_words.sql; this adds the
        // banbuilder dictionary whenever the table is empty (or on request).
        'seeders' => [
            'profanity_words' => function (mysqli $conn): string {
                $result = seed_profanity_wordlist($conn);
                return $result['skipped_reason'] === null
                    ? $result['seeded'] . ' words added, ' . $result['removed'] . ' removed'
                    : 'banbuilder skipped: ' . $result['skipped_reason'];
            },
        ],
    ]);
    $conn->close();

    $report['success'] = true;
    // Table and column names come from our own files; escape them anyway, but
    // leave the SQL plan readable.
    foreach ($report as $key => $value) {
        if ($key !== 'plan' && is_array($value)) {
            $report[$key] = array_map(fn($v) => is_string($v) ? escape_html($v) : $v, $value);
        }
    }
    echo json_encode($report, JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $e) {
    error_log('schema sync error: ' . $e->getMessage());
    fwrite(STDERR, json_encode(['success' => false, 'message' => $e->getMessage()]) . PHP_EOL);
    exit(1);
}
