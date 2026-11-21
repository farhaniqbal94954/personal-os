export type Country = 'UAE' | 'INDIA'
export type TxType = 'Income' | 'Expense' | 'Transfer' | 'Adjustment'

export interface Account {
  id: string; user_id: string; country: Country
  bank: string; name: string
  type: 'Savings' | 'Current' | 'Salary' | 'Business' | 'Credit card' | 'Cash' | 'Wallet' | 'Deposit'
  last4: string | null
  opening_balance: number
  opening_date: string
  archived: boolean
  last_reconciled: string | null
  purpose: 'Daily' | 'Savings' | 'Business' | 'Other' | null
}

export interface Transaction {
  id: string; user_id: string; country: Country
  type: TxType
  date: string
  amount: number                 // always > 0, except Adjustment (signed)
  account_id: string | null      // Income/Expense/Adjustment account, or FROM account of a transfer
  to_account_id: string | null   // TO account of a transfer
  to_amount: number | null       // amount received when the two accounts use different currencies
  category: string | null
  description: string
  project_id: string | null
  business_id: string | null
  holding_id: string | null
  bitem_id: string | null
  kind: 'buy' | 'sell' | null
  cost: number | null
  note: string
  created_at: string
}

export interface Holding {
  id: string; user_id: string; country: Country
  name: string; type: string
  units: number | null
  invested: number
  current_value: number
  note: string
  updated_on: string
}

export interface Project {
  id: string; user_id: string; country: Country
  name: string; budget: number; manual_spent: number
  status: 'Active' | 'In progress' | 'Completed' | 'On hold'
  deadline: string | null; note: string
}

export interface Task {
  id: string; user_id: string
  name: string; due_date: string
  priority: 'Low' | 'Medium' | 'High'
  done: boolean; note: string; done_on: string | null
  created_at: string
}

export interface Reminder {
  id: string; user_id: string; country: Country
  name: string; detail: string; due_date: string
  status: 'Upcoming' | 'Done'
  repeat: 'none' | 'monthly' | 'quarterly' | 'yearly'
  amount: number | null; account_id: string | null; category: string | null
  done_on: string | null
}

export interface Note {
  id: string; user_id: string
  title: string; content: string
  tag: 'Personal' | 'Business' | 'Technical' | 'Finance' | 'Ideas' | 'Other'
  pinned: boolean
  created_at: string; updated_at: string
}

export interface Business {
  id: string; user_id: string; country: Country
  name: string; type: string; description: string
  licence: string; licence_expiry: string | null
  created_at: string
}

/** Invoice (receivable), Contract (recurring AMC) or a manual Revenue/Expense entry not linked to a bank account */
export interface BusinessItem {
  id: string; business_id: string
  category: 'Revenue' | 'Expense' | 'Contract' | 'Invoice' | 'Other'
  label: string; value: number; date: string; notes: string
  client: string; number: string
  due_date: string | null
  status: string | null          // Invoice: Unpaid | Paid · Contract: Active | Paused | Ended
  freq: 'Monthly' | 'Quarterly' | 'Half-yearly' | 'Yearly' | null
  next_due: string | null; end_date: string | null; paid_on: string | null
  txn_id: string | null
}

export interface Budget {
  id: string; user_id: string; country: Country
  category: string; monthly_limit: number
}

export interface UserSettings {
  user_id: string
  fx_aed_inr: number
  emergency_months: number
  savings_target: number
  income_categories: string[] | null
  expense_categories: string[] | null
  targets: Partial<Record<Country, Record<string, number>>>
}

/** A jar labels part of a bank balance — the money stays in the account */
export interface Jar {
  id: string; user_id: string; country: Country
  name: string; icon: string
  kind: 'money' | 'protection'
  priority: number
  target_mode: 'fixed' | 'months'
  target_amount: number
  target_months: number | null
  target_date: string | null
  covered: boolean; provider: string; policy_no: string
  coverage: number | null; premium: number | null
  premium_freq: 'Monthly' | 'Quarterly' | 'Yearly' | null
  renewal_date: string | null; reminder_id: string | null
  note: string; archived: boolean; created_at: string
}

/** + reserve, − release / use. Jar balance in an account = sum(amount) */
export interface JarAllocation {
  id: string; user_id: string
  jar_id: string; account_id: string
  amount: number
  kind: 'add' | 'release' | 'use'
  date: string; note: string; txn_id: string | null
  created_at: string
}

export interface AppData {
  accounts: Account[]
  transactions: Transaction[]
  holdings: Holding[]
  projects: Project[]
  tasks: Task[]
  reminders: Reminder[]
  notes: Note[]
  businesses: Business[]
  business_items: BusinessItem[]
  budgets: Budget[]
  jars: Jar[]
  jar_allocations: JarAllocation[]
  settings: UserSettings
}
