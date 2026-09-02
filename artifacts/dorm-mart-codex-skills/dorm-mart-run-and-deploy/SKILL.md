---
name: dorm-mart-run-and-deploy
description: Start, build, troubleshoot, package, or deploy Dorm Mart across local React/PHP development, XAMPP Apache simulation, Aptitude, Cattle, and Railway. Use for environment setup, Windows build scripts, port conflicts, frontend base paths, PHP API URLs, CORS, email configuration, database migrations, Railway CLI uploads, persistent user media, and post-deploy verification.
---

# Run and Deploy Dorm Mart

## Select the target

- Use `build-scripts-win/dev.bat` for normal Windows development. It starts XAMPP services when needed, React on port 3000, and PHP on port 8080 without duplicating listeners.
- Use `build-scripts-win/apache.bat` for the local Apache-style packaged build. Inspect its resolved `C:\xampp\htdocs\serve` target before allowing it to clear and replace files.
- Use `build-scripts-win/aptitude.bat` or `cattle.bat` to create uploadable target packages.
- Use `build-scripts-win/railway.bat` to deploy the current local `dorm-mart/` contents to the already linked Railway service.

Do not run npm commands from the repository root; its application `package.json` lives in `dorm-mart/`. Stop the React compiler before `npm install`, `npm ci`, or dependency updates.

## Configure the environment

- Read `README.project_setup.md` and `dorm-mart/extra-files/environment_configuration.md`.
- Keep real `.env.*` files and secrets uncommitted.
- Set `PUBLIC_URL` and `REACT_APP_API_BASE` for the React build target.
- Set backend links and access with `FRONTEND_BASE_URL`, `API_BASE_URL`, and `CORS_ALLOWED_ORIGINS`.
- Configure mail through environment variables; do not weaken TLS in production.
- Set `DATA_UPLOADS_DIR` to persistent storage on ephemeral platforms.

## Build and migrate

Run application commands from `dorm-mart/`:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
php api\database\migrate_schema.php
php api\database\migrate_data.php
```

Apply schema changes before relying on new code. Treat seed-data migration as repeatable and environment-sensitive; do not load test data into production by assumption.

## Deploy to Railway

1. Require Railway CLI 4.30.5 or newer.
2. Confirm `railway whoami`, project link, service, and environment.
3. Inspect the current branch and `git status --short`. A normal local upload includes uncommitted files.
4. Use `-RequireClean` when the deployment must match a clean commit.
5. Provide `-Service` or `-Environment` when the existing link is ambiguous.
6. Use `-Detach` only when intentionally queueing without waiting for the result.

Do not deploy or change remote configuration unless the user requested that external action.

## Verify the deployed system

- Load the app shell, login, one authenticated GET, and one CSRF-protected mutation.
- Check direct and nested client routes for the target base path.
- Confirm local product/profile images are requested through `/api/media/image.php?url=...`.
- Upload a disposable image and confirm it survives the persistence behavior expected for the platform.
- Check database migration output, CORS, email links, and browser console/network errors.
- Report the target, branch/commit or dirty state, commands run, migration result, deployment result, and unresolved warnings.
