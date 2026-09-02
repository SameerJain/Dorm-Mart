<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint();
require_moderator();

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $result = $conn->query('SELECT word FROM profanity_words ORDER BY word');
        json_response(['success' => true, 'words' => array_column($result->fetch_all(MYSQLI_ASSOC), 'word')]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['success' => false, 'error' => 'Method Not Allowed'], 405);
    }

    $input = json_request_body();
    require_csrf_token($input['csrf_token'] ?? null);
    if (!is_string($input['action'] ?? 'add') || !is_string($input['word'] ?? null)) {
        json_response(['success' => false, 'error' => 'Invalid action or word'], 400);
    }
    $action = $input['action'] ?? 'add';
    $word = trim($input['word']);
    $word = function_exists('mb_strtolower') ? mb_strtolower($word, 'UTF-8') : strtolower($word);
    $length = function_exists('mb_strlen') ? mb_strlen($word, 'UTF-8') : strlen($word);

    if ($word === '' || $length > 100 || !preg_match('/^[\p{L}\p{N}][\p{L}\p{N}\s\'-]*$/u', $word)) {
        json_response(['success' => false, 'error' => 'Enter a valid word or phrase'], 400);
    }

    if ($action === 'delete') {
        $stmt = $conn->prepare('DELETE FROM profanity_words WHERE word = ?');
    } elseif ($action === 'add') {
        $stmt = $conn->prepare('INSERT IGNORE INTO profanity_words (word) VALUES (?)');
    } else {
        json_response(['success' => false, 'error' => 'Invalid action'], 400);
    }
    $stmt->bind_param('s', $word);
    $stmt->execute();
    $stmt->close();

    json_response(['success' => true, 'word' => $word, 'action' => $action]);
} catch (Throwable $e) {
    error_log('profanity word management error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
