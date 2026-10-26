<?php
// Mentee sign-in. A wrong password counts against the account and the visitor's IP; MAX_TRIES wrong ones lock that pair for LOCK_SECS.
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';
session_open();

$next = safe_next($_GET['next'] ?? $_POST['next'] ?? '');
if (current_user()) { header('Location: ' . $next); exit; }

$err = ''; $user = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = strtolower(trim((string)($_POST['user'] ?? '')));
    $pass = (string)($_POST['pass'] ?? '');
    $st = throttle_state($user);
    if (!csrf_ok()) {
        $err = 'The page expired. Reload it and try again.';
    } elseif ($st['locked'] > 0) {
        $err = 'Too many wrong tries. Try again in ' . ceil($st['locked'] / 60) . ' minutes, or message TheHauData on Zalo ' . ZALO . '.';
        audit('login-locked', $user);
    } else {
        $acc = valid_user($user) ? (accounts()['users'][$user] ?? null) : null;
        $ok = password_verify($pass, $acc['hash'] ?? dummy_hash()) && $acc && !empty($acc['active']);
        if ($ok) {
            throttle_clear($user);
            session_regenerate_id(true);
            $_SESSION['u'] = $user; $_SESSION['t'] = $_SESSION['login'] = time();
            store_update('accounts', function (&$a) use ($user) { $a['users'][$user]['last_login'] = date('c'); });
            audit('login-ok', $user);
            header('Location: ' . $next); exit;
        }
        throttle_fail($user);
        audit('login-fail', $user);
        $st = throttle_state($user);
        $err = $st['locked'] > 0
            ? 'Too many wrong tries. Locked for ' . ceil($st['locked'] / 60) . ' minutes. Message TheHauData on Zalo ' . ZALO . ' if you need help.'
            : 'Wrong username or password. ' . $st['left'] . ' ' . ($st['left'] === 1 ? 'try' : 'tries') . ' left.';
    }
}

page_start('TheHauData Lab · Sign in');
?>
<h1>TheHauData Lab</h1>
<p>This space is for mentees of the TheHauData course. Sign in with the username and password your cohort received.</p>
<?php if ($err): ?><div class="msg bad" role="alert"><?= h($err) ?></div><?php endif; ?>
<form method="post" autocomplete="off">
  <input type="hidden" name="csrf" value="<?= h(csrf()) ?>">
  <input type="hidden" name="next" value="<?= h($next) ?>">
  <label for="u">Username</label>
  <input id="u" type="text" name="user" value="<?= h($user) ?>" autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
  <label for="p">Password</label>
  <input id="p" type="password" name="pass" required>
  <p style="margin:18px 0 0"><button class="btn" type="submit">Sign in</button></p>
</form>
<p class="sm" style="margin-top:18px">No login yet? Message TheHauData on Zalo <?= h(ZALO) ?>.</p>
<?php page_end();
