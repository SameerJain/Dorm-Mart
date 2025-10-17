<?php
// XSS Protection Helper Functions

function escapeHtml($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

function escapeJson($str) {
    return json_encode($str ?? '', JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP);
}

function validateInput($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

function setSecurityHeaders() {
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;");
    header("X-Content-Type-Options: nosniff");
    header("X-Frame-Options: DENY");
    header("Referrer-Policy: strict-origin-when-cross-origin");
}
?>
