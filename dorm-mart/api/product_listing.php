<?php

    header('Content-Type: application/json; charset=utf-8');
    // Preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    // Enforce POST
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method Not Allowed']);
        exit;
    }

    // Read the JSON body from React's fetch()
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    // Handle bad JSON
    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Invalid JSON body']);
        exit;
    }
    $title = trim($data['title']);