-- ============================================================
-- Personal OS — 002 upgrade
-- Run AFTER 001_initial_schema.sql (Supabase → SQL Editor → New query → Run).
-- Safe to run on a database that already has your data: nothing is deleted,
-- and it can be run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- ACCOUNTS — balance is now CALCULATED:
--   current balance = opening_balance + transactions dated on/after opening_date
-- The old "balance" value becomes the opening balance on the date it was last set.
-- ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='accounts' and column_name='opening_balance') then
    alter table accounts add column opening_balance numeric(14,2);
    alter table accounts add column opening_date date;
    update accounts set opening_balance = balance, opening_date = coalesce(updated_at::date, current_date);
  end if;
end $$;
update accounts set opening_balance = 0 where opening_balance is null;
update accounts set opening_date = current_date where opening_date is null;
alter table accounts alter column opening_balance set default 0;
alter table accounts alter column opening_balance set not null;
alter table accounts alter column opening_date set default current_date;
alter table accounts alter column opening_date set not null;
alter table accounts add column if not exists last4 text;
alter table accounts add column if not exists archived boolean not null default false;
alter table accounts add column if not exists last_reconciled date;
alter table accounts add column if not exists created_at timestamptz not null default now();
update accounts set last4 = right(regexp_replace(number, '\D', '', 'g'), 4) where last4 is null and number is not null;
alter table accounts alter column number drop not null;
alter table accounts alter column number set default '';
alter table accounts drop constraint if exists accounts_type_check;
alter table accounts add constraint accounts_type_check
  check (type in ('Savings','Current','Salary','Business','Credit card','Cash','Wallet','Deposit'));

-- ------------------------------------------------------------
-- PROJECTS / HOLDINGS / BUSINESSES (needed before transaction FKs)
-- ------------------------------------------------------------
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='manual_spent') then
    alter table projects add column manual_spent numeric(14,2) not null default 0;
    update projects set manual_spent = coalesce(spent, 0);   -- keep what you had typed before
  end if;
end $$;
alter table projects add column if not exists deadline date;
alter table projects add column if not exists note text not null default '';

alter table holdings add column if not exists units numeric(18,6);
alter table holdings add column if not exists note text not null default '';
alter table holdings add column if not exists updated_on date not null default current_date;

alter table businesses add column if not exists licence text not null default '';
alter table businesses add column if not exists licence_expiry date;

-- ------------------------------------------------------------
-- BUSINESS ITEMS — invoices (receivables) and recurring contracts / AMC
-- ------------------------------------------------------------
alter table business_items add column if not exists client   text not null default '';
alter table business_items add column if not exists number   text not null default '';
alter table business_items add column if not exists due_date date;
alter table business_items add column if not exists status   text;
alter table business_items add column if not exists freq     text;
alter table business_items add column if not exists next_due date;
alter table business_items add column if not exists end_date date;
alter table business_items add column if not exists paid_on  date;
alter table business_items add column if not exists txn_id   uuid;
-- old invoices were counted as revenue → keep them as paid; old contracts become active yearly contracts
update business_items set status = 'Paid', paid_on = date where category = 'Invoice' and status is null;
update business_items set status = 'Active', freq = 'Yearly', next_due = date where category = 'Contract' and status is null;
alter table business_items drop constraint if exists business_items_freq_check;
alter table business_items add constraint business_items_freq_check
  check (freq is null or freq in ('Monthly','Quarterly','Half-yearly','Yearly'));

-- ------------------------------------------------------------
-- TRANSACTIONS — transfers, adjustments, links
-- ------------------------------------------------------------
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('Income','Expense','Transfer','Adjustment'));
alter table transactions drop constraint if exists transactions_amount_check;
alter table transactions add constraint transactions_amount_check
  check ((type = 'Adjustment' and amount <> 0) or (type <> 'Adjustment' and amount >= 0));
alter table transactions alter column category drop not null;
alter table transactions alter column description set default '';
alter table transactions add column if not exists to_account_id uuid references accounts(id) on delete set null;
alter table transactions add column if not exists to_amount   numeric(14,2);
alter table transactions add column if not exists project_id  uuid references projects(id) on delete set null;
alter table transactions add column if not exists business_id uuid references businesses(id) on delete set null;
alter table transactions add column if not exists holding_id  uuid references holdings(id) on delete set null;
alter table transactions add column if not exists bitem_id    uuid references business_items(id) on delete set null;
alter table transactions add column if not exists kind        text;     -- 'buy' | 'sell' for investment transfers
alter table transactions add column if not exists cost        numeric(14,2);
alter table transactions add column if not exists note        text not null default '';
create index if not exists transactions_account on transactions(account_id);
create index if not exists transactions_to_account on transactions(to_account_id);

-- ------------------------------------------------------------
-- TASKS / REMINDERS / NOTES
-- ------------------------------------------------------------
alter table tasks add column if not exists note text not null default '';
alter table tasks add column if not exists done_on date;

alter table reminders add column if not exists country text not null default 'UAE';
alter table reminders drop constraint if exists reminders_country_check;
alter table reminders add constraint reminders_country_check check (country in ('UAE','INDIA'));
alter table reminders add column if not exists repeat text not null default 'none';
alter table reminders drop constraint if exists reminders_repeat_check;
alter table reminders add constraint reminders_repeat_check check (repeat in ('none','monthly','quarterly','yearly'));
alter table reminders add column if not exists amount numeric(14,2);
alter table reminders add column if not exists account_id uuid references accounts(id) on delete set null;
alter table reminders add column if not exists category text;
alter table reminders add column if not exists done_on date;
alter table reminders alter column detail set default '';

alter table notes add column if not exists pinned boolean not null default false;
alter table notes add column if not exists updated_at timestamptz not null default now();
alter table notes drop constraint if exists notes_tag_check;
alter table notes add constraint notes_tag_check check (tag in ('Personal','Business','Technical','Finance','Ideas','Other'));

-- ------------------------------------------------------------
-- NEW: BUDGETS (monthly limit per expense category)
-- ------------------------------------------------------------
create table if not exists budgets (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  country       text not null check (country in ('UAE','INDIA')),
  category      text not null,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  unique (user_id, country, category)
);
alter table budgets enable row level security;
drop policy if exists "budgets_own" on budgets;
create policy "budgets_own" on budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- NEW: USER SETTINGS (one row per user)
-- ------------------------------------------------------------
create table if not exists user_settings (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  fx_aed_inr         numeric(10,4) not null default 22.5,
  emergency_months   integer not null default 6,
  savings_target     integer not null default 20,
  income_categories  text[],
  expense_categories text[],
  targets            jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);
alter table user_settings enable row level security;
drop policy if exists "user_settings_own" on user_settings;
create policy "user_settings_own" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on budgets       to authenticated;
grant select, insert, update, delete on user_settings to authenticated;

-- Ask PostgREST (Supabase API) to pick up the new columns immediately
notify pgrst, 'reload schema';
