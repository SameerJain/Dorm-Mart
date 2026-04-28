<?php
declare(strict_types=1);

if (!function_exists('inventory_json_array')) {
    function inventory_json_array($value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string)$value, true);
        return json_last_error() === JSON_ERROR_NONE && is_array($decoded) ? $decoded : [];
    }
}

if (!function_exists('inventory_string_list')) {
    function inventory_string_list($value): array
    {
        return array_values(array_filter(
            inventory_json_array($value),
            static fn($item) => is_string($item) && $item !== ''
        ));
    }
}

if (!function_exists('inventory_first_photo')) {
    function inventory_first_photo($photos): ?string
    {
        foreach (inventory_json_array($photos) as $photo) {
            if (is_string($photo) && $photo !== '') {
                return $photo;
            }
            if (is_array($photo) && isset($photo['url']) && is_string($photo['url']) && $photo['url'] !== '') {
                return $photo['url'];
            }
        }

        if (is_string($photos) && trim($photos) !== '') {
            foreach (explode(',', $photos) as $photo) {
                $trimmed = trim($photo);
                if ($trimmed !== '') {
                    return $trimmed;
                }
            }
        }

        return null;
    }
}

if (!function_exists('inventory_display_name')) {
    function inventory_display_name(array $row, string $fallback = 'Unknown Seller', string $firstKey = 'first_name', string $lastKey = 'last_name', ?string $emailKey = 'email'): string
    {
        $first = trim((string)($row[$firstKey] ?? ''));
        $last = trim((string)($row[$lastKey] ?? ''));
        $name = trim($first . ' ' . $last);

        if ($name !== '') {
            return $name;
        }

        if ($emailKey !== null && !empty($row[$emailKey])) {
            return (string)$row[$emailKey];
        }

        return $fallback;
    }
}

if (!function_exists('inventory_product_payload')) {
    function inventory_product_payload(array $row, string $sellerFallback = 'Unknown Seller', bool $preferEmailFallback = true): array
    {
        $emailKey = $preferEmailFallback ? 'email' : null;

        return [
            'product_id'     => (int)$row['product_id'],
            'title'          => $row['title'] ?? 'Untitled',
            'description'    => $row['description'] ?? '',
            'listing_price'  => $row['listing_price'] !== null ? (float)$row['listing_price'] : null,
            'tags'           => inventory_string_list($row['categories'] ?? null),
            'categories'     => $row['categories'] ?? null,
            'item_location'  => $row['item_location'] ?? '',
            'item_condition' => $row['item_condition'] ?? '',
            'photos'         => inventory_json_array($row['photos'] ?? null),
            'trades'         => (bool)$row['trades'],
            'price_nego'     => (bool)$row['price_nego'],
            'date_listed'    => $row['date_listed'] ?? null,
            'seller_id'      => isset($row['seller_id']) ? (int)$row['seller_id'] : null,
            'sold'           => (bool)$row['sold'],
            'final_price'    => $row['final_price'] !== null ? (float)$row['final_price'] : null,
            'date_sold'      => $row['date_sold'] ?? null,
            'sold_to'        => isset($row['sold_to']) ? (int)$row['sold_to'] : null,
            'seller'         => inventory_display_name($row, $sellerFallback, 'first_name', 'last_name', $emailKey),
            'email'          => $row['email'] ?? '',
            'created_at'     => !empty($row['date_listed']) ? ($row['date_listed'] . ' 00:00:00') : null,
        ];
    }
}
