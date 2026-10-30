<?php
// Owner page: add, change, disable and remove mentee logins, issue new passwords, clear locks. Separate admin password, same retry limit.
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';
session_open();

$err = ''; $flash = []; $issued = [];   // $issued: [username, password] pairs, shown once; only the hash is stored

// ---- admin sign-in ----
if (!is_admin()) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['do'] ?? '') === 'signin') {
        $st = throttle_state('~admin');
        $adm = accounts()['admin'];
        if (!csrf_ok()) $err = 'The page expired. Reload it and try again.';
        elseif ($st['locked'] > 0) { $err = 'Locked. Try again in ' . ceil($st['locked'] / 60) . ' minutes.'; audit('admin-locked'); }
        else {
            $ok = $adm && password_verify((string)($_POST['pass'] ?? ''), $adm['hash'] ?? dummy_hash()) && strtolower(trim((string)($_POST['user'] ?? ''))) === ($adm['user'] ?? '');
            if ($ok) { throttle_clear('~admin'); session_regenerate_id(true); $_SESSION['admin'] = 1; $_SESSION['admin_t'] = time(); audit('admin-ok', $adm['user']); header('Location: ' . base_path() . 'admin'); exit; }
            throttle_fail('~admin'); audit('admin-fail');
            $st = throttle_state('~admin');
            $err = $st['locked'] > 0 ? 'Too many wrong tries. Locked for ' . ceil($st['locked'] / 60) . ' minutes.' : 'Wrong admin username or password. ' . $st['left'] . ' tries left.';
        }
    }
    page_start('Lab admin · Sign in');
    echo '<h1>Lab admin</h1><p>Owner sign-in. This is not the mentee login.</p>';
    if ($err) echo '<div class="msg bad" role="alert">' . h($err) . '</div>';
    echo '<form method="post"><input type="hidden" name="do" value="signin"><input type="hidden" name="csrf" value="' . h(csrf()) . '">'
       . '<label for="u">Admin username</label><input id="u" type="text" name="user" autocapitalize="none" required autofocus>'
       . '<label for="p">Password</label><input id="p" type="password" name="pass" required>'
       . '<p style="margin:18px 0 0"><button class="btn" type="submit">Sign in</button></p></form>';
    page_end(); exit;
}
$_SESSION['admin_t'] = time();

