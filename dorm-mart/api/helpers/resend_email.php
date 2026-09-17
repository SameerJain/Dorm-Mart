<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/app_config.php';

function dm_send_resend_email(string $recipient, array $package): array
{
    $failure = ['ok' => false, 'provider' => 'resend'];
    $apiKey = dm_env_string('RESEND_API_KEY');
    $from = dm_env_string('MAIL_FROM_EMAIL');
    if ($apiKey === '' || $from === '') {
        return $failure + ['error' => 'RESEND_API_KEY and MAIL_FROM_EMAIL are required'];
    }
    if (!function_exists('curl_init')) {
        return $failure + ['error' => 'PHP cURL extension is required for Resend'];
    }

    try {
        $payload = [
            'from' => dm_mail_from_name() . ' <' . $from . '>',
            'to' => [$recipient],
            'subject' => $package['subject'],
            'html' => $package['html'],
            'text' => $package['text'],
            'reply_to' => dm_mail_reply_to_email(),
        ];
        foreach (($package['inline_images'] ?? []) as $image) {
            if (empty($image['path']) || !is_file($image['path']) || empty($image['cid'])) {
                continue;
            }
            $contents = file_get_contents($image['path']);
            if ($contents === false) {
                return $failure + ['error' => 'Could not read inline email image'];
            }
            $payload['attachments'][] = [
                'filename' => $image['name'] ?? basename($image['path']),
                'content' => base64_encode($contents),
                'content_id' => $image['cid'],
            ];
        }
        $json = json_encode($payload, JSON_THROW_ON_ERROR);
        $curl = curl_init('https://api.resend.com/emails');
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 15,
        ]);
        $body = curl_exec($curl);
        $status = (int)curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $curlError = curl_errno($curl);
        curl_close($curl);
        $response = $body === false ? null : json_decode($body, true);
        if ($status >= 200 && $status < 300 && is_string($response['id'] ?? null)) {
            return ['ok' => true, 'provider' => 'resend', 'status' => $status, 'error' => null];
        }
        // Do not log message bodies, reset links, passwords, or API keys.
        error_log("Resend email failed: HTTP {$status}, cURL {$curlError}");
        return $failure + ['status' => $status, 'error' => 'Resend did not accept the email'];
    } catch (Throwable $e) {
        return $failure + ['error' => 'Could not prepare or send Resend email'];
    }
}
