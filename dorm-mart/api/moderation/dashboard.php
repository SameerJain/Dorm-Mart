<?php

declare(strict_types=1);

require_once __DIR__ . '/../helpers/api_bootstrap.php';
require_once __DIR__ . '/../helpers/request.php';
require_once __DIR__ . '/../auth/auth_handle.php';
require_once __DIR__ . '/../database/db_connect.php';

init_json_endpoint('GET');
require_moderator();

// Rows per list page. Each list pages independently:
// ?flagged_page=, ?reports_page=, ?listing_reports_page= (0-based).
const MODERATION_PAGE_SIZE = 50;
const MODERATION_RECENT_ACTIONS = 20;

/** 0-based page number from the query string (invalid or negative -> 0). */
function moderation_page(string $key): int
{
    $page = request_int($_GET, $key);
    return $page > 0 ? min($page, 10000) : 0;
}

/**
 * Run a list query with LIMIT size+1 so we can report whether another page
 * exists without a separate COUNT.
 *
 * @return array{rows: array<int, array<string, mixed>>, page: int, has_more: bool}
 */
function moderation_page_query(mysqli $conn, string $sql, int $page): array
{
    $limit = MODERATION_PAGE_SIZE + 1;
    $offset = $page * MODERATION_PAGE_SIZE;
    $stmt = $conn->prepare($sql . ' LIMIT ? OFFSET ?');
    if (!$stmt) {
        throw new RuntimeException('Failed to prepare moderation list');
    }
    $stmt->bind_param('ii', $limit, $offset);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $hasMore = count($rows) > MODERATION_PAGE_SIZE;
    return [
        'rows' => array_slice($rows, 0, MODERATION_PAGE_SIZE),
        'page' => $page,
        'has_more' => $hasMore,
    ];
}

