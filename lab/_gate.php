<?php
// Serves every Lab file, but only to a signed-in mentee. .htaccess sends all requests here, so a file cannot be fetched by its URL alone.
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';

$base = base_path();
$uri = $_SERVER['REDIRECT_URL'] ?? $_SERVER['REQUEST_URI'] ?? '/';   // REDIRECT_URL is the URL the visitor asked for, before the rewrite
$rel = ltrim(substr(rawurldecode(parse_url($uri, PHP_URL_PATH) ?: '/'), strlen($base) - 1), '/');
if ($rel === '' || substr($rel, -1) === '/') $rel .= 'index.html';

$mentee = current_user();
session_write_close();   // release the session lock now, so the dozens of parallel file requests on a page load do not queue behind each other

if (!$mentee) {
    $wantsPage = preg_match('/\.html?$/i', $rel) || str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'text/html');
    if ($wantsPage) { header('Location: ' . $base . 'login?next=' . rawurlencode($uri)); exit; }
    http_response_code(401); header('Content-Type: text/plain'); echo 'Sign in to the Lab first.'; exit;
}

// Only plain content files: no PHP, no dotfiles, no underscore files, no folder walking.
$parts = explode('/', $rel);
foreach ($parts as $p) if ($p === '' || $p === '.' || $p === '..' || $p[0] === '.' || $p[0] === '_') { http_response_code(404); exit; }
$file = realpath(__DIR__ . '/' . $rel);
$root = realpath(__DIR__);
if ($file === false || !is_file($file) || strpos($file, $root . DIRECTORY_SEPARATOR) !== 0 || preg_match('/\.(php|htaccess|htpasswd|log)$/i', $file)) { http_response_code(404); echo 'Not found'; exit; }

$types = ['html' => 'text/html; charset=UTF-8', 'js' => 'application/javascript; charset=UTF-8', 'mjs' => 'application/javascript; charset=UTF-8',
  'json' => 'application/json; charset=UTF-8', 'css' => 'text/css; charset=UTF-8', 'csv' => 'text/csv; charset=UTF-8', 'txt' => 'text/plain; charset=UTF-8',
  'wasm' => 'application/wasm', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'gif' => 'image/gif',
  'webp' => 'image/webp', 'ico' => 'image/x-icon', 'zip' => 'application/zip', 'woff2' => 'font/woff2'];
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
if (!isset($types[$ext])) { http_response_code(404); echo 'Not found'; exit; }

$mtime = filemtime($file); $size = filesize($file);
$etag = '"' . dechex($mtime) . '-' . dechex($size) . '"';
header('Content-Type: ' . $types[$ext]);
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
header('ETag: ' . $etag);
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
// Private: a shared cache must never hand the file to someone who is not signed in. Pages, scripts and JSON revalidate; big data keeps a day.
header('Cache-Control: ' . (in_array($ext, ['html', 'js', 'mjs', 'json'], true) ? 'private, no-cache' : 'private, max-age=86400'));
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
header('Content-Length: ' . $size);
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'HEAD') exit;
readfile($file);
