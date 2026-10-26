<?php
// Shared helpers for the Lab login (pages: login.php, admin.php, logout.php; file server: _gate.php).
// Not a page itself: a direct request gets a 403.
if (!defined('LAB_AUTH')) { http_response_code(403); exit; }

const MAX_TRIES   = 10;     // wrong passwords allowed per account and IP before a lock
const IP_MAX      = 30;     // wrong passwords allowed per IP across all accounts
const LOCK_SECS   = 900;    // a lock, and the window failures are counted in: 15 minutes
const IDLE_SECS   = 43200;  // a mentee session ends after 12 hours without a request
const ALPHABET    = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // no 0/O, 1/l/I look-alikes
const ZALO        = '0362 550 761';

// The accounts live outside the public web folder, so a git deploy never overwrites or exposes them.
// Hostinger layout: .../domains/thehaudata.com/public_html/lab -> .../domains/thehaudata.com/lab-data. LAB_DATA overrides it.
function data_dir(): string { return getenv('LAB_DATA') ?: dirname(__DIR__, 2) . '/lab-data'; }
function base_path(): string { return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/'; }
function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function client_ip(): string { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }   // never trust X-Forwarded-For: a visitor can fake it and dodge the lock

// ---- storage: one JSON file per concern, every change under an exclusive lock and written atomically ----
function store_update(string $name, callable $fn, $default = []) {
    $dir = data_dir();
    if (!is_dir($dir)) { mkdir($dir, 0750, true); }
    $lock = fopen($dir . '/.lock', 'c');
    flock($lock, LOCK_EX);
    $file = "$dir/$name.json";
    $data = is_file($file) ? (json_decode(file_get_contents($file), true) ?? $default) : $default;
    $result = $fn($data);                       // $fn edits $data by reference and may return a value
    $tmp = $file . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    rename($tmp, $file);
    flock($lock, LOCK_UN); fclose($lock);
    return $result;
}
function store_read(string $name, $default = []) {
    $file = data_dir() . "/$name.json";
    return is_file($file) ? (json_decode(file_get_contents($file), true) ?? $default) : $default;
}
function accounts(): array { return store_read('accounts', ['admin' => null, 'users' => []]); }

function audit(string $event, string $who = ''): void {
    $dir = data_dir(); if (!is_dir($dir)) { mkdir($dir, 0750, true); }
    $line = date('c') . "\t" . client_ip() . "\t" . $event . "\t" . preg_replace('/[^\w.@-]/', '', $who) . "\n";
    file_put_contents("$dir/audit.log", $line, FILE_APPEND | LOCK_EX);
}

// ---- retry limit ----
// Failures are counted per account+IP (MAX_TRIES) and per IP (IP_MAX). A cleared-cookie trick does not reset them: they live on the server.
function throttle_keys(string $user): array { $ip = client_ip(); return ["ua:$user|$ip" => MAX_TRIES, "ip:$ip" => IP_MAX]; }
function throttle_state(string $user): array {   // ['locked' => seconds left, 'left' => tries left on the account+IP counter]
    $now = time(); $all = store_read('attempts'); $locked = 0; $left = MAX_TRIES;
    foreach (throttle_keys($user) as $k => $max) {
        $r = $all[$k] ?? null; if (!$r) continue;
        if (($r['until'] ?? 0) > $now) $locked = max($locked, $r['until'] - $now);
        elseif ($now - ($r['first'] ?? 0) < LOCK_SECS && strpos($k, 'ua:') === 0) $left = max(0, $max - ($r['n'] ?? 0));
    }
    return ['locked' => $locked, 'left' => $left];
}
function throttle_fail(string $user): void {
    store_update('attempts', function (&$all) use ($user) {
        $now = time();
        foreach ($all as $k => $r) if (($r['until'] ?? 0) < $now && $now - ($r['first'] ?? 0) > LOCK_SECS) unset($all[$k]);   // prune
        foreach (throttle_keys($user) as $k => $max) {
            $r = $all[$k] ?? ['n' => 0, 'first' => $now, 'until' => 0];
            if ($now - $r['first'] > LOCK_SECS) $r = ['n' => 0, 'first' => $now, 'until' => 0];
            $r['n']++;
            if ($r['n'] >= $max) $r['until'] = $now + LOCK_SECS;
            $all[$k] = $r;
        }
    });
}
function throttle_clear(string $user): void {
    store_update('attempts', function (&$all) use ($user) { unset($all["ua:$user|" . client_ip()]); });
}

// ---- session + csrf ----
function session_open(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['SERVER_PORT'] ?? '') == 443;
    session_name('labsid');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    ini_set('session.use_strict_mode', '1');
    session_start();
}
function csrf(): string { session_open(); return $_SESSION['csrf'] ??= bin2hex(random_bytes(16)); }
function csrf_ok(): bool { session_open(); return isset($_SESSION['csrf'], $_POST['csrf']) && hash_equals($_SESSION['csrf'], (string)$_POST['csrf']); }