try {
    $conn = db();
    $conn->set_charset('utf8mb4');

    $statsResult = $conn->query(
        "SELECT
            (SELECT COUNT(*) FROM messages WHERE is_flagged = 1) AS flagged_messages,
            (SELECT COUNT(*) FROM message_reports WHERE status = 'open') AS open_reports,
            (SELECT COUNT(*) FROM message_reports) AS total_reports,
            (SELECT COUNT(*) FROM user_accounts WHERE is_banned = 1) AS banned_users,
            (SELECT COUNT(*) FROM listing_reports WHERE status = 'open') AS open_listing_reports"
    );
    $stats = $statsResult->fetch_assoc();

    $flagged = moderation_page_query(
        $conn,
        "SELECT m.message_id, m.conv_id, m.sender_id, m.sender_fname, m.content, m.original_content,
                DATE_FORMAT(m.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                DATE_FORMAT(m.edited_at, '%Y-%m-%dT%H:%i:%sZ') AS edited_at,
                DATE_FORMAT(m.deleted_at, '%Y-%m-%dT%H:%i:%sZ') AS deleted_at,
                ua.email AS sender_email, ua.role AS sender_role,
                COALESCE(ua.is_banned, 0) AS sender_is_banned
           FROM messages m
           LEFT JOIN user_accounts ua ON ua.user_id = m.sender_id
          WHERE m.is_flagged = 1
          ORDER BY m.created_at DESC, m.message_id DESC",
        moderation_page('flagged_page')
    );

    $reports = moderation_page_query(
        $conn,
        "SELECT r.report_id, r.message_id, r.reported_user_id, r.reason, r.status,
                DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                m.conv_id, m.content, m.original_content,
                DATE_FORMAT(m.edited_at, '%Y-%m-%dT%H:%i:%sZ') AS edited_at,
                DATE_FORMAT(m.deleted_at, '%Y-%m-%dT%H:%i:%sZ') AS deleted_at,
                COALESCE(m.sender_fname, 'Deleted User') AS sender_name,
                CONCAT_WS(' ', reporter.first_name, reporter.last_name) AS reporter_name,
                reported.email AS reported_user_email, reported.role AS reported_user_role,
                COALESCE(reported.is_banned, 0) AS reported_user_is_banned
           FROM message_reports r
           JOIN messages m ON m.message_id = r.message_id
           LEFT JOIN user_accounts reporter ON reporter.user_id = r.reporter_id
           LEFT JOIN user_accounts reported ON reported.user_id = r.reported_user_id
          ORDER BY (r.status = 'open') DESC, r.created_at DESC, r.report_id DESC",
        moderation_page('reports_page')
    );

    $listingReports = moderation_page_query(
        $conn,
        "SELECT lr.report_id, lr.product_id, lr.seller_id, lr.listing_title, lr.reason, lr.details, lr.status,
                DATE_FORMAT(lr.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                i.item_status, i.listing_price,
                (SELECT COUNT(*) FROM listing_reports other
                  WHERE other.product_id = lr.product_id AND other.status = 'open') AS open_reports_for_listing,
                CONCAT_WS(' ', seller.first_name, seller.last_name) AS seller_name,
                seller.role AS seller_role,
                COALESCE(seller.is_banned, 0) AS seller_is_banned,
                CONCAT_WS(' ', reporter.first_name, reporter.last_name) AS reporter_name
           FROM listing_reports lr
           LEFT JOIN INVENTORY i ON i.product_id = lr.product_id
           LEFT JOIN user_accounts seller ON seller.user_id = lr.seller_id
           LEFT JOIN user_accounts reporter ON reporter.user_id = lr.reporter_id
          ORDER BY (lr.status = 'open') DESC, lr.created_at DESC, lr.report_id DESC",
        moderation_page('listing_reports_page')
    );

    // Audit trail (migration 028). Optional: an older database without the
    // table still gets a working dashboard.
    $recentActions = [];
    try {
        $actionsResult = $conn->query(
            "SELECT a.action_id, a.action, a.target_type, a.target_id, a.details,
                    DATE_FORMAT(a.created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at,
                    CONCAT_WS(' ', moderator.first_name, moderator.last_name) AS moderator_name,
                    CONCAT_WS(' ', target.first_name, target.last_name) AS target_user_name
               FROM moderation_actions a
               LEFT JOIN user_accounts moderator ON moderator.user_id = a.moderator_id
               LEFT JOIN user_accounts target ON target.user_id = a.target_user_id
              ORDER BY a.created_at DESC, a.action_id DESC
              LIMIT " . MODERATION_RECENT_ACTIONS
        );
        if ($actionsResult) {
            $recentActions = $actionsResult->fetch_all(MYSQLI_ASSOC);
        }
    } catch (Throwable $e) {
        error_log('moderation dashboard: audit trail unavailable: ' . $e->getMessage());
    }

    json_response([
        'success' => true,
        'stats' => [
            'flagged_messages' => (int)$stats['flagged_messages'],
            'open_reports' => (int)$stats['open_reports'],
            'total_reports' => (int)$stats['total_reports'],
            'banned_users' => (int)$stats['banned_users'],
            'open_listing_reports' => (int)$stats['open_listing_reports'],
        ],
        'flagged_messages' => $flagged['rows'],
        'reports' => $reports['rows'],
        'listing_reports' => $listingReports['rows'],
        'recent_actions' => $recentActions,
        'pagination' => [
            'page_size' => MODERATION_PAGE_SIZE,
            'flagged_messages' => ['page' => $flagged['page'], 'has_more' => $flagged['has_more']],
            'reports' => ['page' => $reports['page'], 'has_more' => $reports['has_more']],
            'listing_reports' => ['page' => $listingReports['page'], 'has_more' => $listingReports['has_more']],
        ],
    ]);
} catch (Throwable $e) {
    error_log('moderation dashboard error: ' . $e->getMessage());
    json_response(['success' => false, 'error' => 'Server error'], 500);
}
