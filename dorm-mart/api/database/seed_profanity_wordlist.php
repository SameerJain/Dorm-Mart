<?php
declare(strict_types=1);

/**
 * Words the banbuilder dictionaries flag that are too generic/clinical for a
 * marketplace chat filter and would false-positive on normal conversation
 * (e.g. "cornhole set", "fanny pack", "killer deal", "screwdriver", "damn
 * good price"). The crude slang equivalents (ass, dick, pussy, cum, etc.)
 * stay in the list; this only trims words that aren't actually profane here.
 */
const PROFANITY_WORDLIST_EXCLUDED = [
    // everyday/marketplace words with an unrelated literal meaning
    'cornhole', 'fanny', 'screw', 'weed', 'pig',
    // mild interjections, common in normal chat, barely profanity
    'damn', 'dammit', 'damm', 'godammit', 'goddammit', 'goddamn', 'godammet', 'goddammet',
    'hell', 'crap', 'bloody', 'bloodyhell', 'fart', 'poop',
    // violent/political terms better left to human moderation than an auto-ban list
    'kill', 'killer', 'killin', 'killing', 'murder', 'murderer', 'assassin',
    'hitler', 'nazi', 'terrorist', 'abortion', 'moron',
    // clinical/anatomical terms (not vulgar on their own; slang equivalents remain)
    'condom', 'genital', 'genitalia', 'genitals', 'foreskin', 'vaginal',
    'vulva', 'labia', 'rectal', 'rectum', 'scrotum', 'sperm',
];

/**
 * Expands profanity_words using the snipe/banbuilder English dictionaries.
 * The dictionary data files are gitignored (see docs/PROJECT_HANDOFF.md), so this
 * is a best-effort step: if a developer hasn't run `composer install` since
 * the dependency was added, we skip quietly instead of failing the whole
 * migration run.
 */
function seed_profanity_wordlist(mysqli $conn): array
{
    $autoload = dirname(__DIR__, 2) . '/vendor/autoload.php';
    if (!is_readable($autoload)) {
        return ['seeded' => 0, 'removed' => 0, 'skipped_reason' => 'vendor/autoload.php not found (run composer install)'];
    }
    require_once $autoload;

    if (!class_exists(\Snipe\BanBuilder\CensorWords::class)) {
        return ['seeded' => 0, 'removed' => 0, 'skipped_reason' => 'snipe/banbuilder not installed (run composer install)'];
    }

    try {
        $censor = new \Snipe\BanBuilder\CensorWords();
        $censor->setDictionary(['en-base', 'en-us', 'en-uk']);
        $words = $censor->badwords;
    } catch (\Throwable $e) {
        return ['seeded' => 0, 'removed' => 0, 'skipped_reason' => 'failed to load dictionary: ' . $e->getMessage()];
    }

    $excluded = array_flip(PROFANITY_WORDLIST_EXCLUDED);

    $insertStmt = $conn->prepare('INSERT IGNORE INTO profanity_words (word) VALUES (?)');
    if (!$insertStmt) throw new RuntimeException('Failed to prepare profanity word seed insert');

    $seeded = 0;
    foreach ($words as $word) {
        $word = mb_strtolower(trim((string)$word), 'UTF-8');
        if ($word === '' || mb_strlen($word, 'UTF-8') > 100) continue;
        if (!preg_match('/^[\p{L}\p{N}][\p{L}\p{N}\s\'-]*$/u', $word)) continue;
        if (isset($excluded[$word])) continue;

        $insertStmt->bind_param('s', $word);
        $insertStmt->execute();
        if ($insertStmt->affected_rows > 0) $seeded++;
    }
    $insertStmt->close();

    // Remove any excluded words a prior, less-curated seed run may have already inserted.
    $removed = 0;
    $deleteStmt = $conn->prepare('DELETE FROM profanity_words WHERE word = ?');
    if (!$deleteStmt) throw new RuntimeException('Failed to prepare profanity word cleanup delete');
    foreach (PROFANITY_WORDLIST_EXCLUDED as $word) {
        $deleteStmt->bind_param('s', $word);
        $deleteStmt->execute();
        $removed += $deleteStmt->affected_rows;
    }
    $deleteStmt->close();

    return ['seeded' => $seeded, 'removed' => $removed, 'skipped_reason' => null];
}
