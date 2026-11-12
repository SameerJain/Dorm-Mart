<?php
// Input validation and HTML output escaping.
// Endpoints load this through security.php.


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

