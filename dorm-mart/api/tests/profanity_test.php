<?php
declare(strict_types=1);

// Profanity filter checks against a small in-memory word list. No database.

require_once __DIR__ . '/../helpers/profanity.php';

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$checks = 0;

function expect_censor(array $patterns, string $input, string $expected, string $message): void
{
    global $checks;
    $checks++;
    $actual = profanity_censor($patterns, $input);
    if ($actual !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nInput:    {$input}\nExpected: {$expected}\nActual:   {$actual}\n");
        exit(1);
    }
}

function expect_flag(array $patterns, string $input, bool $expected, string $message): void
{
    global $checks;
    $checks++;
    if (profanity_text_matches($patterns, $input) !== $expected) {
        fwrite(STDERR, "FAIL: {$message}\nInput: {$input}\n");
        exit(1);
    }
}

$patterns = profanity_build_patterns(['shit', 'fuck', 'ass', 'boobs', 'son of a bitch']);

// Plain matches and case.
expect_censor($patterns, 'what the fuck', 'what the ****', 'plain word');
expect_censor($patterns, 'SHIT happens', '**** happens', 'case-insensitive');
expect_censor($patterns, 'no, shit!', 'no, ****!', 'punctuation around the word');

// Evasions.
expect_censor($patterns, 'sh1t', '****', 'digit look-alike');
expect_censor($patterns, '$hit', '****', 'symbol look-alike');
expect_censor($patterns, 'b00bs', '*****', 'zeros for o');
expect_censor($patterns, 'fuuuuck', '*******', 'stretched letters');
expect_censor($patterns, 'f.u.c.k off', '******* off', 'dots between letters');
expect_censor($patterns, "sh\u{200B}it", '*****', 'zero-width space inside the word');

// Endings.
expect_censor($patterns, 'this is shitty', 'this is ******', '-y ending');
expect_censor($patterns, 'fucking great', '******* great', '-ing ending');
expect_censor($patterns, 'he fucked up', 'he ****** up', '-ed ending');

// Phrases.
expect_censor($patterns, 'you son of a  bitch', 'you ***************', 'multi-word phrase with extra space');

// No false positives inside other words.
foreach (['class', 'assess', 'passage', 'Scunthorpe', 'shiitake', 'bass guitar', 'glasses'] as $clean) {
    expect_censor($patterns, $clean, $clean, "innocent word {$clean} untouched");
    expect_flag($patterns, $clean, false, "innocent word {$clean} not flagged");
}
expect_censor($patterns, 'the class is fun', 'the class is fun', 'clean sentence unchanged');

// Flagging.
expect_flag($patterns, 'what the sh1t', true, 'evasion is flagged');
expect_flag($patterns, 'lovely day', false, 'clean text not flagged');

// Empty list and empty text.
expect_censor([], 'shit', 'shit', 'no words means no filtering');
expect_censor($patterns, '', '', 'empty text');

// A large list still compiles (chunking keeps each regex under PCRE limits).
$many = [];
for ($i = 0; $i < 2000; $i++) {
    $many[] = 'word' . $i . 'x';
}
$bigPatterns = profanity_build_patterns($many);
$checks++;
if (count($bigPatterns) < 2) {
    fwrite(STDERR, "FAIL: large lists should be split into several patterns\n");
    exit(1);
}
expect_censor($bigPatterns, 'say word1999x now', 'say ********* now', 'last word of a large list matches');

echo "PASS: {$checks} profanity checks\n";
