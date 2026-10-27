<?php
// Per-login progress: the Lab's saved state (done marks, drafts, notes, unlocks, last position) so a mentee can pick up on another
// device. One small JSON file per login in lab-data/ (outside the web folder). The browser sends only the keys that changed.
//   GET  progress              -> {"user":"c15","data":{"hw:done:L2-01":"1", ...}}
//   POST progress  {"set":{key:value},"del":[key]}  with header X-Lab-Sync: 1
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';

const KEY_RE    = '/^(hw|cs|lab):[A-Za-z0-9:_.\-]{1,100}$/';
const MAX_VALUE = 60000;    // bytes per value: 20,000 characters of any script (the browser sends at most 20,000)
const MAX_KEYS  = 800;      // keys per login
const MAX_BYTES = 600000;   // stored size per login
const MAX_BODY  = 200000;   // one request

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

$user = current_user();
session_write_close();
if (!$user) { http_response_code(401); echo json_encode(['error' => 'Sign in first.']); exit; }
$name = 'progress-' . $user;   // valid_user() limits logins to [a-z0-9._-], so this is a safe file name

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    echo json_encode(['user' => $user, 'data' => (object)store_read($name)], JSON_UNESCAPED_UNICODE);
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST' || ($_SERVER['HTTP_X_LAB_SYNC'] ?? '') !== '1') {   // a custom header cannot be sent cross-site without a CORS preflight
    http_response_code(400); echo json_encode(['error' => 'Bad request.']); exit;
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) { http_response_code(413); echo json_encode(['error' => 'Too large.']); exit; }
$in = json_decode($raw, true);
if (!is_array($in)) { http_response_code(400); echo json_encode(['error' => 'Bad JSON.']); exit; }
$set = is_array($in['set'] ?? null) ? $in['set'] : [];
$del = is_array($in['del'] ?? null) ? $in['del'] : [];
foreach ($set as $k => $v) {
    if (!is_string($k) || !preg_match(KEY_RE, $k) || !is_string($v) || strlen($v) > MAX_VALUE) { http_response_code(400); echo json_encode(['error' => 'Bad key or value.']); exit; }
}
foreach ($del as $k) { if (!is_string($k) || !preg_match(KEY_RE, $k)) { http_response_code(400); echo json_encode(['error' => 'Bad key.']); exit; } }

$ok = true;
store_update($name, function (&$d) use ($set, $del, &$ok) {
    $new = $d;
    foreach ($del as $k) { unset($new[$k]); }
    foreach ($set as $k => $v) { $new[$k] = $v; }
    if (count($new) > MAX_KEYS || strlen(json_encode($new, JSON_UNESCAPED_UNICODE)) > MAX_BYTES) { $ok = false; return; }   // keep the old file
    $d = $new;
});
if (!$ok) { http_response_code(413); echo json_encode(['error' => 'Progress is full.']); exit; }
echo json_encode(['ok' => true]);
