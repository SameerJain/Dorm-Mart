<?php
// Input normalization and HTML output escaping.
// Endpoints load this through security.php.

// INPUT SANITIZATION & VALIDATION

/**
 * Normalize string input before validation or storage.
 *
 * This helper trims, length-limits, removes null bytes, and preserves the
 * existing HTML entity behavior for current call sites. Prefer escape_html()
 * when encoding values specifically for HTML output.
 *
 * @param string $input The input string to sanitize
 * @param int $maxLength Maximum allowed length (default: 1000)
 * @return string Sanitized string
 */
function sanitize_string($input, $maxLength = 1000) {
    if (!is_string($input)) {
        return '';
    }
    
    // Trim whitespace
    $input = trim($input);
    
    // Limit length
    $input = substr($input, 0, $maxLength);
    
    // Remove null bytes
    $input = str_replace("\0", '', $input);
    
    // Keep existing behavior for callers that expect entity-encoded text.
    $input = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    return $input;
}

// UTILITY FUNCTIONS

/**
 * Escape values for HTML output.
 * 
 * Use this for HTML email templates and server-rendered HTML. Do not use it
 * for normal JSON API data that React renders as text.
 * 
 * @param string $str String to escape
 * @return string Escaped string with HTML entities
 */
function escape_html($str) {
    return htmlspecialchars($str ?? '', ENT_QUOTES, 'UTF-8');
}

/**
 * Validate input with custom rules.
 * @param string $input Input to validate
 * @param int $maxLength Maximum length allowed
 * @param string|null $allowedChars Regex pattern for allowed characters
 * @return string|false Validated input or false if invalid
 */
function validate_input($input, $maxLength = 255, $allowedChars = null) {
    $input = trim($input);
    if (strlen($input) > $maxLength) {
        return false;
    }
    if ($allowedChars && !preg_match($allowedChars, $input)) {
        return false;
    }
    return $input;
}

