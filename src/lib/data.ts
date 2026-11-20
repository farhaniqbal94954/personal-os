import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { AppData, UserSettings } from '../types/database'

/**
 * ONE place that talks to Supabase.
 * - Postgres `numeric` columns arrive as STRINGS from Supabase → we convert them to numbers here.
 *   (The old app added strings together: "0"+"18450.00"+"12000.00" → garbage bank balance.)
 * - Loads every row (Supabase returns max 1000 rows per request → we page through).
 * - One shared cache ['all'] so pages never overwrite each other's data.
 */
type Table = 'accounts' | 'transactions' | 'holdings' | 'projects' | 'tasks' | 'reminders' | 'notes' | 'businesses' | 'business_items' | 'budgets'
export const TABLES: Table[] = ['accounts', 'transactions', 'holdings', 'projects', 'tasks', 'reminders', 'notes', 'businesses', 'business_items', 'budgets']

const NUMERIC: Record<string, string[]> = {
  accounts: ['opening_balance'],
  transactions: ['amount', 'to_amount', 'cost'],
  holdings: ['units', 'invested', 'current_value'],
  projects: ['budget', 'manual_spent'],
  reminders: ['amount'],
  business_items: ['value'],
  budgets: ['monthly_limit'],
  user_settings: ['fx_aed_inr', 'emergency_months', 'savings_target'],
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function coerce(table: string, row: any) {
  for (const k of NUMERIC[table] || []) if (row[k] !== null && row[k] !== undefined) row[k] = Number(row[k])
  if (table === 'transactions') row.description = row.description ?? ''
  return row
}

export const DEFAULT_INCOME = ['Salary', 'Business income', 'Freelance', 'Independent project', 'AMC collection', 'Interest', 'Dividends', 'Rent received', 'Refund', 'Gift', 'Other income']
export const DEFAULT_EXPENSE = ['Food & groceries', 'Dining out', 'Transport & fuel', 'Utilities', 'Internet & mobile', 'Rent', 'Household', 'Healthcare', 'Insurance', 'Education', 'Shopping', 'Entertainment', 'Travel', 'Family support', 'Loan / EMI', 'Fees & charges', 'Business expense', 'Project expense', 'Investment', 'Savings', 'Other expense']
export function defaultSettings(user_id = ''): UserSettings {
  return {
    user_id, fx_aed_inr: 22.5, emergency_months: 6, savings_target: 20, income_categories: null, expense_categories: null,
    targets: { UAE: { 'Mutual fund': 40, Stocks: 30, Gold: 20, Deposit: 10 }, INDIA: { 'Mutual fund': 50, Stocks: 25, Gold: 10, Deposit: 15 } },
  }
}

let cachedUserId: string | null = null
export async function userId() {
  if (cachedUserId) return cachedUserId
  const { data } = await supabase.auth.getSession()
  if (!data.session?.user) throw new Error('You are signed out — please sign in again.')
  cachedUserId = data.session.user.id
  return cachedUserId
}
export function clearUserCache() { cachedUserId = null }

async function fetchAll(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}${error.code === '42703' || error.code === 'PGRST204' ? ' — did you run supabase/migrations/002_upgrade.sql?' : ''}`)
    out.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return out.map((r) => coerce(table, r))
}

async function loadAll(): Promise<AppData> {
  const results = await Promise.all(TABLES.map(fetchAll))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = {}
  // stable, predictable order: oldest first (your first account is the default everywhere)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byCreated = (a: any, b: any) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id).localeCompare(String(b.id))
  TABLES.forEach((t, i) => (d[t] = results[i].sort(byCreated)))
  const { data: s, error } = await supabase.from('user_settings').select('*').maybeSingle()
  if (error) throw new Error(`user_settings: ${error.message} — did you run supabase/migrations/002_upgrade.sql?`)
  const def = defaultSettings(await userId())
  d.settings = s ? { ...def, ...coerce('user_settings', s), targets: { ...def.targets, ...(s.targets || {}) } } : def
  return d as AppData
}

export function useData() {
  const q = useQuery({ queryKey: ['all'], queryFn: loadAll, staleTime: 60_000 })
  return { data: q.data, isLoading: q.isLoading, error: q.error as Error | null, refetch: q.refetch }
}

const OWNED = new Set<string>(['accounts', 'transactions', 'holdings', 'projects', 'tasks', 'reminders', 'notes', 'businesses', 'budgets'])

/** Write helpers — update the shared cache from the rows Supabase sends back (instant UI, no full reload). */
export function useDb() {
  const qc = useQueryClient()
  const patch = (fn: (d: AppData) => AppData) => qc.setQueryData<AppData>(['all'], (d) => (d ? fn(d) : d))
  const fail = (table: string, e: { message: string; code?: string }) => {
    throw new Error(`${e.message}${e.code === 'PGRST204' || e.code === '42703' ? ' — run supabase/migrations/002_upgrade.sql' : ''} (${table})`)
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async insert<T = any>(table: Table, rows: Record<string, unknown> | Record<string, unknown>[]): Promise<T[]> {
      const uid = await userId()
      const list = (Array.isArray(rows) ? rows : [rows]).map((r) => (OWNED.has(table) ? { user_id: uid, ...r } : r))
      const created: T[] = []
      for (let i = 0; i < list.length; i += 500) {
        const { data, error } = await supabase.from(table).insert(list.slice(i, i + 500)).select()
        if (error) fail(table, error)
        created.push(...(data || []).map((r) => coerce(table, r)))
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      patch((d) => ({ ...d, [table]: [...(d as any)[table], ...created] }))
      return created
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async update<T = any>(table: Table, id: string, values: Record<string, unknown>): Promise<T> {
      const { data, error } = await supabase.from(table).update(values).eq('id', id).select()
      if (error) fail(table, error)
      if (!data || !data.length) throw new Error(`Could not update — row not found or not yours (${table})`)
      const row = coerce(table, data[0])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      patch((d) => ({ ...d, [table]: (d as any)[table].map((r: any) => (r.id === id ? row : r)) }))
      return row
    },
    async remove(table: Table, ids: string | string[]) {
      const list = Array.isArray(ids) ? ids : [ids]
      if (!list.length) return
      for (let i = 0; i < list.length; i += 200) {
        const { error } = await supabase.from(table).delete().in('id', list.slice(i, i + 200))
        if (error) fail(table, error)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      patch((d) => ({ ...d, [table]: (d as any)[table].filter((r: any) => !list.includes(r.id)) }))
    },
    async saveSettings(values: Partial<UserSettings>) {
      const uid = await userId()
      const cur = qc.getQueryData<AppData>(['all'])?.settings || defaultSettings(uid)
      const row = { ...cur, ...values, user_id: uid, updated_at: new Date().toISOString() }
      const { data, error } = await supabase.from('user_settings').upsert(row).select()
      if (error) fail('user_settings', error)
      const saved = coerce('user_settings', (data || [row])[0])
      patch((d) => ({ ...d, settings: { ...cur, ...saved } }))
    },
    refresh: () => qc.invalidateQueries({ queryKey: ['all'] }),
  }
}
