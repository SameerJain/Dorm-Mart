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
require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/seed_profanity_wordlist.php';

/*
 * Schema migrations.
 *
 * A fresh database runs migrations/001_baseline.sql and every later
 * migrations/NNN_*.sql once, recording each in schema_migrations.
 *
 * A database built before the baseline existed has the old filenames in its
 * ledger (001_user_accounts.sql ...). For those, the remaining files in
 * migrations/legacy/ run first, then the baseline is recorded as reached
 * without running it. That path itself drops nothing; the tables the baseline
 * left out are removed by the ordinary migration 003_drop_unused_tables.sql.
 */

const MIGRATION_BASELINE = '001_baseline.sql';
const MIGRATION_LEGACY_MARKER = '001_user_accounts.sql';
const MIGRATION_PAYMENTS = '002_stripe_connect_payments.sql';
const MIGRATION_PAYMENTS_LEGACY = '025_stripe_connect_payments.sql';

function migration_files(string $dir): array
{
    $files = glob($dir . '/*.sql') ?: [];
    natsort($files);
    return array_values($files);
}

function migration_record(mysqli $conn, string $name): void
{
    $stmt = $conn->prepare('INSERT INTO schema_migrations (filename) VALUES (?)');
    $stmt->bind_param('s', $name);
    $stmt->execute();
    $stmt->close();
}

/** Run one SQL file and record it, all or nothing (as far as MySQL DDL allows). */
function migration_run(mysqli $conn, string $path, string $name): void
{
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

        migration_record($conn, $name);
        $conn->commit();
    } catch (Throwable $e) {
        try {
            $conn->rollback();
        } catch (Throwable $ignored) {
        }
        throw new RuntimeException('Failed migration ' . $name . ': ' . $e->getMessage(), 0, $e);
    }
}

/** Stripe tables are only created once payments are switched on. */
function migration_is_payments(string $name): bool
{
    return $name === MIGRATION_PAYMENTS || $name === MIGRATION_PAYMENTS_LEGACY;
}

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

    $migrationsDir = dirname(__DIR__, 2) . '/migrations';
    $ran = [];
    $skipped = [];

    if (!isset($applied[MIGRATION_BASELINE]) && isset($applied[MIGRATION_LEGACY_MARKER])) {
        foreach (migration_files($migrationsDir . '/legacy') as $path) {
            $name = basename($path);
            if (isset($applied[$name])) {
                continue;
            }
            if (migration_is_payments($name) && !dm_payments_enabled()) {
                $skipped[] = 'legacy/' . $name;
                continue;
            }
            migration_run($conn, $path, $name);
            $applied[$name] = true;
            $ran[] = 'legacy/' . $name;
        }

        migration_record($conn, MIGRATION_BASELINE);
        $applied[MIGRATION_BASELINE] = true;
        $ran[] = MIGRATION_BASELINE . ' (reached through the legacy chain)';
        // Same file under its old name: already applied, so do not run it twice.
        if (isset($applied[MIGRATION_PAYMENTS_LEGACY]) && !isset($applied[MIGRATION_PAYMENTS])) {
            migration_record($conn, MIGRATION_PAYMENTS);
            $applied[MIGRATION_PAYMENTS] = true;
        }
    }

    foreach (migration_files($migrationsDir) as $path) {
        $name = basename($path);
        if (isset($applied[$name])) {
            continue;
        }
        if (migration_is_payments($name) && !dm_payments_enabled()) {
            $skipped[] = $name;
            continue;
        }
        migration_run($conn, $path, $name);
        $ran[] = $name;
    }

    // Bump the suffix whenever PROFANITY_WORDLIST_EXCLUDED changes so existing
    // databases re-run the seed and drop newly excluded words (once).
    $wordlistSeedName = 'seed_profanity_wordlist_banbuilder_v3';
    if (!isset($applied[$wordlistSeedName])) {
        $seedResult = seed_profanity_wordlist($conn);
        if ($seedResult['skipped_reason'] === null) {
            migration_record($conn, $wordlistSeedName);
            $ran[] = $wordlistSeedName . ' (' . $seedResult['seeded'] . ' added, ' . $seedResult['removed'] . ' removed)';
        } else {
            $skipped[] = $wordlistSeedName . ': ' . $seedResult['skipped_reason'];
        }
    }

    $conn->close();
    echo json_encode([
        'success' => true,
        'applied' => array_map('escape_html', $ran),
        'skipped' => array_map('escape_html', $skipped),
    ]);
} catch (Throwable $e) {
    error_log('schema migration error: ' . $e->getMessage());
    fwrite(STDERR, json_encode(['success' => false, 'message' => $e->getMessage()]) . PHP_EOL);
    exit(1);
}
