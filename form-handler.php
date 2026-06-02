<?php

if (!empty($_POST['website'])) {
    exit;
}

// Simple form handler for Planet Roofing static HTML page.
// Upload this file with index.html and thank-you.html on a PHP-enabled hosting account.
$to = "leads@pcflc.com";
$subject = "New Website Lead - Planet Roofing";

function clean($value) {
    return htmlspecialchars(trim($value ?? ''), ENT_QUOTES, 'UTF-8');
}

$body = "New lead from Planet Roofing website:\n\n";
foreach ($_POST as $key => $value) {
    $label = ucwords(str_replace('_', ' ', $key));
    $body .= $label . ": " . clean($value) . "\n";
}

$headers = "From: Planet Roofing Website <no-reply@planetroofingfl.com>\r\n";
if (!empty($_POST['email']) && filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) {
    $headers .= "Reply-To: " . clean($_POST['email']) . "\r\n";
}

@mail($to, $subject, $body, $headers);
header("Location: thank-you.html");
exit;
?>
