<?php

declare(strict_types=1);

function profanity_pattern(mysqli $conn): ?string
{
    static $pattern;
    static $loaded = false;

    if ($loaded) return $pattern;
    $loaded = true;

    $result = $conn->query('SELECT word FROM profanity_words WHERE word <> \'\'');
    if (!$result) throw new RuntimeException('Unable to load profanity list');

    $words = [];
    while ($row = $result->fetch_assoc()) {
        $words[] = preg_quote(trim((string)$row['word']), '/');
    }
    if (!$words) return $pattern = null;

    usort($words, static fn(string $a, string $b): int => strlen($b) <=> strlen($a));
    return $pattern = '/(?<![\p{L}\p{N}_])(?:' . implode('|', $words) . ')(?![\p{L}\p{N}_])/iu';
}

function contains_profanity(mysqli $conn, string $content): bool
{
    $pattern = profanity_pattern($conn);
    return $pattern !== null && preg_match($pattern, $content) === 1;
}

function filter_profanity(mysqli $conn, string $content): string
{
    $pattern = profanity_pattern($conn);
    if ($pattern === null || $content === '') return $content;

    return (string)preg_replace_callback($pattern, static function (array $match): string {
        $length = function_exists('mb_strlen') ? mb_strlen($match[0], 'UTF-8') : strlen($match[0]);
        return str_repeat('*', $length);
    }, $content);
}
