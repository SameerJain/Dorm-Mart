<?php

require_once __DIR__ . '/../utility/transactional_email_html.php';
require_once __DIR__ . '/../config/app_config.php';

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

function send_promo_welcome_email_via_sendgrid(array $user, string $apiKey): array
{
    if (!dm_load_mail_vendor()) {
        error_log("SendGrid: vendor/autoload.php not found");
        return ['ok' => false, 'error' => 'SendGrid SDK not available'];
    }

    try {
        error_log("SendGrid promo email attempt started for: " . ($user['email'] ?? 'unknown'));
        $sendgrid = new \SendGrid($apiKey);
        $pkg = dm_transactional_promo_welcome_package($user['firstName'] ?? '');
        $fromEmail = dm_mail_from_email();
        if ($fromEmail === '') {
            error_log("SendGrid promo email failed: MAIL_FROM_EMAIL or GMAIL_USERNAME is not set");
            return ['ok' => false, 'error' => 'Email configuration missing'];
        }

        $email = new \SendGrid\Mail\Mail();
        $email->setFrom($fromEmail, dm_mail_from_name());
        $email->setSubject($pkg['subject']);
        $email->addTo($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));
        $email->addContent("text/html", $pkg['html']);
        $email->addContent("text/plain", $pkg['text']);

        $response = $sendgrid->send($email);
        if ($response->statusCode() >= 200 && $response->statusCode() < 300) {
            error_log("SendGrid promo email sent successfully to: " . ($user['email'] ?? 'unknown'));
            return ['ok' => true, 'error' => null];
        }

        error_log("SendGrid error in promo email: " . $response->statusCode() . " - " . $response->body());
        return ['ok' => false, 'error' => 'Failed to send promo email via SendGrid'];
    } catch (\Exception $e) {
        error_log("SendGrid exception in send_promo_welcome_email_via_sendgrid: " . $e->getMessage());
        return ['ok' => false, 'error' => $e->getMessage()];
    }
}

function send_promo_welcome_email(array $user): array
{
    $sendgridApiKey = dm_sendgrid_api_key();
    if (!empty($sendgridApiKey)) {
        error_log("Promo email using SendGrid; SENDGRID_API_KEY is configured");
        return send_promo_welcome_email_via_sendgrid($user, $sendgridApiKey);
    }
    error_log("Promo email using SMTP fallback; SENDGRID_API_KEY is not configured");

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
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true,
            ],
        ];
        $mail->CharSet = 'UTF-8';
        $mail->Encoding = 'base64';
        $mail->setFrom(dm_mail_from_email(), dm_mail_from_name());
        $mail->addReplyTo(dm_mail_reply_to_email(), dm_mail_reply_to_name());
        $mail->addAddress($user['email'], trim(($user['firstName'] ?? '') . ' ' . ($user['lastName'] ?? '')));

        $pkg = dm_transactional_promo_welcome_package($user['firstName'] ?? '');
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