// The signed-in mentee, or null. Reads the accounts file each time, so disabling or deleting an account ends its session at once.
function current_user(): ?string {
    session_open();
    $u = $_SESSION['u'] ?? null; if (!$u) return null;
    if (time() - ($_SESSION['t'] ?? 0) > IDLE_SECS) { unset($_SESSION['u']); return null; }
    $acc = accounts()['users'][$u] ?? null;
    if (!$acc || empty($acc['active']) || strtotime($acc['pw_changed'] ?? '') > ($_SESSION['login'] ?? 0)) { unset($_SESSION['u']); return null; }   // disabled, removed or password reset since sign-in
    $_SESSION['t'] = time();
    return $u;
}
function is_admin(): bool { session_open(); return !empty($_SESSION['admin']) && time() - ($_SESSION['admin_t'] ?? 0) < 3600; }

function safe_next(?string $n): string {   // only a path inside the Lab, never another site
    $n = (string)$n; $base = base_path();
    return ($n !== '' && $n[0] === '/' && !str_starts_with($n, '//') && !str_contains($n, '\\') && str_starts_with($n, $base)) ? $n : $base;
}

// ---- passwords: cohort prefix + 12 random characters, e.g. C15-7kQm-Xr4N-p9Dv (about 69 bits) ----
function gen_password(?int $cohort): string {
    $g = []; for ($i = 0; $i < 3; $i++) { $s = ''; for ($j = 0; $j < 4; $j++) $s .= ALPHABET[random_int(0, strlen(ALPHABET) - 1)]; $g[] = $s; }
    return ($cohort ? "C$cohort" : 'LAB') . '-' . implode('-', $g);
}
function valid_user(string $u): bool { return (bool)preg_match('/^[a-z0-9][a-z0-9._-]{1,31}$/', $u); }
function dummy_hash(): string { static $h; return $h ??= password_hash('x', PASSWORD_DEFAULT); }   // equalises timing for unknown accounts

// ---- page shell (Lab look: violet gradient, white card, dark mode) ----
function page_start(string $title, bool $wide = false): void {
    header('Content-Type: text/html; charset=UTF-8'); header('Cache-Control: no-store');
    header('X-Robots-Tag: noindex, nofollow'); header('X-Frame-Options: DENY'); header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'");
    $w = $wide ? '980px' : '440px';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">'
       . '<title>' . h($title) . '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Plus+Jakarta+Sans:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap"><style>'
       . ':root{--ink:#1A0A4F;--muted:#6A5C9C;--line:#DDD6FE;--bg:#F7F5FF;--card:#fff;--v:#5B21FF;--pale:#EDE9FE;--ok:#15803D;--okb:#DCFCE7;--bad:#C2410C;--badb:#FFF3E0;--grad:linear-gradient(135deg,#5B21FF 0%,#9C27FF 55%,#E040FB 100%)}'
       . '@media(prefers-color-scheme:dark){:root{--ink:#EDE9FE;--muted:#A99FD6;--line:#3D2A7A;--bg:#0F0A2E;--card:#1A1245;--v:#A78BFA;--pale:#2A1F66;--ok:#4ADE80;--okb:#10301F;--bad:#FDBA74;--badb:#3A2A12}}'
       . '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px 16px;font:15px/1.55 "Plus Jakarta Sans",system-ui,sans-serif;color:var(--ink);background:var(--bg)}'
       . '.card{width:100%;max-width:' . $w . ';background:var(--card);border:1.5px solid var(--line);border-radius:20px;padding:30px 28px;box-shadow:0 12px 48px rgba(91,33,255,.13)}'
       . 'h1{font:900 1.5rem/1.2 Nunito,system-ui,sans-serif;margin:0 0 6px;letter-spacing:-.02em}h2{font:800 1.05rem Nunito,system-ui,sans-serif;margin:22px 0 8px}p{margin:0 0 14px;color:var(--muted)}'
       . 'label{display:block;font-weight:700;font-size:.85rem;margin:14px 0 5px}input[type=text],input[type=password],input[type=number]{width:100%;font:inherit;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--ink)}'
       . 'input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #FF6D00;outline-offset:2px}'
       . '.btn{font:800 .92rem "Plus Jakarta Sans",system-ui,sans-serif;border:0;border-radius:50px;padding:11px 22px;cursor:pointer;background:var(--grad);color:#fff;box-shadow:0 6px 20px rgba(91,33,255,.3)}'
       . '.btn.s{padding:6px 13px;font-size:.8rem;box-shadow:none}.btn.o{background:var(--card);color:var(--v);border:1.5px solid var(--line);box-shadow:none}.btn.d{background:var(--badb);color:var(--bad);border:1.5px solid var(--bad);box-shadow:none}'
       . '.msg{border-radius:12px;padding:10px 14px;margin:0 0 14px;font-weight:600}.msg.bad{background:var(--badb);color:var(--bad)}.msg.ok{background:var(--okb);color:var(--ok)}'
       . 'table{width:100%;border-collapse:collapse;font-size:.88rem}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}th{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}'
       . 'code,.pw{font-family:"JetBrains Mono",ui-monospace,Consolas,monospace;font-weight:500}.pw{background:var(--pale);border-radius:8px;padding:2px 8px;user-select:all}'
       . '.row{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.row>div{flex:1 1 140px}.tw{overflow-x:auto}form.i{display:inline}.sm{font-size:.82rem;color:var(--muted)}'
       . '.tag{font-size:.72rem;font-weight:800;border-radius:99px;padding:2px 9px;background:var(--okb);color:var(--ok)}.tag.off{background:var(--badb);color:var(--bad)}'
       . '</style></head><body><main class="card">';
}
function page_end(): void { echo '</main></body></html>'; }
