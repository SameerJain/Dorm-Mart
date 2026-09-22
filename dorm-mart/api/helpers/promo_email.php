<?php

require_once __DIR__ . '/../utility/transactional_email_html.php';
require_once __DIR__ . '/../config/app_config.php';
require_once __DIR__ . '/resend_email.php';

function dm_project_root(): string
{
    return dirname(__DIR__, 2);
}

function dm_load_mail_vendor(): bool
{
    $projectRoot = dm_project_root();
    if (file_exists($projectRoot . '/vendor/autoload.php')) {
        require_once $projectRoot . '/vendor/autoload.php';
        return true;
    }

    $phpmailerRoot = $projectRoot . '/vendor/phpmailer/phpmailer/src';
    if (file_exists($phpmailerRoot . '/PHPMailer.php')) {
        require_once $phpmailerRoot . '/PHPMailer.php';
        require_once $phpmailerRoot . '/SMTP.php';
        require_once $phpmailerRoot . '/Exception.php';
        return true;
    }

    return false;
}

function send_promo_welcome_email(array $user, ?array $package = null): array
{
    if (dm_env_string('RESEND_API_KEY') !== '') {
        return dm_send_resend_email($user['email'], $package ?? dm_transactional_promo_welcome_package($user['firstName'] ?? ''));
    }

    if (!dm_load_mail_vendor()) {
        error_log("Email sending failed: mail vendor files are not available");
        return ['ok' => false, 'error' => 'Email SDK not available'];
    }

    if (function_exists('mb_internal_encoding')) {
        @mb_internal_encoding('UTF-8');
    }

    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    try {
        $mail->isSMTP();
        $mail->Host = dm_smtp_host();
        $mail->SMTPAuth = true;
        $gmailUsername = getenv('GMAIL_USERNAME');
        $gmailPassword = getenv('GMAIL_PASSWORD');
        if (empty($gmailUsername) || empty($gmailPassword)) {
            error_log("Email sending failed: GMAIL_USERNAME or GMAIL_PASSWORD not set in send_promo_welcome_email");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }

        $mail->Username = $gmailUsername;
        $mail->Password = $gmailPassword;
        $secure = dm_smtp_secure();
        $mail->SMTPSecure = $secure === 'smtps'
            ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
            : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = dm_smtp_port();
        $mail->Timeout = dm_smtp_timeout();
        $mail->SMTPKeepAlive = false;
        $allowSelfSigned = dm_smtp_allow_self_signed();
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => !$allowSelfSigned,
                'verify_peer_name' => !$allowSelfSigned,
                'allow_self_signed' => $allowSelfSigned,
            ],
        ];
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->setFrom(dm_mail_from_email(), dm_mail_from_name());
        $mail->addReplyTo(dm_mail_reply_to_email(), dm_mail_reply_to_name());
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $pkg = $package ?? dm_transactional_promo_welcome_package($user['firstName'] ?? '');
        foreach (($pkg['inline_images'] ?? []) as $image) {
            if (!empty($image['path']) && is_file($image['path'])) {
                $mail->addEmbeddedImage($image['path'], $image['cid'], $image['name'] ?? basename($image['path']));
            }
        }
        $mail->Subject = $pkg['subject'];
        $mail->isHTML(true);
        $mail->Body = $pkg['html'];
        $mail->AltBody = $pkg['text'];
        $mail->send();

        return ['ok' => true, 'error' => null];
    } catch (\Exception $e) {
        return ['ok' => false, 'error' => $mail->ErrorInfo ?: $e->getMessage()];
    }
}
