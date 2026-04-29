# Formatters

Use these formatter choices for Dorm Mart files. These are VS Code formatter
extensions already installed on the project machine; do not add npm, Composer,
or global formatter packages just for formatting.

| Filetype       | Formatter                      | VS Code formatter id       | Notes                                            |
| -------------- | ------------------------------ | -------------------------- | ------------------------------------------------ |
| `.php`         | PHP                            | `DEVSENSE.phptools-vscode` | Use the PHP Tools formatter from VS Code.        |
| `.js`          | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to app JavaScript files.                 |
| `.jsx`         | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to React component files.                |
| `.json`        | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to app config/docs JSON, not lock files. |
| `.css`         | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to app CSS files.                        |
| `.html`        | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to app HTML files.                       |
| `.md`          | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Applies to project documentation.                |
| `.webmanifest` | Prettier - Code formatter      | `esbenp.prettier-vscode`   | Treat as JSON.                                   |
| `.sql`         | VS Code default, if registered | none pinned                | Leave unchanged when no formatter is registered. |
| `.sh`          | VS Code default, if registered | none pinned                | Leave unchanged when no formatter is registered. |
| `.ps1`         | VS Code default, if registered | none pinned                | Leave unchanged when no formatter is registered. |
| `.bat`         | VS Code default, if registered | none pinned                | Leave unchanged when no formatter is registered. |
| `.xml`         | VS Code default, if registered | none pinned                | Leave unchanged when no formatter is registered. |

## Exclusions

Do not format dependency folders, build output, binary/static media, lock files,
certificates, keys, PDFs, or generated artifacts. In this repo that means
skipping paths such as `dorm-mart/vendor`, `dorm-mart/node_modules`,
`dorm-mart/build`, image/media files, `.pem`, `.pdf`, and lock files.

## Running Formatters

- For Prettier-managed files, use the Prettier extension bundled formatter.
- For PHP, use VS Code's **Format Document** or **Format Files** command from
  the `PHP` extension.
- For filetypes listed as VS Code default, format only if VS Code offers a
  formatter for that language in the current profile.
