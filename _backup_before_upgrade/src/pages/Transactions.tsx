import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney, formatDate } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Transaction, Account } from '../types/database'

const schema = z.object({
  description: z.string().min(1, 'Description required'),
  category:    z.string().min(1, 'Category required'),
  date:        z.string().min(1, 'Date required'),
  account_id:  z.string().optional(),
  type:        z.enum(['Income', 'Expense']),
  amount:      z.coerce.number().min(0.01, 'Amount must be greater than 0'),
})
type TxForm = z.infer<typeof schema>

const CATEGORIES = [
  'Salary','Business income','Independent project','Freelance',
  'Food','Transport','Utilities','Household','Healthcare',
  'Shopping','Entertainment','Investment','Savings','Other',
]

export default function Transactions() {
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'Income' | 'Expense'>('all')
  const money = (n: number) => formatMoney(n, country)

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('id,bank,name').eq('country', country).order('bank')
      if (error) throw error
      return data as Account[]
    },
  })

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions').select('*').eq('country', country)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const today = new Date().toISOString().split('T')[0]
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TxForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'Expense', date: today },
  })
  const watchType = watch('type')

  const addMutation = useMutation({
    mutationFn: async (form: TxForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('transactions').insert({
        user_id: session.user.id, country,
        description: form.description, category: form.category,
        date: form.date, type: form.type, amount: form.amount,
        account_id: form.account_id || null,
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transactions'] }); reset({ type: 'Expense', date: today }); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })

  const filtered = transactions.filter(t => {
    const matchSearch = `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || t.type === typeFilter
    return matchSearch && matchType
  })

  const totalIncome  = filtered.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="All income and expense records for this workspace."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add transaction</button>}
      />

      {/* Summary strip */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Income</span>
            <span className="text-sm font-black text-income">+{money(totalIncome)}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Expenses</span>
            <span className="text-sm font-black text-expense">−{money(totalExpense)}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Net</span>
            <span className={`text-sm font-black ${totalIncome - totalExpense >= 0 ? 'text-income' : 'text-expense'}`}>
              {totalIncome - totalExpense >= 0 ? '+' : '−'}{money(Math.abs(totalIncome - totalExpense))}
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">Transaction history</h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input text-sm max-w-xs"
            placeholder="Search…"
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
            className="input text-sm w-36"
          >
            <option value="all">All types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Description</th>
                <th className="table-th">Category</th>
                <th className="table-th">Date</th>
                <th className="table-th">Type</th>
                <th className="table-th text-right">Amount</th>
                <th className="table-th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="table-td text-center py-10 text-slate-400 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400 text-sm">
                  {transactions.length === 0 ? 'No transactions yet.' : 'No transactions match your filters.'}
                </td></tr>
              ) : filtered.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="table-td text-sm font-semibold text-slate-800 dark:text-slate-200">{t.description}</td>
                  <td className="table-td text-sm text-slate-500 dark:text-slate-400">{t.category}</td>
                  <td className="table-td text-sm text-slate-500 dark:text-slate-400">{formatDate(t.date)}</td>
                  <td className="table-td">
                    <span className={t.type === 'Income' ? 'badge badge-blue' : 'badge badge-red'}>{t.type}</span>
                  </td>
                  <td className="table-td text-right">
                    <span className={`text-sm font-bold ${t.type === 'Income' ? 'text-income' : 'text-expense'}`}>
                      {t.type === 'Income' ? '+' : '−'}{money(t.amount)}
                    </span>
                  </td>
                  <td className="table-td">
                    <button
                      onClick={() => { if (confirm('Delete this transaction?')) deleteMutation.mutate(t.id) }}
                      className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset({ type: 'Expense', date: today }) }} title="Add transaction">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Description</label>
            <input {...register('description')} className="input" placeholder="Monthly salary" />
            {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select {...register('category')} className="input">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input {...register('date')} type="date" className="input" />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label className="label">Type</label>
              <select {...register('type')} className="input">
                <option>Income</option>
                <option>Expense</option>
              </select>
            </div>
            <div>
              <label className="label">Amount ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input {...register('amount')} type="number" className="input" min="0.01" step="0.01" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
            </div>
          </div>
          {accounts.length > 0 && (
            <div>
              <label className="label">Bank account (optional)</label>
              <select {...register('account_id')} className="input">
                <option value="">— Select account —</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank} · {a.name}</option>)}
              </select>
            </div>
          )}
          <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${watchType === 'Income' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            This will be recorded as {watchType === 'Income' ? '📥 Income' : '📤 Expense'}
          </div>
          {addMutation.isError && <p className="text-xs text-red-500">Failed to save. Please try again.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset({ type: 'Expense', date: today }) }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save transaction'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
