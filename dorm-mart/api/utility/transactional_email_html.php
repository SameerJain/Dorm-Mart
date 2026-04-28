<?php

declare(strict_types=1);

/**
 * Shared HTML + plain text for transactional mail (SendGrid + PHPMailer).
 * Table layout and inline styles for broad client support.
 */

require_once __DIR__ . '/../security/security.php';
require_once __DIR__ . '/../config/app_config.php';

function dm_transactional_footer_inner_html(): string
{
    $supportEmail = dm_support_email();
    $supportEmailEscaped = escape_html($supportEmail);

    return '<p style="margin:0 0 10px;color:#94a3b8;font-size:12px;line-height:1.5;">This is an automated message; please do not reply to this email.</p>'
        . '<p style="margin:0;color:#64748b;font-size:12px;line-height:1.5;">Need help? Contact us at '
        . '<a href="mailto:' . $supportEmailEscaped . '" style="color:#38bdf8;text-decoration:underline;">' . $supportEmailEscaped . '</a></p>';
}

function dm_transactional_shell(string $documentTitle, ?string $preheader, string $bodyContentHtml): string
{
    $docTitle = escape_html($documentTitle);
    $hidden = '';
    if ($preheader !== null && $preheader !== '') {
        $hidden = '<div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;">'
            . escape_html($preheader) . '</div>';
    }

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1.0">'
        . '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">'
        . '<title>' . $docTitle . '</title></head>'
        . '<body style="margin:0;padding:0;background-color:#0b1220;">' . $hidden
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background-color:#0b1220;mso-table-lspace:0pt;mso-table-rspace:0pt;">'
        . '<tr><td align="center" style="padding:28px 12px;">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;border-collapse:collapse;background-color:#111827;border:1px solid #1e40af;mso-table-lspace:0pt;mso-table-rspace:0pt;">'
        . '<tr><td bgcolor="#1e40af" style="background-color:#1e40af;padding:32px 24px;text-align:center;">'
        . '<div style="font-family:Georgia,\'Times New Roman\',Times,serif;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:0.03em;">Dorm Mart</div>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:14px auto 0;border-collapse:collapse;">'
        . '<tr><td bgcolor="#38bdf8" width="64" height="3" style="width:64px;height:3px;background-color:#38bdf8;font-size:0;line-height:0;">&nbsp;</td></tr></table>'
        . '</td></tr>'
        . '<tr><td style="padding:28px 26px 8px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#e2e8f0;">'
        . $bodyContentHtml
        . '</td></tr>'
        . '<tr><td style="padding:20px 26px 28px 26px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #1e293b;">'
        . dm_transactional_footer_inner_html()
        . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/**
 * @return array{subject: string, html: string, text: string}
 */
function dm_transactional_welcome_package(string $firstName, string $tempPassword): array
{
    $plainFirst = $firstName !== '' ? $firstName : 'Student';
    $f = escape_html($plainFirst);
    $p = escape_html($tempPassword);
    $subject = 'Welcome to Dorm Mart';
    $preheader = 'Your temporary password and next steps for Dorm Mart.';

    $inner = '<p style="margin:0 0 16px;color:#f1f5f9;font-size:17px;">Dear ' . $f . ',</p>'
        . '<p style="margin:0 0 16px;color:#cbd5e1;">Welcome to <strong style="color:#ffffff;">Dorm Mart</strong> &mdash; the student marketplace for UB.</p>'
        . '<p style="margin:0 0 18px;color:#cbd5e1;">Below is your temporary password. <strong style="color:#fca5a5;">Do not share it</strong> with anyone.</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-collapse:collapse;border:1px solid #334155;border-radius:8px;overflow:hidden;">'
        . '<tr><td style="padding:22px 20px;background-color:#0f172a;text-align:center;">'
        . '<p style="margin:0;font-family:\'Courier New\',Courier,monospace;font-size:22px;font-weight:700;letter-spacing:0.1em;color:#38bdf8;">' . $p . '</p>'
        . '</td></tr></table>'
        . '<p style="margin:0 0 26px;color:#94a3b8;font-size:14px;line-height:1.5;">You can change your password anytime under <em>Settings</em> &rarr; <em>Change Password</em>.</p>'
        . '<p style="margin:0;color:#e2e8f0;">Happy trading,<br><span style="color:#38bdf8;font-weight:600;">The Dorm Mart Team</span></p>';

    $html = dm_transactional_shell($subject, $preheader, $inner);

    $text = "Dear {$plainFirst},\n\n"
        . "Welcome to Dorm Mart - the student marketplace for UB.\n\n"
        . "Here is your temporary (current) password. DO NOT share this with anyone.\n\n"
        . "{$tempPassword}\n\n"
        . "If you want to change this password, go to Settings -> Change Password.\n\n"
        . "Happy trading,\nThe Dorm Mart Team\n\n"
        . "(This is an automated message; do not reply. Support: " . dm_support_email() . ")";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

/**
 * @return array{subject: string, html: string, text: string}
 */
function dm_transactional_password_reset_package(string $firstName, string $resetLink): array
{
    $plainFirst = $firstName !== '' ? $firstName : 'Student';
    $f = escape_html($plainFirst);
    $href = escape_html($resetLink);
    $subject = 'Reset Your Password - Dorm Mart';
    $preheader = 'Use this link to reset your Dorm Mart password. It expires in one hour.';

    $inner = '<p style="margin:0 0 16px;color:#f1f5f9;font-size:17px;">Dear ' . $f . ',</p>'
        . '<p style="margin:0 0 22px;color:#cbd5e1;">We received a request to reset your Dorm Mart password. Use the button below to set a new one.</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;border-collapse:collapse;"><tr><td align="center">'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>'
        . '<td bgcolor="#2563eb" style="background-color:#2563eb;border-radius:8px;">'
        . '<a href="' . $href . '" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">Reset password</a>'
        . '</td></tr></table></td></tr></table>'
        . '<p style="margin:0 0 12px;color:#94a3b8;font-size:14px;">This link expires in <strong style="color:#e2e8f0;">1 hour</strong> for your security.</p>'
        . '<p style="margin:0 0 22px;color:#64748b;font-size:13px;line-height:1.5;">If you did not ask for a reset, you can ignore this email &mdash; your password will stay the same.</p>'
        . '<p style="margin:0;color:#e2e8f0;">Best regards,<br><span style="color:#38bdf8;font-weight:600;">The Dorm Mart Team</span></p>';

    $html = dm_transactional_shell($subject, $preheader, $inner);

    $text = "Dear {$plainFirst},\n\n"
        . "You requested to reset your password for your Dorm Mart account.\n\n"
        . "Click this link to reset your password:\n{$resetLink}\n\n"
        . "This link will expire in 1 hour for security reasons.\n\n"
        . "Best regards,\nThe Dorm Mart Team\n\n"
        . "(This is an automated message; do not reply. Support: " . dm_support_email() . ")";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}

/**
 * @return array{subject: string, html: string, text: string}
 */
function dm_transactional_promo_welcome_package(string $firstName): array
{
    $plainFirst = $firstName !== '' ? $firstName : 'Student';
    $f = escape_html($plainFirst);
    $subject = 'Welcome to Dorm Mart Promotional Updates';
    $preheader = 'You are subscribed to Dorm Mart promotional updates.';

    $inner = '<p style="margin:0 0 6px;color:#38bdf8;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Promotional updates</p>'
        . '<p style="margin:0 0 18px;color:#f1f5f9;font-size:20px;font-weight:700;">You are all set</p>'
        . '<p style="margin:0 0 16px;color:#cbd5e1;">Dear ' . $f . ',</p>'
        . '<p style="margin:0 0 20px;color:#cbd5e1;">Thank you for opting into updates from <strong style="color:#ffffff;">Dorm Mart</strong>. This is a one-time confirmation the first time you enable promotional emails on your account.</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-collapse:collapse;border-left:4px solid #2563eb;background-color:#1e293b;">'
        . '<tr><td style="padding:18px 20px;">'
        . '<p style="margin:0 0 12px;color:#f1f5f9;font-weight:700;font-size:15px;">You may hear from us about:</p>'
        . '<p style="margin:0 0 8px;color:#cbd5e1;font-size:15px;">&#8226;&nbsp; Your notifications tab and important alerts</p>'
        . '<p style="margin:0;color:#cbd5e1;font-size:15px;">&#8226;&nbsp; New site features and marketplace news</p>'
        . '</td></tr></table>'
        . '<p style="margin:0 0 22px;color:#94a3b8;font-size:14px;line-height:1.55;">We will keep messages relevant and easy to turn off &mdash; you can change this anytime in your account settings.</p>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-collapse:collapse;"><tr><td style="padding:12px 20px;background-color:#172554;border:1px solid #3b82f6;border-radius:8px;">'
        . '<span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#93c5fd;">Subscribed successfully</span>'
        . '</td></tr></table>'
        . '<p style="margin:0;color:#e2e8f0;">Happy trading,<br><span style="color:#38bdf8;font-weight:600;">The Dorm Mart Team</span></p>';

    $html = dm_transactional_shell($subject, $preheader, $inner);

    $text = "Promotional Updates - Dorm Mart\n\n"
        . "Dear {$plainFirst},\n\n"
        . "Thank you for opting into promotional updates from Dorm Mart!\n\n"
        . "You may hear from us about:\n"
        . "- Your notifications tab and important alerts\n"
        . "- New site features and marketplace news\n\n"
        . "This is a one-time email confirming your choice. You can update preferences in account settings.\n\n"
        . "Subscribed successfully\n\n"
        . "Happy trading,\nThe Dorm Mart Team\n\n"
        . "(This is an automated message; do not reply. Support: " . dm_support_email() . ")";

    return ['subject' => $subject, 'html' => $html, 'text' => $text];
}
