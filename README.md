# Dorm Mart

A campus marketplace for buying, selling, and trading the things students need. Dorm Mart uses a React frontend and a PHP/MySQL backend.

_Started by the No Brainers team for CSE 442: Software Engineering Concepts at the University at Buffalo._

## Try it

Open [Dorm Mart](https://dormmart.me/). If you don't have a UB account, use the demo login:

- **Email:** `testuser@buffalo.edu`
- **Password:** `1234!`

## Why we built it

At the end of the semester, students throw out furniture, textbooks, electronics, dorm supplies, and other items that incoming students still need. We built Dorm Mart to cut down on that waste and give students a better place to buy and sell campus goods.

## Run it locally

You need Node.js and npm, PHP 8 or newer, Composer, and MySQL. We use XAMPP for the local PHP and MySQL environment.

1. Clone the repository.
2. Go to the app directory with `cd dorm-mart`.
3. Install dependencies with `npm install` and `composer install`.
4. Follow the [project setup guide](README.project_setup.md) for database and environment setup.
5. Start the frontend with `npm run start-local-win` on Windows or `npm run start-local-mac` on macOS.
6. In a second terminal, start the API with `npm run start:api` from `dorm-mart`.

## Usage

Use Dorm Mart to browse student listings, search and filter items, post goods for sale, chat with buyers or sellers, save items to a wishlist, schedule purchases, and leave reviews. The in-app FAQ has short guides for the main features.

## Gallery

### Welcome page

<img src="dorm-mart/src/assets/readme-images/welcome-page-screenshot.png" alt="Welcome Page" width="600" />

### Item details

<img src="dorm-mart/src/assets/readme-images/individual-item-age-screenshot.png" alt="Individual Product Page" width="600" />

### Chat

<img src="dorm-mart/src/assets/readme-images/chat-page-screenshot.png" alt="Chat Page" width="600" />

## What you can do

### Get started

- Create an account with your name and email. Dorm Mart emails you a temporary password, which you can change after you sign in.
- Installations can limit sign-ups to `@buffalo.edu` addresses by setting `ALLOW_ALL_EMAILS=false`.
- Repeated failed sign-ins pause the form: four failures within 10 minutes lock sign-in for three minutes. Sign-ups, password-reset emails, and password re-entry in settings are throttled too.

### Find something for your dorm

- Browse **For You**, a feed that uses your interests and the items you view, save, and buy. New accounts start with popular and recent listings.
- Switch to **Explore More** for a randomized mix of items.
- Search by title, optionally include descriptions, and filter by category, condition, location, and price. Narrow results to negotiable prices or sellers open to trades.
- Save items to your wishlist and get notifications when their price, photos, or availability changes.
- View listing photos and videos. On phones and tablets, swipe between them or tap the position dots; the current dot is blue. Desktop users get thumbnails and arrows that disappear at the ends of the gallery.

### Sell on your own schedule

- Create listings with photos, videos, a condition, a pickup location, and a price. Mark whether you are open to offers or trades.
- Save an unfinished listing as a private draft and publish it when it is ready.
- Use the seller dashboard to manage listings and see views, wishlist counts, and sales information.
- Keep track of draft, active, pending, and sold listings. Once you accept a purchase, the listing is pending and only you and that buyer can open it.

### Talk and arrange a pickup

- Message buyers and sellers from an item's page. Chat supports text, images, typing indicators, and unread counts.
- Edit your latest eligible text message or remove a conversation from your own chat list.
- Choose whether buyers can see your seller email and optional phone number in chat.
- Propose a purchase date and time, respond to requests, and track ongoing purchases. Accepted schedules include pickup reminders.
- Cancel a purchase request you no longer need. Requests with no response expire after three days, or sooner if the proposed meeting time passes, and the chat records the expiry for both people.
- Handle purchase confirmations and review prompts through cards in the conversation.

### Pay, keep receipts, and leave reviews

- Where built-in payments are enabled, sellers can connect Stripe and offer payment on eligible scheduled purchases. Buyers pay from chat during the payment window, and a successful payment completes the purchase automatically.
- Use manual purchase confirmation for exchanges arranged directly between buyer and seller, including trades.
- Find completed purchases in purchase history, with receipts that distinguish the listing price, final price, and trades.
- Sellers can issue a full refund for a successful Stripe payment from the receipt and choose whether to relist the item.
- Leave product reviews with photos, rate buyers, and edit review stars.
- See the ratings sellers have given you on the Buyer Reviews page.

Built-in payments depend on the installation's Stripe configuration and seller eligibility. See the [Stripe activation checklist](dorm-mart/docs/stripe-activation-checklist.md) for setup details.

### Make the account yours

- Choose up to three interests to help shape your recommendations, and switch between light and dark mode.
- Manage notifications for saved items, purchase requests, cancellations, and review reminders. Open, mark read, or delete notifications from one page.
- Set promotional listing emails to daily, weekly, or off. Sending those digests requires a scheduled job on the server.
- Add a profile photo, a bio, and an Instagram link. Your public profile shows them with your listings, the reviews on your items, and your average rating. You can open anyone else's profile the same way.
- View your account information.
- Enable email-based two-factor authentication, reset a forgotten password, or change your current password.
- Review login history with device, browser, time, and approximate location details. Changing your password signs out other sessions.
- Delete your account through a password-protected confirmation flow.

### Report problems

- Report a message from chat. Profanity filtering also flags messages for moderator review.
- Moderators have a separate dashboard for reports and flagged messages, with controls to resolve reports, ban or unban users, and maintain the word filter.
- Read the Privacy Policy, Terms of Service, and safety guidance inside the app.

## Under the hood

| Part | What we use |
| --- | --- |
| Frontend | React 19, React Router, Tailwind CSS |
| Backend | PHP 8+, MySQL |
| Authentication | PHP sessions, hashed passwords, remember-me tokens, email-based two-factor authentication |
| Chat updates | HTTP polling for messages, typing indicators, and conversation changes |
| Email | Resend, with SMTP through PHPMailer as a fallback |
| Optional payments | Stripe Connect |
| Local development | XAMPP and the React development server |
| Deployment | Railway, plus build scripts for Apache and UB servers |

The backend uses prepared SQL statements, CSRF checks, request validation, and output escaping. The API only answers browser requests from trusted origins, and requests that change data must carry a CSRF token from the user's session. Sign-in, sign-up, and password flows are rate-limited per client. Uploads are checked for file type and size, and private chat images require conversation access. Password changes and account bans invalidate existing sessions.

## Key folders

| Folder | Contents |
| --- | --- |
| `dorm-mart/src/` | React pages, shared components, hooks, and context |
| `dorm-mart/api/` | PHP endpoints grouped by feature, plus shared helpers |
| `dorm-mart/api/security/` | Authentication, CSRF, and request validation helpers |
| `dorm-mart/api/tests/` | Backend checks and integration scripts |
| `dorm-mart/public/` | Static assets |
| `dorm-mart/migrations/` | Database schema migrations |
| `dorm-mart/data/` | Local demo data |
| `dorm-mart/docs/` | Setup references and architecture notes |
| `build-scripts-win/` | Windows development, build, and deployment scripts |

For setup, deployment, and production build steps, see the [project setup guide](README.project_setup.md).

## Checks

Run these from `dorm-mart`:

```sh
npm test -- --watchAll=false
npm run test:backend
npm run build
```

Frontend tests use Jest and React Testing Library. The backend command runs the PHP validation, login-location, and promotional-digest checks. See the [backend test guide](dorm-mart/api/tests/README.md) for separate integration scripts.

## More documentation

- [Environment configuration](dorm-mart/docs/environment_configuration.md)
- [Documentation index](dorm-mart/docs/README.md)
- [Project handoff and architecture notes](dorm-mart/docs/PROJECT_HANDOFF.md)
- [Transactional email setup](dorm-mart/docs/RESEND_SETUP.md)

## Contributing

Pick an open issue or describe the change you want to make before you start. Put your work on a branch, keep the change focused, and open a pull request when it is ready for review. Include testing notes, screenshots, or both when they help reviewers understand the change.

## The team

- Sooseok Kim
- Sameer Jain
- Anish Banerjee

Thanks to Professor Matt Hertz, the CSE 442 teaching assistants, our usability testers, and former team developers who helped build and improve Dorm Mart.
