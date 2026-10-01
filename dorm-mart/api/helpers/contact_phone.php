<?php
declare(strict_types=1);

/**
 * Normalize a seller contact phone number to "(716) 555-1234".
 *
 * Returns null for blank input (the seller cleared the field) and false when the
 * value is not a 10-digit US number. A leading country code of 1 is dropped.
 *
 * @return string|null|false
 */
function normalize_contact_phone(string $value)
{
    $value = trim($value);
    if ($value === '') {
        return null;
    }
    if (!preg_match('/^[0-9+().\-\s]{1,25}$/', $value)) {
        return false;
    }

    $digits = (string)preg_replace('/\D/', '', $value);
    if (strlen($digits) === 11 && $digits[0] === '1') {
        $digits = substr($digits, 1);
    }
    if (strlen($digits) !== 10) {
        return false;
    }

    return sprintf('(%s) %s-%s', substr($digits, 0, 3), substr($digits, 3, 3), substr($digits, 6));
}
