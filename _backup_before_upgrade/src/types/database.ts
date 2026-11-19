export type Country = 'UAE' | 'INDIA'

export interface Account {
  id: string
  user_id: string
  country: Country
  bank: string
  name: string
  type: 'Savings' | 'Current' | 'Business' | 'Salary'
  number: string
  balance: number
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  country: Country
  description: string
  category: string
  date: string
  account_id: string | null
  type: 'Income' | 'Expense'
  amount: number
}

export interface Holding {
  id: string
  user_id: string
  country: Country
  name: string
  type: 'Stocks' | 'Mutual fund' | 'Gold' | 'Deposit' | 'ETF' | 'Crypto' | 'Other'
  invested: number
  current_value: number
}

export interface Allocation {
  id: string
  user_id: string
  country: Country
  label: string
  target_pct: number
}

export interface Project {
  id: string
  user_id: string
  country: Country
  name: string
  budget: number
  spent: number
  status: 'Active' | 'In progress' | 'Completed' | 'On hold'
}

export interface Task {
  id: string
  user_id: string
  name: string
  due_date: string
  priority: 'Low' | 'Medium' | 'High'
  done: boolean
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  name: string
  detail: string
  due_date: string
  status: 'Upcoming' | 'Done'
}

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  tag: 'Personal' | 'Business' | 'Technical' | 'Other'
  created_at: string
}

export interface Business {
  id: string
  user_id: string
  name: string
  type: string
  description: string
  country: Country
  created_at: string
}

export interface BusinessItem {
  id: string
  business_id: string
  label: string
  value: number
  category: 'Revenue' | 'Expense' | 'Contract' | 'Invoice' | 'Other'
  date: string
  notes: string
}
