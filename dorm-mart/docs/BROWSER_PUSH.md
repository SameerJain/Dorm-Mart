# Browser push notifications

Users opt in from **Settings → User Preferences → Notification Settings**.
Permission is requested only when they press Enable. Messages and purchase
updates are delivered by Web Push, including when the app tab is closed.
Notifications use generic text without private message or purchase previews.
Signing out, revoking the login, resetting the password, banning the account,
or disabling notifications stops future queued deliveries to that sign-in.
After a new sign-in, enable notifications again on that browser.

## Server setup

1. Install Composer dependencies and apply `schema/browser_push_subscriptions.sql`
   and `schema/browser_push_queue.sql` through the normal schema migration.
2. Generate one VAPID key pair and keep it stable across deploys:

   ```sh
   php -r "require 'vendor/autoload.php'; echo json_encode(Minishlink\WebPush\VAPID::createVapidKeys(), JSON_PRETTY_PRINT);"
   ```

   On Windows/XAMPP, OpenSSL may need `OPENSSL_CONF` set **before PHP starts**
   to the bundled `php/extras/ssl/openssl.cnf` file.
3. Set these private server environment variables on both the web service and
   the worker. Only the public key is returned to a signed-in browser:

   - `PUSH_VAPID_PUBLIC_KEY`: generated `publicKey`.
   - `PUSH_VAPID_PRIVATE_KEY`: generated `privateKey`.
   - `PUSH_VAPID_SUBJECT`: the Dorm Mart contact `mailto:dormmart@proton.me`,
     or a public HTTPS contact URL.
4. Run `php api/utility/send_browser_push.php --watch` as a background worker.
   It checks every two seconds. For Railway, create a second service from this
   repository, select `railway-push.toml` as its config file, and share the web
   service's database and VAPID variables. Deploy the web schema first.
   No public domain or HTTP healthcheck is needed for the worker.

Alternatively run `php api/utility/send_browser_push.php` from a once-per-minute
cron job. An advisory lock prevents overlapping workers. Delivery is retried up
to five times; expired subscriptions and obsolete queued alerts are removed.
Push-provider failures cannot roll back a message or purchase.

## Browser requirements

Use HTTPS, or localhost for development. On iPhone/iPad, install the app on the
Home Screen and enable notifications from there. Browser/OS notification
settings can suppress delivery. The service worker only handles push and
notification clicks; it does not cache pages or intercept application requests.

The app must serve its worker from the same origin and app directory as the
frontend. `router.php` serves `push-worker.js` without immutable caching so
browser updates can take effect. Clicking a notification opens an internal
hash route under that directory.

## Verification

`php api/tests/browser_push_test.php` uses disposable accounts and a fake sender
to cover ownership, CSRF, provider allowlisting, delivery retries, transaction
rollback, scheduled availability, logout and expired subscriptions. The test
keys in `api/tests/fixtures/push_keys.json` are public test data, never production
credentials. Frontend tests cover permission, enabling/disabling, failures,
service-worker display, and notification click destinations.

Provider implementation: [web-push-php](https://github.com/web-push-libs/web-push-php).
Browser behavior: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API).
