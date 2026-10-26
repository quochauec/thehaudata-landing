<?php
// Model answers, one question at a time, for a signed-in mentee only. The answers file lives in lab-data/ (outside the web folder),
// so they are not in the page, the repo or the public files. Each login may open a limited number of different answers per day.
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';

const ANSWERS_PER_DAY = 25;   // different questions per login per 24 hours; reopening one already opened is free

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$user = current_user();
session_write_close();
if (!$user) { http_response_code(401); echo json_encode(['error' => 'Sign in first.']); exit; }

$id = (string)($_GET['id'] ?? '');
$all = store_read('answers');
if (!preg_match('/^[A-Za-z0-9_-]{1,20}$/', $id) || !isset($all[$id])) { http_response_code(404); echo json_encode(['error' => 'No such question.']); exit; }

$now = time(); $allowed = true; $count = 0;
store_update('reveals', function (&$r) use ($user, $id, $now, &$allowed, &$count) {
    $mine = array_filter($r[$user] ?? [], fn($t) => $now - $t < 86400);   // drop reveals older than a day
    if (!isset($mine[$id]) && count($mine) >= ANSWERS_PER_DAY) { $allowed = false; }
    else { $mine[$id] = $mine[$id] ?? $now; }
    $r[$user] = $mine; $count = count($mine);
});
if (!$allowed) {
    audit("answer-limit $id", $user);
    http_response_code(429);
    echo json_encode(['error' => 'You have opened ' . ANSWERS_PER_DAY . ' model answers in the last 24 hours. Come back tomorrow, or message TheHauData on Zalo ' . ZALO . ' if you need one now.']);
    exit;
}
audit("answer $id", $user);
echo json_encode($all[$id], JSON_UNESCAPED_UNICODE);
