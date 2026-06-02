# Personal Finance App

A self-hosted personal finance dashboard for tracking accounts, transactions, budgets, and spending insights across a household. Built with Next.js 16 (App Router), Prisma + PostgreSQL, Clerk auth, and Plaid for bank connections.

## Features

- **Bank connections** via Plaid Link with automatic transaction sync
- **Multi-account dashboard** with net-worth donut, recent activity, and per-day breakdowns
- **Transactions** view with date presets, filters, grouping by day, and category tiles
- **Budgets** per category with month/year scoping and progress tracking
- **Insights** including a 12-month spending heatmap, monthly bar chart, and category breakdowns
- **Households & sharing**: invite members, share accounts, switch between personal and household views
- **Custom categories** with emoji + color, plus rename/delete (default categories are protected)
- **Encryption at rest** for Plaid access tokens (AES-256-GCM)

## Tech Stack

- **Framework**: Next.js 16, React 19, TypeScript
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)
- **Auth**: Clerk (`@clerk/nextjs`) with webhooks via Svix
- **Banking**: Plaid (`plaid` + `react-plaid-link`)
- **UI**: Tailwind CSS v4, shadcn/ui (Radix), Recharts, lucide-react

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (local or hosted)
- Accounts on [Clerk](https://dashboard.clerk.com) and [Plaid](https://dashboard.plaid.com)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in:

   ```bash
   cp .env.example .env
   ```

   | Variable | Notes |
   | --- | --- |
   | `DATABASE_URL` | PostgreSQL connection string |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | From Clerk dashboard |
   | `CLERK_WEBHOOK_SECRET` | Signing secret for `/api/webhooks/clerk` |
   | `PLAID_CLIENT_ID` / `PLAID_SECRET` | From Plaid dashboard |
   | `PLAID_ENV` | `sandbox`, `development`, or `production` |
   | `ENCRYPTION_KEY` | 32-byte hex string. Generate with `openssl rand -hex 32` |

3. **Generate the Prisma client and run migrations**

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```

   For a fresh local DB, you can also seed the default categories:

   ```bash
   npx tsx prisma/seed.ts
   ```

4. **Start the dev server**

   ```bash
   npm run dev
   ```

   App runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Run `prisma generate` then build for production |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |

## Project Structure

```
prisma/                   Prisma schema, migrations, seed
src/
  app/
    (auth)/               Clerk sign-in / sign-up routes
    (dashboard)/          Authenticated app pages
    api/                  Route handlers (accounts, transactions, budgets, insights, plaid, webhooks, ...)
    invite/[code]/        Household invite acceptance
  components/             UI components (shadcn/ui, sidebar, plaid link)
  lib/
    auth.ts               Clerk session helpers
    db.ts                 Prisma client singleton
    plaid.ts              Plaid client + sync helpers
    encryption.ts         AES-256-GCM helpers for Plaid tokens
    categories.ts         Default categories + EXCLUDED_FROM_SPENDING
    utils.ts              cn(), monthBoundsUTC()
  generated/prisma/       Generated Prisma client (gitignored, do not edit)
  middleware.ts           Clerk auth middleware
docs/compliance/          Policy docs
```

## Webhooks

- **Clerk** → `POST /api/webhooks/clerk` (uses `CLERK_WEBHOOK_SECRET`)
- **Plaid** → `POST /api/webhooks/plaid`

For local development, expose your dev server with a tunnel (e.g. `ngrok http 3000`) and configure the resulting public URL in the Clerk and Plaid dashboards.

## Scheduled Sync

`GET /api/cron/sync` re-fetches Plaid transactions for all linked items. Trigger it on a schedule (e.g. hourly) via Vercel Cron, GitHub Actions, or Azure Logic Apps.

## Notes on Dates

Plaid stores transaction dates as `YYYY-MM-DD`, which JavaScript parses as UTC midnight. All month-range queries use the shared `monthBoundsUTC()` helper in `src/lib/utils.ts`, and the transactions page formats dates from the raw `YYYY-MM-DD` string to avoid the date shifting in timezones west of UTC.

## License

Private project. All rights reserved.

---

## Installing as an iOS App (PWA)

The app ships as an installable Progressive Web App — no App Store, no
separate iOS codebase. Open the production URL in **Safari on iPhone**
(iOS 16.4+), tap the **Share** button, then **Add to Home Screen**.
A new icon appears on the home screen; tapping it launches the app
full-screen (no browser chrome) just like a native app.

After installing, two extra features become available:

### Face ID / PIN App Lock

`Settings → App Lock` lets you require a Face ID (or Touch ID on
supported devices) check on cold launch and after an idle timeout
(default 15 minutes). A 4–10 digit PIN is required as the fallback
when biometrics are unavailable.

- The lock sits **on top of** your account session — you stay signed
  in across launches, but the dashboard is gated behind a biometric
  prompt until you authenticate.
- After 5 wrong PIN attempts the app automatically signs out and
  redirects to `/sign-in`.
- The lock screen always has a small **Sign out** link — useful if
  you forget your PIN or someone else needs to use the device.
- Removing the last enrolled device AND removing the PIN
  automatically disables App Lock so you can't lock yourself out.

Required env vars on the server:
```env
WEBAUTHN_RP_ID=thefinancialflows.net      # bare host (no scheme, no port)
WEBAUTHN_RP_NAME=Financial Flows
WEBAUTHN_ORIGIN=https://thefinancialflows.net
```

### Push notifications

`Settings → Notifications` enables web-push alerts for:
- **Account sync completion** — when the hourly cron pulls in new
  transactions.
- **Budget category warnings** — when any category hits ≥ 90% of its
  monthly limit.

iOS Safari only delivers push to PWAs that have been added to the
home screen. The Settings UI detects this and shows guidance if the
user is still in the browser.

Required env vars on the server:
```bash
# Generate once and save the output:
npx web-push generate-vapid-keys --json
```

```env
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>   # same as VAPID_PUBLIC_KEY
VAPID_CONTACT_EMAIL=mailto:admin@yourdomain.com
```

### Offline support

A service worker (built with `@ducanh2912/next-pwa`) caches the
dashboard shell, fonts, icons, and last-known API responses
(`/api/insights`, `/api/accounts`, `/api/transactions`,
`/api/goals`, `/api/budgets`, `/api/categories`). Mutation routes
(POST/PUT/DELETE) are never cached.

When the device is offline the user sees a small amber banner at the
top of the screen and the dashboard renders from cache; reconnecting
auto-refreshes everything in the background.

### Build notes

`@ducanh2912/next-pwa` requires the webpack bundler — `npm run build`
uses `--webpack` to opt out of Turbopack. The service worker file
(`public/sw.js`, `public/workbox-*.js`, `public/worker-*.js`) is
generated per build and gitignored.
