# Personal OS

Private finance & personal management web app — React + Vite + TypeScript + **Supabase**.

---

## 1 · Deploy on Vercel (easiest — no SQL, no copying keys)
1. Push this folder to GitHub (the `.gitignore` keeps `.env.local` and `node_modules` out).
2. Vercel → **Add New → Project** → pick the repo. Framework **Vite** is detected (build `npm run build`, output `dist`).
3. When Vercel offers it, **connect Supabase** (Storage / Integrations → Supabase → create or link a project).
4. Deploy. That's it:
   - the app reads the Supabase settings the integration creates (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
     `…_ANON_KEY`, `SUPABASE_URL` … — any of them work, `VITE_…` names too);
   - during the build, `scripts/migrate.mjs` uses `POSTGRES_URL_NON_POOLING` to **create / upgrade all tables automatically**.
     Each migration runs once (tracked in `_personal_os_migrations`); an existing database keeps all its data.
   - only the URL and the **public** key go into the browser; a secret/service-role key stops the build on purpose.
5. Open the site → **Create an account** → you're in.

Afterwards (recommended, 1 minute in Supabase):
- **Authentication → URL Configuration → Site URL** = your Vercel address (so confirmation emails link to the right site).
- If Supabase asks you to confirm your email, click the link in the email, then sign in.
- After creating your own account, turn sign-ups off: **Authentication → Sign In / Providers → Email → disable "Allow new users to sign up"**.

> Connected an existing Supabase project with data? After the first deploy open **Bank Accounts → Reconcile** once per account.

## 2 · Run locally
```bash
cp .env.local.example .env.local     # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (Project Settings → API)
npm install
npm run dev                          # http://localhost:5173
```
Local builds skip the database step unless a `POSTGRES_URL…` variable is set. You can also run the SQL files in
`supabase/migrations` by hand in the Supabase SQL Editor (001 then 002) — both ways give the same result.

---

## How the money logic works
- **Balance = starting balance + income − expenses ± transfers ± adjustments** (only transactions on/after the account's start date).
  Older transactions (e.g. imported statement history) show a *not in balance* badge.
- **Transfers** (between your own accounts, card payments, UAE → India remittances) and **investment buys/sells** are never counted as income or expense.
- Credit cards: purchases are expenses on the card; paying the card is a transfer. Enter a card's starting balance as a negative number (amount owed).
- **Reconcile** = type the real bank balance → an adjustment fixes any difference.
- Money is calculated in integer cents (no rounding drift); dates use your local time zone.

## Features
| Section | What it does |
|---|---|
| Dashboard | Bank balance, this-month income/expenses vs last month, investments, net worth (both countries with your FX rate), 6-month cash flow, **smart suggestions**, spending by category, upcoming bills/invoices/renewals, tasks |
| Bank Accounts | Add / edit / archive / delete, reconcile, history, month movement, 12-month balance trend, credit cards |
| Transactions | Income, expense, transfer, adjustment · edit & delete · filters (month, type, account, category, search) · CSV import (bank statements, duplicate detection, auto-categories) · CSV export |
| Budgets | Monthly limit per category, spending pace, unbudgeted spending |
| Investments | Holdings, buy / sell from bank accounts, update value, gain/loss, allocation vs target |
| Projects | Budget, spending from tagged expenses + earlier spending |
| Tasks · Reminders · Notes | Priorities & due dates · recurring bills with **Pay** (records expense, moves due date) · pinned/tagged notes |
| Business Hub | Per business: revenue/expenses from tagged transactions, invoices (mark paid → income), AMC contracts (collect → income, next due), manual entries, licence expiry |
| Reports | This/last month, YTD, 12 months, last year, all time · category breakdowns · month table with month-end bank balance · CSV / print |
| Settings | FX rate, emergency-fund months, savings target, your own categories, full JSON backup |

**Suggestions** are rule-based and run in the browser (no AI service, no extra cost): overdrafts, card dues,
reconcile reminders, overdue/upcoming bills vs available cash, savings rate vs target, category spikes vs 3-month average,
budget overruns, emergency-fund coverage, idle cash, allocation drift, stale investment values, overdue invoices,
contract collections, licence renewals, projects over budget.

## Project structure
```
src/lib/data.ts       ← the only place that talks to Supabase (loads all rows, pages past 1000, numeric → number)
src/lib/finance.ts    ← all calculations (balances, totals, suggestions, CSV)
src/lib/forms.tsx     ← every add / edit / delete flow
src/components/       ← Layout, FormModal, shared UI
src/pages/            ← one file per screen
```
