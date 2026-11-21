-- ============================================================
-- Personal OS — 003 Safety Jars
-- Jars "label" part of a bank balance (money never leaves the account).
-- Runs automatically on Vercel deploy (scripts/migrate.mjs), or paste into Supabase SQL Editor.
-- Safe to run more than once.
-- ============================================================

-- What each bank account is used for (daily spending, savings, company …)
alter table accounts add column if not exists purpose text;
alter table accounts drop constraint if exists accounts_purpose_check;
alter table accounts add constraint accounts_purpose_check
  check (purpose is null or purpose in ('Daily','Savings','Business','Other'));

-- ------------------------------------------------------------
-- JARS
--   kind = 'money'      → fills with money reserved inside your bank accounts
--   kind = 'protection' → an insurance policy (covered / not covered, renewal)
--   target_mode = 'fixed'  → target_amount
--   target_mode = 'months' → target_months × your average monthly expenses (updates by itself)
-- ------------------------------------------------------------
create table if not exists jars (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  country        text not null check (country in ('UAE','INDIA')),
  name           text not null,
  icon           text not null default '🫙',
  kind           text not null default 'money' check (kind in ('money','protection')),
  priority       integer not null default 1,
  target_mode    text not null default 'fixed' check (target_mode in ('fixed','months')),
  target_amount  numeric(14,2) not null default 0 check (target_amount >= 0),
  target_months  numeric(5,2),
  target_date    date,
  -- protection jars
  covered        boolean not null default false,
  provider       text not null default '',
  policy_no      text not null default '',
  coverage       numeric(16,2),
  premium        numeric(14,2),
  premium_freq   text check (premium_freq is null or premium_freq in ('Monthly','Quarterly','Yearly')),
  renewal_date   date,
  reminder_id    uuid references reminders(id) on delete set null,
  note           text not null default '',
  archived       boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists jars_user on jars(user_id, country, priority);

-- ------------------------------------------------------------
-- JAR ALLOCATIONS — the ledger of money reserved / released / used
--   amount > 0  → reserved into the jar (kind 'add')
--   amount < 0  → released back to free money ('release') or spent in an emergency ('use')
-- jar balance in an account = sum(amount) for that jar + account
-- ------------------------------------------------------------
create table if not exists jar_allocations (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  jar_id      uuid not null references jars(id) on delete cascade,
  account_id  uuid not null references accounts(id) on delete cascade,
  amount      numeric(14,2) not null check (amount <> 0),
  kind        text not null check (kind in ('add','release','use')),
  date        date not null default current_date,
  note        text not null default '',
  txn_id      uuid references transactions(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists jar_alloc_jar on jar_allocations(jar_id);
create index if not exists jar_alloc_account on jar_allocations(account_id);

-- ------------------------------------------------------------
-- Security: each login sees only its own jars.
-- Extra check: a jar allocation may only point at YOUR jar and YOUR account.
-- ------------------------------------------------------------
alter table jars enable row level security;
alter table jar_allocations enable row level security;
drop policy if exists "jars_own" on jars;
create policy "jars_own" on jars for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "jar_alloc_own" on jar_allocations;
create policy "jar_alloc_own" on jar_allocations for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from jars j where j.id = jar_id and j.user_id = auth.uid())
    and exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid())
  );

grant select, insert, update, delete on jars            to authenticated;
grant select, insert, update, delete on jar_allocations to authenticated;

notify pgrst, 'reload schema';
