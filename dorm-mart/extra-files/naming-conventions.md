# Naming Conventions

Use these names for new files and folders so the codebase stays predictable.

## Frontend

- React page and component files use `PascalCase.jsx`.
- React page and feature folders use `PascalCase`.
- Hook, utility, helper, context utility, and constant files use `camelCase.js`.
- Shared buckets stay lowercase: `src/pages`, `src/components`, `src/hooks`, `src/utils`, `src/context`.
- Feature-local buckets stay lowercase: `components`, `hooks`, `utils`.
- Use `.jsx` when a file renders JSX. Use `.js` for plain JavaScript modules.

Examples:

- `src/pages/Search/SearchResultsPage.jsx`
- `src/pages/ItemDetails/hooks/useProductDetail.js`
- `src/utils/apiConfig.js`

## Backend

- API folders and PHP files use `snake_case`.
- Public endpoint paths use the same `snake_case` filenames.
- Helper, migration, test, and script PHP files also use `snake_case`.

Examples:

- `api/seller_dashboard/product_listing.php`
- `api/auth/reset_password.php`
- `api/search/get_search_items.php`
