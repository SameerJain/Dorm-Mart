<?php

// Set JSON response header
header('Content-Type: application/json');

// Enable CORS for frontend testing
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get the request method
$method = $_SERVER['REQUEST_METHOD'];

// Initialize response
$response = [
    'success' => true,
    'method' => $method,
    'timestamp' => date('Y-m-d H:i:s'),
    'message' => 'AJAX test endpoint working!'
];

// Handle different request methods
switch ($method) {
    case 'GET':
        $response['data'] = [
            'type' => 'GET request received',
            'query_params' => $_GET,
            'server_info' => [
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Not provided',
                'remote_addr' => $_SERVER['REMOTE_ADDR'] ?? 'Not provided'
            ]
        ];
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        $response['data'] = [
            'type' => 'POST request received',
            'post_data' => $input,
            'content_type' => $_SERVER['CONTENT_TYPE'] ?? 'Not provided'
        ];
        break;
        
    default:
        $response['success'] = false;
        $response['error'] = 'Unsupported request method: ' . $method;
        break;
}

// Add some additional test data for frontend consumption
$response['test_data'] = [
    'seller_listings' => [
        ['id' => 1, 'title' => 'Test Item 1', 'status' => 'active'],
        ['id' => 2, 'title' => 'Test Item 2', 'status' => 'sold'],
        ['id' => 3, 'title' => 'Test Item 3', 'status' => 'draft']
    ],
    'statistics' => [
        'active_listings' => 1,
        'pending_sales' => 0,
        'items_sold' => 1,
        'saved_drafts' => 1,
        'total_views' => 15
    ]
];

echo json_encode($response, JSON_PRETTY_PRINT);

?>
