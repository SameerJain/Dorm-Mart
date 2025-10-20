<?php
/**
 * Input Sanitization Functions for XSS Protection
 */

/**
 * Sanitize string input to prevent XSS
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
    
    // HTML encode special characters to prevent XSS
    $input = htmlspecialchars($input, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    
    return $input;
}

/**
 * Sanitize email input
 * @param string $email Email to sanitize
 * @return string Sanitized email
 */
function sanitize_email($email) {
    if (!is_string($email)) {
        return '';
    }
    
    // Convert to lowercase and trim
    $email = strtolower(trim($email));
    
    // Validate email format
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return '';
    }
    
    // Additional sanitization
    $email = sanitize_string($email, 254); // RFC 5321 limit
    
    return $email;
}

/**
 * Sanitize numeric input
 * @param mixed $input Input to sanitize
 * @param int $min Minimum allowed value
 * @param int $max Maximum allowed value
 * @return int|false Sanitized number or false if invalid
 */
function sanitize_number($input, $min = 0, $max = 999999) {
    // Convert to integer
    $number = intval($input);
    
    // Check bounds
    if ($number < $min || $number > $max) {
        return false;
    }
    
    return $number;
}

/**
 * Sanitize JSON input
 * @param string $json JSON string to sanitize
 * @return array|false Sanitized array or false if invalid
 */
function sanitize_json($json) {
    if (!is_string($json)) {
        return false;
    }
    
    // Decode JSON
    $data = json_decode($json, true);
    
    if (json_last_error() !== JSON_ERROR_NONE) {
        return false;
    }
    
    // Recursively sanitize all string values
    $data = sanitize_array($data);
    
    return $data;
}

/**
 * Recursively sanitize array values
 * @param array $data Array to sanitize
 * @return array Sanitized array
 */
function sanitize_array($data) {
    if (!is_array($data)) {
        return sanitize_string($data);
    }
    
    $sanitized = [];
    foreach ($data as $key => $value) {
        $sanitizedKey = sanitize_string($key, 100);
        $sanitizedValue = is_array($value) ? sanitize_array($value) : sanitize_string($value);
        $sanitized[$sanitizedKey] = $sanitizedValue;
    }
    
    return $sanitized;
}

/**
 * Validate and sanitize file upload
 * @param array $file $_FILES array element
 * @param array $allowedTypes Allowed MIME types
 * @param int $maxSize Maximum file size in bytes
 * @return array|false Sanitized file info or false if invalid
 */
function sanitize_file_upload($file, $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], $maxSize = 5242880) {
    if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        return false;
    }
    
    // Check file size
    if ($file['size'] > $maxSize) {
        return false;
    }
    
    // Check MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    if (!in_array($mimeType, $allowedTypes)) {
        return false;
    }
    
    // Sanitize filename
    $filename = sanitize_string(basename($file['name']), 255);
    
    return [
        'name' => $filename,
        'type' => $mimeType,
        'size' => $file['size'],
        'tmp_name' => $file['tmp_name']
    ];
}
?>
