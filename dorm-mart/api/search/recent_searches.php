<?php
declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';
init_json_endpoint();

$conn = null;
try {
    $userId = require_login();
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        json_response(['success' => false, 'error' => 'Method Not Allowed'], 405);
    }
    if ($method === 'POST') {
        $input = json_request_body_or_error();
        require_csrf_token($input['csrf_token'] ?? null);
        $action = $input['action'] ?? 'save';
        $term = is_string($input['term'] ?? null) ? trim($input['term']) : '';
        if (!in_array($action, ['save', 'clear'], true)
            || ($action === 'save' && ($term === '' || mb_strlen($term) > 50))) {
            json_response(['success' => false, 'error' => 'Search must be between 1 and 50 characters.'], 400);
        }
    }

    $conn = db();
    if ($method === 'POST') {
        $conn->begin_transaction();
        // Creating/locking the account's single row serializes saves and clears.
        $insert = $conn->prepare("INSERT INTO recent_searches (user_id, search_terms) VALUES (?, '[]') ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)");
        $insert->bind_param('i', $userId);
        $insert->execute();
        $insert->close();
    }
    $stmt = $conn->prepare('SELECT search_terms FROM recent_searches WHERE user_id = ?');
    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $terms = $row ? json_decode($row['search_terms'], true) : [];

    if ($method === 'POST') {
        $terms = $action === 'clear' ? [] : array_slice([
            $term,
            ...array_values(array_filter($terms, fn($old) => mb_strtolower($old) !== mb_strtolower($term))),
        ], 0, 10);
        $json = json_encode($terms, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $update = $conn->prepare('UPDATE recent_searches SET search_terms = ? WHERE user_id = ?');
        $update->bind_param('si', $json, $userId);
        $update->execute();
        $update->close();
        $conn->commit();
    }
    json_response(['success' => true, 'data' => $terms]);
} catch (Throwable $e) {
    if ($conn instanceof mysqli) {
        try { $conn->rollback(); } catch (Throwable $ignored) {}
    }
    error_log('recent searches: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Unable to load or update search history'], 500);
}