// ---- actions (POST only, CSRF checked) ----
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_ok()) { $err = 'The page expired. Reload it and try again.'; }
    else {
        $do = (string)($_POST['do'] ?? ''); $u = strtolower(trim((string)($_POST['user'] ?? '')));
        $cohort = ($_POST['cohort'] ?? '') !== '' ? max(1, min(999, (int)$_POST['cohort'])) : null;
        $now = date('c');
        $exp = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_POST['expires'] ?? '')) ? $_POST['expires'] : null;
        $make = function (string $name, ?int $c, string $note, ?string $exp = null) use (&$issued, $now) {   // create or replace one account with a fresh password
            $pw = gen_password($c);
            store_update('accounts', function (&$a) use ($name, $c, $note, $pw, $now, $exp) {
                $old = $a['users'][$name] ?? [];
                $a['users'][$name] = ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'cohort' => $c ?? ($old['cohort'] ?? null), 'note' => $note !== '' ? $note : ($old['note'] ?? ''),
                    'active' => true, 'expires' => $exp ?? ($old['expires'] ?? null), 'created' => $old['created'] ?? $now, 'last_login' => $old['last_login'] ?? null, 'pw_changed' => $now];
            }, ['admin' => null, 'users' => []]);
            $issued[] = [$name, $pw];
        };
        $exists = fn(string $n) => isset(accounts()['users'][$n]);
        switch ($do) {
            case 'add':
                if (!valid_user($u)) $err = 'Username: 2 to 32 characters, lowercase letters, digits, dot, dash or underscore.';
                elseif ($exists($u)) $err = "$u already exists. Use Reset password to issue a new one.";
                else { $make($u, $cohort, trim((string)($_POST['note'] ?? '')), $exp); audit('admin-add', $u); }
                break;
            case 'bulk':   // one login per cohort, c<N>, for a range of cohorts
                $from = max(1, (int)($_POST['from'] ?? 0)); $to = min(999, (int)($_POST['to'] ?? 0));
                if ($from < 1 || $to < $from || $to - $from > 49) $err = 'Enter a range of up to 50 cohorts, for example 15 to 24.';
                else { $n = 0; for ($c = $from; $c <= $to; $c++) if (!$exists("c$c")) { $make("c$c", $c, '', $exp); $n++; } audit("admin-bulk $from-$to", ''); $flash[] = "$n new login(s) created. Cohorts that already had one were skipped."; }
                break;
            case 'reset':
                if ($exists($u)) { $make($u, accounts()['users'][$u]['cohort'] ?? null, ''); audit('admin-reset', $u); } else $err = 'No such account.';
                break;
            case 'edit':   // cohort, note, access end, and optionally a new username and/or a password the owner types
                if (!$exists($u)) { $err = 'No such account.'; break; }
                $nu = strtolower(trim((string)($_POST['newuser'] ?? ''))); if ($nu === '') $nu = $u;
                $np = (string)($_POST['newpass'] ?? '');
                if ($nu !== $u && !valid_user($nu)) { $err = 'Username: 2 to 32 characters, lowercase letters, digits, dot, dash or underscore.'; break; }
                if ($nu !== $u && $exists($nu)) { $err = "$nu already exists. Pick another username."; break; }
                if ($np !== '' && (strlen($np) < 8 || strlen($np) > 72)) { $err = 'Password: 8 to 72 characters.'; break; }
                store_update('accounts', function (&$a) use ($u, $nu, $np, $cohort, $exp, $now) {
                    $r = $a['users'][$u]; $r['cohort'] = $cohort; $r['note'] = trim((string)($_POST['note'] ?? '')); $r['expires'] = $exp;
                    if ($np !== '') { $r['hash'] = password_hash($np, PASSWORD_DEFAULT); $r['pw_changed'] = $now; }   // pw_changed signs out anyone logged in with the old password
                    if ($nu !== $u) unset($a['users'][$u]);   // the old session then points at no account and ends
                    $a['users'][$nu] = $r;
                }, ['admin' => null, 'users' => []]);
                if ($nu !== $u) {   // carry the mentee's saved progress and answer count over to the new name
                    $d = data_dir(); if (is_file("$d/progress-$u.json") && !is_file("$d/progress-$nu.json")) rename("$d/progress-$u.json", "$d/progress-$nu.json");
                    store_update('reveals', function (&$r) use ($u, $nu) { if (isset($r[$u])) { $r[$nu] = $r[$u]; unset($r[$u]); } });
                    audit("admin-rename $u -> $nu"); $flash[] = "$u renamed to $nu. Anyone signed in as $u is signed out.";
                }
                if ($np !== '') { $issued[] = [$nu, $np]; audit('admin-setpw', $nu); }
                if ($nu === $u && $np === '') { audit('admin-edit', $u); $flash[] = "$u saved."; }
                break;
            case 'toggle':
                if ($exists($u)) { store_update('accounts', function (&$a) use ($u) { $a['users'][$u]['active'] = empty($a['users'][$u]['active']); }); audit('admin-toggle', $u); $flash[] = "$u switched."; }
                break;
            case 'remove':
                if ($exists($u)) { store_update('accounts', function (&$a) use ($u) { unset($a['users'][$u]); }); audit('admin-remove', $u); $flash[] = "$u removed."; }
                break;
            case 'removecohort':
                if ($cohort) { $n = 0; store_update('accounts', function (&$a) use ($cohort, &$n) { foreach ($a['users'] as $k => $r) if (($r['cohort'] ?? null) === $cohort) { unset($a['users'][$k]); $n++; } }); audit("admin-removecohort $cohort"); $flash[] = "Cohort $cohort: $n login(s) removed."; }
                break;
            case 'unlock':
                $k = (string)($_POST['key'] ?? ''); store_update('attempts', function (&$all) use ($k) { unset($all[$k]); }); audit('admin-unlock'); $flash[] = 'Unlocked.';
                break;
            case 'adminpw':
                $new = (string)($_POST['newpass'] ?? '');
                if (strlen($new) < 14) $err = 'Use at least 14 characters for the admin password.';
                else { store_update('accounts', function (&$a) use ($new) { $a['admin']['hash'] = password_hash($new, PASSWORD_DEFAULT); }, ['admin' => null, 'users' => []]); audit('admin-pw'); $flash[] = 'Admin password changed.'; }
                break;
            case 'signout': $_SESSION = []; session_destroy(); header('Location: ' . base_path() . 'admin'); exit;
        }
    }
}

