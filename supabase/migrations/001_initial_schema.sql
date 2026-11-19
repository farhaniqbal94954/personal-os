-- ============================================================
-- Personal OS — Supabase Database Schema
-- Run this in Supabase → SQL Editor → New Query → Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ACCOUNTS
-- ============================================================
create table if not exists accounts (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  country     text not null check (country in ('UAE', 'INDIA')),
  bank        text not null,
  name        text not null,
  type        text not null check (type in ('Savings', 'Current', 'Business', 'Salary')),
  number      text not null,
  balance     numeric(14, 2) not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists accounts_user_country on accounts(user_id, country);
alter table accounts enable row level security;
create policy "accounts_own" on accounts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  country     text not null check (country in ('UAE', 'INDIA')),
  description text not null,
  category    text not null,
  date        date not null,
  account_id  uuid references accounts(id) on delete set null,
  type        text not null check (type in ('Income', 'Expense')),
  amount      numeric(14, 2) not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create index if not exists transactions_user_country_date on transactions(user_id, country, date desc);
alter table transactions enable row level security;
create policy "transactions_own" on transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- HOLDINGS (Investments)
-- ============================================================
create table if not exists holdings (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  country       text not null check (country in ('UAE', 'INDIA')),
  name          text not null,
  type          text not null,
  invested      numeric(14, 2) not null default 0,
  current_value numeric(14, 2) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists holdings_user_country on holdings(user_id, country);
alter table holdings enable row level security;
create policy "holdings_own" on holdings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- PROJECTS
-- ============================================================
create table if not exists projects (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  country    text not null check (country in ('UAE', 'INDIA')),
  name       text not null,
  budget     numeric(14, 2) not null default 0,
  spent      numeric(14, 2) not null default 0,
  status     text not null check (status in ('Active', 'In progress', 'Completed', 'On hold')),
  created_at timestamptz not null default now()
);
create index if not exists projects_user_country on projects(user_id, country);
alter table projects enable row level security;
create policy "projects_own" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  due_date   date not null,
  priority   text not null check (priority in ('Low', 'Medium', 'High')),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_done on tasks(user_id, done, due_date);
alter table tasks enable row level security;
create policy "tasks_own" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- REMINDERS
-- ============================================================
create table if not exists reminders (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  detail     text not null,
  due_date   date not null,
  status     text not null check (status in ('Upcoming', 'Done')) default 'Upcoming',
  created_at timestamptz not null default now()
);
create index if not exists reminders_user_status on reminders(user_id, status, due_date);
alter table reminders enable row level security;
create policy "reminders_own" on reminders for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- NOTES
-- ============================================================
create table if not exists notes (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  content    text not null,
  tag        text not null check (tag in ('Personal', 'Business', 'Technical', 'Other')),
  created_at timestamptz not null default now()
);
create index if not exists notes_user_created on notes(user_id, created_at desc);
alter table notes enable row level security;
create policy "notes_own" on notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists businesses (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  country     text not null check (country in ('UAE', 'INDIA')),
  name        text not null,
  type        text not null,
  description text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists businesses_user_country on businesses(user_id, country);
alter table businesses enable row level security;
create policy "businesses_own" on businesses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- BUSINESS ITEMS
-- ============================================================
create table if not exists business_items (
  id          uuid primary key default uuid_generate_v4(),
  business_id uuid not null references businesses(id) on delete cascade,
  label       text not null,
  value       numeric(14, 2) not null default 0,
  category    text not null check (category in ('Revenue', 'Expense', 'Contract', 'Invoice', 'Other')),
  date        date not null,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists business_items_business_date on business_items(business_id, date desc);
-- RLS via business ownership (user must own the business)
alter table business_items enable row level security;
create policy "business_items_own" on business_items for all
  using (exists (select 1 from businesses b where b.id = business_id and b.user_id = auth.uid()))
  with check (exists (select 1 from businesses b where b.id = business_id and b.user_id = auth.uid()));

-- ============================================================
-- GRANT permissions to authenticated role
-- ============================================================
grant select, insert, update, delete on accounts       to authenticated;
grant select, insert, update, delete on transactions   to authenticated;
grant select, insert, update, delete on holdings       to authenticated;
grant select, insert, update, delete on projects       to authenticated;
grant select, insert, update, delete on tasks          to authenticated;
grant select, insert, update, delete on reminders      to authenticated;
grant select, insert, update, delete on notes          to authenticated;
grant select, insert, update, delete on businesses     to authenticated;
grant select, insert, update, delete on business_items to authenticated;
