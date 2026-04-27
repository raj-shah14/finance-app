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
