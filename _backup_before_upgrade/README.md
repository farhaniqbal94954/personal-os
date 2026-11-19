# Personal OS

> Your private financial and personal management webapp — built with React, Vite, TypeScript, and Supabase.

---

## 🚀 Quick Start (5 minutes)

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → New project → free tier is enough.

### 2. Run the database migration
In your Supabase project → **SQL Editor** → **New query** → paste the contents of:
```
supabase/migrations/001_initial_schema.sql
```
Click **Run**. Done — all tables, indexes, and security policies are created.

### 3. Create your user account
In Supabase → **Authentication** → **Users** → **Add user** → enter your email and password.

### 4. Set your environment variables
```bash
cp .env.local.example .env.local
```
Open `.env.local` and fill in:
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```
Both values are in Supabase → **Project Settings** → **API**.

### 5. Install and run
```bash
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) — log in with your email and password.

---

## 🏗️ Build for production
```bash
npm run build
```
Deploy the `dist/` folder to Netlify, Vercel, or any static host.

---

## 🧭 Features

| Section | Description |
|---|---|
| **Dashboard** | Live KPIs, cash-flow chart, recent transactions, task priorities |
| **Bank Accounts** | Add/delete accounts, balance tracking, search |
| **Transactions** | Full history, search, filter by type, CSV export |
| **Investments** | Holdings, allocation bars, performance chart |
| **Projects & Budgets** | Budget tracking with progress bars |
| **Tasks** | To-do list with priority and due dates, live checkboxes |
| **Reminders** | Due-date reminders with overdue/due-soon alerts |
| **Notes** | Tagged note cards with full content view |
| **Business Hub** | Add any business you own; track revenue, expenses, contracts, invoices per business |
| **Reports** | Monthly summary, category breakdown, real CSV export |

---

## 🎨 Design

- **Theme:** Slate Indigo — professional fintech look
- **Income:** Blue 🔵
- **Expense:** Red 🔴
- **Warning/pending:** Amber 🟡
- **Dark mode:** Toggle in sidebar — preference saved across sessions
- **Country workspace:** UAE (AED) · India (INR) — data separated per country

---

## 🔐 Security

- Supabase Auth — email + password
- Row-Level Security on every table — your data is accessible only to your authenticated user
- No data is stored in the browser beyond preferences (theme, country)
