<?php
// Sign out: drop the session, then go back to the login page.
define('LAB_AUTH', 1);
require __DIR__ . '/_lib.php';
session_open();
$_SESSION = [];
session_destroy();
header('Location: ' . base_path() . 'login');
