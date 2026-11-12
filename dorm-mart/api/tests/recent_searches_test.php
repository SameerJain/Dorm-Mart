<?php
declare(strict_types=1);

require __DIR__ . '/support/integration_harness.php';
harness_start('searchhistory', 2);

$path = 'search/recent_searches.php';
check(api(harness_guest(), $path, null)['status'] === 401, 'history requires login');
check((api(1, $path, null)['body']['data'] ?? null) === [], 'new account has no history');
check(api(1, $path, ['term' => 'desk', 'csrf_token' => 'invalid'])['status'] === 403, 'saving requires CSRF');
foreach (['', '   ', str_repeat('a', 51), ['desk']] as $term) {
    check(api(1, $path, ['term' => $term])['status'] === 400, 'invalid search is rejected');
}
for ($i = 1; $i <= 12; $i++) {
    check(ok(api(1, $path, ['term' => 'search ' . $i])), 'search can be saved');
}
$expected = array_map(fn($i) => 'search ' . $i, range(12, 3));
check((api(1, $path, null)['body']['data'] ?? null) === $expected, 'only the newest ten searches remain');
$res = api(1, $path, ['term' => '  SEARCH 5  ', 'user_id' => 2]);
$terms = $res['body']['data'] ?? [];
check(count($terms) === 10 && $terms[0] === 'SEARCH 5' && !in_array('search 5', $terms, true), 'repeat search moves to front without duplicate');
check((api(2, $path, null)['body']['data'] ?? null) === [], 'submitted user ID cannot change another account');
check(ok(api(2, $path, ['term' => 'private search'])), 'second user saves their own history');
check(ok(api(1, $path, ['term' => '椅子'])), 'Unicode searches are supported');
harness_login(1);
check((api(1, $path, null)['body']['data'][0] ?? null) === '椅子', 'history survives a new login session');
check(api(1, $path, ['action' => 'clear', 'csrf_token' => 'invalid'])['status'] === 403, 'clearing requires CSRF');
check(ok(api(1, $path, ['action' => 'clear'])), 'user can clear history');
check((api(1, $path, null)['body']['data'] ?? null) === [], 'cleared history stays empty');
check((api(2, $path, null)['body']['data'] ?? null) === ['private search'], 'clearing does not affect another user');
$conn->query('DELETE FROM user_accounts WHERE user_id = 2');
check((int)row('SELECT COUNT(*) AS n FROM recent_searches WHERE user_id = 2')['n'] === 0, 'account deletion removes saved searches');
harness_finish();
