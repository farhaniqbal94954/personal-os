# Personal OS

Private finance & personal management web app — React + Vite + TypeScript + **Supabase**.

---

## 1 · Database (Supabase → SQL Editor → New query → Run)

| Situation | Run |
|---|---|
| **Existing project** (you already ran 001) | `supabase/migrations/002_upgrade.sql` |
| **New project** | `001_initial_schema.sql`, then `002_upgrade.sql` |

`002_upgrade.sql` keeps all existing data and can safely be run twice.
What it changes:
- **Accounts:** the old `balance` becomes the *starting balance* on the date it was last saved. From then on the
  balance is **calculated**: starting balance + transactions on/after that date.
- **Transactions:** adds Transfer & Adjustment types, cross-currency transfers (`to_amount`), links to
  project / business / investment / invoice.
- **New tables:** `budgets`, `user_settings`. Plus new columns for reminders (repeat, amount), invoices & contracts, notes (pinned) etc.
- Row-Level Security on every table — each login sees only its own data.

> After upgrading, open **Bank Accounts → Reconcile** on each account once and type the balance from your bank app.
> The app records the difference so everything matches from day one.

## 2 · Create your login
Supabase → **Authentication → Users → Add user** (email + password). Optionally turn off public sign-ups
(Authentication → Providers → Email → disable "Allow new users to sign up").

## 3 · Run locally
```bash
cp .env.local.example .env.local     # fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Project Settings → API)
npm install
npm run dev                          # http://localhost:5173
```

## 4 · Host it (Netlify or Vercel — free)
1. Push this folder to GitHub (the `.gitignore` keeps `.env.local` private), or drag-and-drop on Netlify.
2. **Build command:** `npm run build` · **Publish directory:** `dist`
3. **Environment variables:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`).
4. Page refresh on deep links (e.g. `/accounts`) is handled by `public/_redirects` (Netlify) and `vercel.json` (Vercel).
5. Supabase → Authentication → URL Configuration → set **Site URL** to your hosted address.

Do **not** upload an old `dist/` folder — always build with your env variables set.

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