$acc = accounts(); $users = $acc['users']; ksort($users, SORT_NATURAL);
$locks = array_filter(store_read('attempts'), fn($r) => ($r['until'] ?? 0) > time());
$tok = csrf();
$form = fn(string $do, string $user, string $label, string $cls = 'o', string $extra = '', string $confirm = '') =>
    '<form class="i" method="post"' . ($confirm ? ' onsubmit="return confirm(\'' . h($confirm) . '\')"' : '') . '><input type="hidden" name="csrf" value="' . h($tok) . '"><input type="hidden" name="do" value="' . $do . '"><input type="hidden" name="user" value="' . h($user) . '">' . $extra
    . '<button class="btn s ' . $cls . '" type="submit">' . $label . '</button></form>';

page_start('Lab admin', true);
?>
<div class="row" style="justify-content:space-between;align-items:center"><div><h1>Lab admin</h1><p style="margin:0">Mentee logins for the Lab. Passwords are shown once, when you create or reset a login.</p></div>
  <?= $form('signout', '', 'Sign out') ?></div>
<?php if ($err): ?><div class="msg bad" role="alert" style="margin-top:14px"><?= h($err) ?></div><?php endif; ?>
<?php foreach ($flash as $f): ?><div class="msg ok" style="margin-top:14px"><?= h($f) ?></div><?php endforeach; ?>

<?php if ($issued): ?>
<h2>Passwords to copy now</h2>
<div class="tw"><table id="issued"><thead><tr><th>Username</th><th>Password</th></tr></thead><tbody>
<?php foreach ($issued as [$n, $p]): ?><tr><td><code><?= h($n) ?></code></td><td><span class="pw"><?= h($p) ?></span></td></tr><?php endforeach; ?>
</tbody></table></div>
<p style="margin-top:10px"><button class="btn s" type="button" id="copyall">Copy all</button> <span class="sm">Copies "username, password" lines. They are not stored anywhere readable. Reset a login to get a new one.</span></p>
<script>document.getElementById('copyall').onclick=function(){var t=[].map.call(document.querySelectorAll('#issued tbody tr'),function(r){return r.cells[0].textContent+', '+r.cells[1].textContent}).join('\n');navigator.clipboard&&navigator.clipboard.writeText(t);this.textContent='Copied'}</script>
<?php endif; ?>

<h2>Add logins</h2>
<form method="post" class="row"><input type="hidden" name="csrf" value="<?= h($tok) ?>"><input type="hidden" name="do" value="add">
  <div><label for="au">Username</label><input id="au" type="text" name="user" placeholder="c25" autocapitalize="none" required></div>
  <div><label for="ac">Cohort</label><input id="ac" type="number" name="cohort" min="1" placeholder="25"></div>
  <div><label for="an">Note</label><input id="an" type="text" name="note" placeholder="optional"></div>
  <div><label for="ae">Access until</label><input id="ae" type="date" name="expires"></div>
  <div style="flex:0 0 auto"><button class="btn" type="submit">Add</button></div></form>
<form method="post" class="row" style="margin-top:10px"><input type="hidden" name="csrf" value="<?= h($tok) ?>"><input type="hidden" name="do" value="bulk">
  <div><label for="bf">Cohorts from</label><input id="bf" type="number" name="from" min="1" placeholder="25" required></div>
  <div><label for="bt">to</label><input id="bt" type="number" name="to" min="1" placeholder="34" required></div>
  <div><label for="be">Access until</label><input id="be" type="date" name="expires"></div>
  <div style="flex:0 0 auto"><button class="btn o" type="submit">Create c&lt;N&gt; for each cohort</button></div></form>

<h2>Logins (<?= count($users) ?>)</h2>
<p class="sm">Under each login: change the username, type a new password (8 to 72 characters, blank keeps the current one), cohort, note or end date, then Save. A new username or password signs that login out; saved progress moves with a rename. The password you type is shown once above, to copy.</p>
<div class="tw"><table><thead><tr><th>Username</th><th>Cohort</th><th>Status</th><th>Access until</th><th>Last login</th><th>Note</th><th></th></tr></thead><tbody>
<?php foreach ($users as $n => $r): ?>
<tr><td><code><?= h($n) ?></code></td><td><?= h($r['cohort'] ?? '') ?></td>
  <td><?php $ex = expired($r); ?><span class="tag<?= (empty($r['active']) || $ex) ? ' off' : '' ?>"><?= empty($r['active']) ? 'disabled' : ($ex ? 'expired' : 'active') ?></span></td>
  <td class="sm"><?= h($r['expires'] ?? '') ?: 'no end' ?></td>
  <td class="sm"><?= h($r['last_login'] ? date('d M Y H:i', strtotime($r['last_login'])) : 'never') ?></td>
  <td class="sm"><?= h($r['note'] ?? '') ?></td>
  <td style="white-space:nowrap"><?= $form('reset', $n, 'Reset password', 'o', '', "Issue a new password for $n? The old one stops working.") ?>
    <?= $form('toggle', $n, empty($r['active']) ? 'Enable' : 'Disable') ?>
    <?= $form('remove', $n, 'Remove', 'd', '', "Remove $n for good?") ?></td></tr>
