<?php
declare(strict_types=1);

/**
 * Stream a stored file with HTTP byte-range support.
 *
 * Browsers request video in ranges: iOS Safari will not play an MP4 from a
 * server that ignores `Range`, and every browser needs it to seek. Images
 * work either way, so both media endpoints use this.
 */

/**
 * Parse a single-range `Range` header against a file size.
 *
 * Returns [start, end] (inclusive) for a satisfiable range, null when the
 * header is absent or not a single byte range (serve the whole file), and
 * false when the range cannot be satisfied (respond 416).
 *
 * @return array{0:int,1:int}|null|false
 */
function parse_byte_range(?string $header, int $size)
{
    if ($header === null || $header === '' || $size <= 0) {
        return null;
    }
    if (!preg_match('/^bytes=(\d*)-(\d*)$/', trim($header), $m)) {
        return null; // multi-range or malformed: fall back to a full response
    }
    [$startRaw, $endRaw] = [$m[1], $m[2]];
    if ($startRaw === '' && $endRaw === '') {
        return null;
    }

    if ($startRaw === '') {
        // Suffix range: the last N bytes.
        $length = (int)$endRaw;
        if ($length <= 0) {
            return false;
        }
        return [max(0, $size - $length), $size - 1];
    }

    $start = (int)$startRaw;
    $end = $endRaw === '' ? $size - 1 : min((int)$endRaw, $size - 1);
    if ($start >= $size || $start > $end) {
        return false;
    }
    return [$start, $end];
}

/**
 * Send headers and body for $path. Callers set any extra headers (cache
 * policy, disposition) first. Exits when done.
 */
function stream_file_with_ranges(string $path, string $mime): void
{
    $size = (int)filesize($path);
    $range = parse_byte_range($_SERVER['HTTP_RANGE'] ?? null, $size);

    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');

    if ($range === false) {
        http_response_code(416);
        header('Content-Range: bytes */' . $size);
        exit;
    }

    [$start, $end] = $range ?? [0, $size - 1];
    $length = $size > 0 ? $end - $start + 1 : 0;

    if ($range !== null) {
        http_response_code(206);
        header("Content-Range: bytes {$start}-{$end}/{$size}");
    }
    header('Content-Length: ' . $length);

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD' || $length === 0) {
        exit;
    }

    $handle = fopen($path, 'rb');
    if ($handle === false) {
        exit;
    }
    fseek($handle, $start);
    $remaining = $length;
    while ($remaining > 0 && !feof($handle)) {
        $chunk = fread($handle, (int)min(65536, $remaining));
        if ($chunk === false || $chunk === '') {
            break;
        }
        echo $chunk;
        $remaining -= strlen($chunk);
        if (connection_aborted()) {
            break;
        }
    }
    fclose($handle);
    exit;
}
