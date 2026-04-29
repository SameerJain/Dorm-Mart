<?php
declare(strict_types=1);

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../helpers/response.php';
init_security();

// Handle preflight OPTIONS request
allow_options_request(200);

try {
    // Full path to categories.json in this same directory
    $filePath = __DIR__ . '/categories.json';

    if (!file_exists($filePath)) {
        json_response([
            'ok'    => false,
            'error' => 'categories.json file not found'
        ], 404);
    }

    $json = file_get_contents($filePath);
    if ($json === false) {
        throw new RuntimeException('Unable to read categories.json');
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON format in categories.json. Expected an array.');
    }
    
    // Remove "Misc." from array if it exists (to place it at the end)
    $miscIndex = array_search("Misc.", $data);
    $miscCategory = false;
    if ($miscIndex !== false) {
        $miscCategory = $data[$miscIndex];
        unset($data[$miscIndex]);
        $data = array_values($data); // Re-index array
    }
    
    // Sort alphabetically (A-Z) by the first letter of each element
    usort($data, function($a, $b) {
        return strcasecmp($a[0], $b[0]); // Compare first character case-insensitively
    });
    
    // Find "Utility" and place "Misc." right after it
    if ($miscCategory !== false) {
        $utilityIndex = array_search("Utility", $data);
        if ($utilityIndex !== false) {
            // Insert "Misc." after "Utility"
            array_splice($data, $utilityIndex + 1, 0, $miscCategory);
        } else {
            // If "Utility" not found, just append to end
            $data[] = $miscCategory;
        }
    }

    // ✅ success: just return the array
    json_response($data);

} catch (Throwable $e) {
    error_log('get_categories error: ' . $e->getMessage());
    json_response(['ok' => false, 'error' => 'Server error'], 500);
}