<tr><td colspan="7" style="padding-top:0"><form method="post" class="row" style="margin-bottom:4px"><input type="hidden" name="csrf" value="<?= h($tok) ?>"><input type="hidden" name="do" value="edit"><input type="hidden" name="user" value="<?= h($n) ?>">
  <div style="flex:1 1 130px"><input type="text" name="newuser" value="<?= h($n) ?>" autocapitalize="none" aria-label="Username of <?= h($n) ?>" placeholder="username"></div>
  <div style="flex:1 1 150px"><input type="text" name="newpass" autocomplete="off" aria-label="New password for <?= h($n) ?>" placeholder="new password (blank = keep)"></div>
  <div style="flex:0 0 90px"><input type="number" name="cohort" min="1" value="<?= h($r['cohort'] ?? '') ?>" aria-label="Cohort of <?= h($n) ?>"></div>
  <div><input type="text" name="note" value="<?= h($r['note'] ?? '') ?>" aria-label="Note for <?= h($n) ?>" placeholder="note"></div>
  <div style="flex:0 0 170px"><input type="date" name="expires" value="<?= h($r['expires'] ?? '') ?>" aria-label="Access until for <?= h($n) ?>"></div>
  <div style="flex:0 0 auto"><button class="btn s o" type="submit">Save</button></div></form></td></tr>
<?php endforeach; if (!$users): ?><tr><td colspan="7" class="sm">No logins yet.</td></tr><?php endif; ?>
</tbody></table></div>

<h2>Remove a whole cohort</h2>
<form method="post" class="row" onsubmit="return confirm('Remove every login of this cohort?')"><input type="hidden" name="csrf" value="<?= h($tok) ?>"><input type="hidden" name="do" value="removecohort">
  <div style="flex:0 0 140px"><label for="rc">Cohort</label><input id="rc" type="number" name="cohort" min="1" required></div>
  <div style="flex:0 0 auto"><button class="btn d" type="submit">Remove cohort</button></div></form>

<h2>Locked right now</h2>
<?php if ($locks): ?><div class="tw"><table><thead><tr><th>Who</th><th>Minutes left</th><th></th></tr></thead><tbody>
<?php foreach ($locks as $k => $r): ?><tr><td><code><?= h($k) ?></code></td><td><?= ceil(($r['until'] - time()) / 60) ?></td>
  <td><?= $form('unlock', '', 'Unlock', 'o', '<input type="hidden" name="key" value="' . h($k) . '">') ?></td></tr><?php endforeach; ?></tbody></table></div>
<?php else: ?><p class="sm">No locks. A wrong password counts per login and IP: <?= MAX_TRIES ?> wrong tries lock that pair for <?= LOCK_SECS / 60 ?> minutes.</p><?php endif; ?>
<p class="sm">Your IP as the server sees it: <code><?= h(client_ip()) ?></code>. If every visitor shows the same address, the host sits behind a proxy and the lock would hit everyone at once.</p>

<?php $rev = array_filter(array_map(fn($m) => count(array_filter($m, fn($t) => time() - $t < 86400)), store_read('reveals')), fn($n) => $n > 0); arsort($rev); ?>
<h2>Model answers opened, last 24 hours</h2>
<?php if ($rev): ?><div class="tw"><table><thead><tr><th>Login</th><th>Answers opened</th></tr></thead><tbody>
<?php foreach ($rev as $n => $c): ?><tr><td><code><?= h($n) ?></code></td><td><?= $c ?> of <?= 25 ?></td></tr><?php endforeach; ?></tbody></table></div>
<?php else: ?><p class="sm">None yet. Each login can open up to 25 different answers a day.</p><?php endif; ?>

<h2>Change the admin password</h2>
<form method="post" class="row"><input type="hidden" name="csrf" value="<?= h($tok) ?>"><input type="hidden" name="do" value="adminpw">
  <div><label for="np">New password (14+ characters)</label><input id="np" type="password" name="newpass" minlength="14" autocomplete="new-password" required></div>
  <div style="flex:0 0 auto"><button class="btn o" type="submit">Change</button></div></form>
<?php page_end();
