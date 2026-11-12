#!/usr/bin/env node
// Fails when a PHP file the router can serve is missing a login check or a CSRF
// check and nobody has written down why that is fine.
//
// Every file under api/ that router.php will serve must be one of:
//   - guarded: calls require_login()/require_moderator(), and calls
//     require_csrf_token() unless it only answers GET
//   - PUBLIC: reachable without logging in, on purpose
//   - LIBRARY: only defines functions; requesting it directly does nothing
//   - NO_CSRF: logged-in, not GET-only, and still safe without a CSRF token
// A new endpoint therefore fails this check until it is guarded or someone adds
// it to a list below with a reason. Stale list entries fail too.
// Usage: node scripts/check-endpoint-guards.js   (run from dorm-mart/)

const fs = require("fs");
const path = require("path");

const API = path.join(__dirname, "..", "api");
// Must match $blockedDirs in router.php: these are never served.
const BLOCKED_DIRS = ["tests", "database", "helpers", "security", "utility", "config"];

const PUBLIC = {
  "auth/create_account.php": "sign-up; rate limited per client",
  "auth/forgot_password.php": "password reset request; rate limited, same answer for every address",
  "auth/get_csrf_token.php": "hands out the session's CSRF token",
  "auth/login.php": "sign-in; rate limited",
  "auth/logout.php": "ends the session; CSRF checked",
  "auth/reset_password.php": "needs the emailed single-use reset token",
  "auth/validate_reset_token.php": "checks an emailed reset token",
  "auth/verify_two_factor.php": "second sign-in step; needs the pending 2FA session",
  "categories/get_active_categories.php": "public category list",
  "categories/get_categories.php": "public category list",
  "email/unsubscribe.php": "one-click unsubscribe; needs the signed link",
  "email_policy.php": "public email-domain policy",
  "media/image.php": "public listing, profile and review media; chat media is refused",
  "moderation/safety_summary.php": "public safety page; counts only",
  "payments/account_webhook_live.php": "Stripe callback; signature verified",
  "payments/account_webhook_test.php": "Stripe callback; signature verified",
  "payments/webhook_live.php": "Stripe callback; signature verified",
  "payments/webhook_test.php": "Stripe callback; signature verified",
  "profile/public_profile.php": "public seller page; names, listings and reviews only",
  "redirects/handle_password_reset_token_redirect.php": "forwards an emailed reset link to the app",
};

const LIBRARY = {
  "auth/auth_handle.php": "session and login helpers",
  "auth/device_history.php": "login device helpers",
  "auth/login_location.php": "login location helpers",
  "chat/helpers.php": "chat helpers",
  "confirm_purchases/helpers.php": "confirm-purchase helpers",
  "payments/completion.php": "payment completion helpers",
  "payments/helpers.php": "payment helpers",
  "payments/stripe.php": "Stripe client helpers",
  "payments/webhook_processor.php": "Stripe webhook handlers",
  "profile/profile_helpers.php": "profile helpers",
  "reviews/helpers.php": "review helpers",
  "scheduled_purchases/expire_stale.php": "expiry helper",
  "scheduled_purchases/helpers.php": "scheduled-purchase helpers",
  "scheduled_purchases/proposal.php": "schedule proposal helpers",
  "seller_dashboard/listing_cap.php": "listing cap helper",
};

const NO_CSRF = {
  "auth/me.php": "read-only: returns the signed-in user",
  "chat/fetch_conversation.php": "read; only marks the caller's own conversation as read",
  "chat/fetch_conversations.php": "read-only",
  "chat/fetch_new_messages.php": "read; only marks the caller's own conversation as read",
  "chat/fetch_unread_messages.php": "read-only",
  "chat/serve_chat_image.php": "read-only; participant check",
};

function phpFiles(dir, base = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return !base && BLOCKED_DIRS.includes(entry.name) ? [] : phpFiles(path.join(dir, entry.name), rel);
    }
    return entry.name.endsWith(".php") ? [rel] : [];
  });
}

const files = phpFiles(API);
const problems = [];

for (const [name, list] of [["PUBLIC", PUBLIC], ["LIBRARY", LIBRARY], ["NO_CSRF", NO_CSRF]]) {
  for (const file of Object.keys(list)) {
    if (!files.includes(file)) problems.push(`${file}: listed in ${name} but the file no longer exists; remove the entry`);
  }
}

for (const file of files) {
  const source = fs.readFileSync(path.join(API, file), "utf8");
  const hasLogin = /\brequire_(login|moderator)\s*\(/.test(source);
  const hasCsrf = /\brequire_csrf_token\s*\(/.test(source);
  const getOnly = /init_json_endpoint\(\s*'GET'/.test(source);
  const definesOnly = !/init_json_endpoint\(|json_response\(|\becho\b|\bheader\(/.test(source.replace(/function\s+\w+\s*\([^]*?\n}\n/g, ""));

  if (file in LIBRARY) {
    if (/init_json_endpoint\(/.test(source)) problems.push(`${file}: listed as LIBRARY but starts a JSON endpoint`);
    continue;
  }
  if (file in PUBLIC) {
    if (hasLogin && !/logout\.php$/.test(file)) problems.push(`${file}: listed as PUBLIC but requires login; remove the entry`);
    continue;
  }
  if (!hasLogin) {
    problems.push(`${file}: no require_login()/require_moderator()${definesOnly ? " (if it only defines functions, add it to LIBRARY)" : ""}. Guard it or add it to PUBLIC with a reason`);
    continue;
  }
  if (file in NO_CSRF) {
    if (hasCsrf) problems.push(`${file}: listed in NO_CSRF but checks a CSRF token; remove the entry`);
    continue;
  }
  if (!hasCsrf && !getOnly) {
    problems.push(`${file}: logged-in endpoint that is not GET-only and has no require_csrf_token(). Add the check or list it in NO_CSRF with a reason`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} endpoint guard problem(s).`);
  process.exit(1);
}
console.log(`Endpoint guards: ${files.length} routable PHP files are guarded or deliberately listed.`);
