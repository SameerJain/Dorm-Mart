<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
    // Full path to categories.json in this same directory
    $filePath = __DIR__ . '/categories.json';

    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode([
            'ok'    => false,
            'error' => 'categories.json file not found'
        ]);
        exit;
    }

    $json = file_get_contents($filePath);
    if ($json === false) {
        throw new RuntimeException('Unable to read categories.json');
    }

    $data = json_decode($json, true);
    if (!is_array($data)) {
        throw new RuntimeException('Invalid JSON format in categories.json. Expected an array.');
    }

    // ✅ success: just return the array
    echo json_encode($data);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok'    => false,
        'error' => $e->getMessage()
    ]);
}
