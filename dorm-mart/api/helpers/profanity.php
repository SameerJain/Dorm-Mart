<?php

declare(strict_types=1);

/**
 * Chat profanity filter.
 *
 * Words live in the profanity_words table. Each word becomes a pattern that
 * also catches the usual evasions:
 *   - look-alike characters: "sh1t", "$hit", "b00bs", "a$$"
 *   - stretched letters: "fuuuck"
 *   - punctuation or invisible characters between letters: "f.u.c.k", "f*ck" is
 *     NOT caught (the star replaces a letter), zero-width spaces are
 *   - a few endings: "shits", "fucked", "fucking", "shitty"
 * Matches must stand alone as a word, so innocent words that merely contain a
 * blocked word ("Scunthorpe", "class", "assess") are never starred.
 *
 * The pure functions (profanity_build_patterns / profanity_text_matches /
 * profanity_censor) take the word list directly so they can be tested without
 * a database; contains_profanity / filter_profanity load it per request.
 */

/**
 * Maximum source length of one compiled regex. PCRE refuses patterns whose
 * compiled form passes its size limit (sources around 55 KB failed with
 * "Internal error"), so the list is split by size, not by word count.
 */
const PROFANITY_PATTERN_MAX_BYTES = 20000;

/** Look-alike characters accepted for each letter (lowercase; matching is case-insensitive). */
const PROFANITY_LOOKALIKES = [
    'a' => 'a4@àáâãäå',
    'b' => 'b8',
    'e' => 'e3èéêë',
    'g' => 'g9',
    'i' => 'i1!|ìíîï',
    'l' => 'l1|',
    'o' => 'o0òóôõö',
    's' => 's5$',
    't' => 't7',
    'u' => 'uùúûü',
];

/** Characters allowed between letters: punctuation used to split a word, and invisible characters. */
const PROFANITY_SEPARATOR = '[.\-_~\x{00AD}\x{200B}-\x{200D}\x{2060}\x{FEFF}]*';

/** Endings accepted after a listed word ("er" is left out: "dicker" means to haggle). */
const PROFANITY_SUFFIX = '(?:s|es|ed|ing|y)?';

function profanity_word_regex(string $word): string
{
    $word = function_exists('mb_strtolower') ? mb_strtolower(trim($word), 'UTF-8') : strtolower(trim($word));
    $chars = preg_split('//u', $word, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $units = [];
    foreach ($chars as $char) {
        if (isset(PROFANITY_LOOKALIKES[$char])) {
            $variants = preg_split('//u', PROFANITY_LOOKALIKES[$char], -1, PREG_SPLIT_NO_EMPTY) ?: [$char];
            $class = implode('', array_map(static fn(string $v): string => preg_quote($v, '/'), $variants));
            $units[] = '[' . str_replace(['-', ']', '^'], ['\-', '\]', '\^'], $class) . ']+';
        } elseif (preg_match('/^\s$/u', $char)) {
            // Multi-word phrases: any run of whitespace between the words.
            $units[] = '\s+';
            continue;
        } else {
            $units[] = '(?:' . preg_quote($char, '/') . ')+';
        }
    }
    return implode(PROFANITY_SEPARATOR, $units);
}

/**
 * Compile the word list into a few regexes. Longer words come first so a
 * phrase wins over a word it contains.
 *
 * @param string[] $words
 * @return string[]
 */
function profanity_build_patterns(array $words): array
{
    $words = array_values(array_unique(array_filter(array_map(
        static fn($w): string => trim((string)$w),
        $words
    ), static fn(string $w): bool => $w !== '')));
    if (!$words) return [];

    usort($words, static fn(string $a, string $b): int => strlen($b) <=> strlen($a));

    $wrap = static fn(array $alternatives): string =>
        '/(?<![\p{L}\p{N}_])(?:' . implode('|', $alternatives) . ')'
        . PROFANITY_SUFFIX . '(?![\p{L}\p{N}_])/iu';

    $patterns = [];
    $current = [];
    $size = 0;
    foreach ($words as $word) {
        $regex = profanity_word_regex($word);
        if ($current && $size + strlen($regex) + 1 > PROFANITY_PATTERN_MAX_BYTES) {
            $patterns[] = $wrap($current);
            $current = [];
            $size = 0;
        }
        $current[] = $regex;
        $size += strlen($regex) + 1;
    }
    if ($current) {
        $patterns[] = $wrap($current);
    }
    return $patterns;
}

/** @param string[] $patterns */
function profanity_text_matches(array $patterns, string $text): bool
{
    foreach ($patterns as $pattern) {
        $result = @preg_match($pattern, $text);
        if ($result === 1) return true;
        if ($result === false) {
            error_log('profanity: pattern failed: ' . preg_last_error_msg());
        }
    }
    return false;
}

/**
 * Replace each match with one asterisk per character. On a regex failure the
 * text is returned unchanged: showing a message beats wiping it to "".
 *
 * @param string[] $patterns
 */
function profanity_censor(array $patterns, string $text): string
{
    if (!$patterns || $text === '') return $text;

    $censored = @preg_replace_callback($patterns, static function (array $match): string {
        $length = function_exists('mb_strlen') ? mb_strlen($match[0], 'UTF-8') : strlen($match[0]);
        return str_repeat('*', $length);
    }, $text);

    if ($censored === null) {
        error_log('profanity: censor failed: ' . preg_last_error_msg());
        return $text;
    }
    return $censored;
}

/**
 * The compiled patterns for this request (the word list is read once).
 *
 * @return string[]
 */
function profanity_patterns(mysqli $conn): array
{
    static $patterns = null;
    if ($patterns !== null) return $patterns;

    try {
        $result = $conn->query('SELECT word FROM profanity_words WHERE word <> \'\'');
    } catch (Throwable $e) {
        $result = false;
    }
    if (!$result) {
        // A missing or unreadable table must not take chat down with it.
        error_log('profanity: unable to load word list');
        return $patterns = [];
    }

    $words = [];
    while ($row = $result->fetch_assoc()) {
        $words[] = (string)$row['word'];
    }
    return $patterns = profanity_build_patterns($words);
}

function contains_profanity(mysqli $conn, string $content): bool
{
    return profanity_text_matches(profanity_patterns($conn), $content);
}

function filter_profanity(mysqli $conn, string $content): string
{
    return profanity_censor(profanity_patterns($conn), $content);
}
