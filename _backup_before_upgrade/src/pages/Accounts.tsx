import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney } from '../lib/formatters'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Account } from '../types/database'

const schema = z.object({
  bank:    z.string().min(1, 'Bank name required'),
  name:    z.string().min(1, 'Account name required'),
  type:    z.enum(['Savings', 'Current', 'Business', 'Salary']),
  number:  z.string().length(4, 'Enter exactly 4 digits'),
  balance: z.coerce.number().min(0, 'Balance must be 0 or more'),
})
type AccountForm = z.infer<typeof schema>

export default function Accounts() {
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const money = (n: number) => formatMoney(n, country)

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['accounts', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('country', country).order('bank')
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AccountForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'Savings', balance: 0 },
  })

  const addMutation = useMutation({
    mutationFn: async (form: AccountForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('accounts').insert({
        user_id: session.user.id, country,
        bank: form.bank, name: form.name, type: form.type,
        number: '•••• ' + form.number, balance: form.balance,
        updated_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message + ' | code: ' + error.code)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['accounts'] }); reset(); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('accounts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const filtered = accounts.filter(a =>
    `${a.bank} ${a.name} ${a.type}`.toLowerCase().includes(search.toLowerCase())
  )
  const total = accounts.reduce((s, a) => s + a.balance, 0)
  const banks = new Set(accounts.map(a => a.bank)).size

  return (
    <div>
      <PageHeader
        title="Bank Accounts"
        subtitle="All your bank accounts in one place."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add account</button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total balance"    value={money(total)}              foot="All accounts combined" icon="💰" />
        <KpiCard label="Accounts"         value={String(accounts.length)}  foot={`Across ${banks} bank${banks !== 1 ? 's' : ''}`} icon="🏦" />
        <KpiCard label="Largest balance"  value={accounts.length ? money(Math.max(...accounts.map(a => a.balance))) : money(0)} icon="📊" />
        <KpiCard label="Currency"         value={country === 'UAE' ? 'AED' : 'INR'} foot="No conversion" icon="💱" />
      </div>

      {/* Table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">My bank accounts</h3>
          <span className="badge badge-slate">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input max-w-xs text-sm"
            placeholder="Search accounts…"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Account</th>
                <th className="table-th">Type</th>
                <th className="table-th">Number</th>
                <th className="table-th">Balance</th>
                <th className="table-th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="table-td text-center py-10 text-slate-400 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="table-td text-center py-12 text-slate-400 text-sm">
                  {search ? 'No accounts match your search.' : 'No accounts yet. Add your first account.'}
                </td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="table-row">
                  <td className="table-td">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-base shrink-0">🏦</div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{a.bank}</div>
                        <div className="text-xs text-slate-400">{a.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="table-td text-sm text-slate-600 dark:text-slate-300">{a.type}</td>
                  <td className="table-td text-sm text-slate-500 dark:text-slate-400 font-mono tracking-wider">{a.number}</td>
                  <td className="table-td text-sm font-bold text-slate-800 dark:text-slate-200">{money(a.balance)}</td>
                  <td className="table-td">
                    <button
                      onClick={() => { if (confirm(`Delete "${a.bank} – ${a.name}"?`)) deleteMutation.mutate(a.id) }}
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
      <Modal open={open} onClose={() => { setOpen(false); reset() }} title="Add bank account">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Bank name</label>
            <input {...register('bank')} className="input" placeholder="Emirates NBD" />
            {errors.bank && <p className="text-xs text-red-500 mt-1">{errors.bank.message}</p>}
          </div>
          <div>
            <label className="label">Account name</label>
            <input {...register('name')} className="input" placeholder="Current Account" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Account type</label>
              <select {...register('type')} className="input">
                <option>Savings</option>
                <option>Current</option>
                <option>Business</option>
                <option>Salary</option>
              </select>
            </div>
            <div>
              <label className="label">Last 4 digits</label>
              <input {...register('number')} className="input" placeholder="4821" maxLength={4} />
              {errors.number && <p className="text-xs text-red-500 mt-1">{errors.number.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Current balance ({country === 'UAE' ? 'AED' : 'INR'})</label>
            <input {...register('balance')} type="number" className="input" min="0" step="0.01" />
            {errors.balance && <p className="text-xs text-red-500 mt-1">{errors.balance.message}</p>}
          </div>
          {addMutation.isError && (
            <p className="text-xs text-red-500 break-all">
              Error: {(addMutation.error as Error)?.message ?? 'Unknown error'}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset() }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
