import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney, formatDate } from '../lib/formatters'
import KpiCard from '../components/KpiCard'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Business, BusinessItem } from '../types/database'

const schema = z.object({
  label:    z.string().min(1, 'Label required'),
  value:    z.coerce.number().min(0),
  category: z.enum(['Revenue', 'Expense', 'Contract', 'Invoice', 'Other']),
  date:     z.string().min(1, 'Date required'),
  notes:    z.string().optional(),
})
type ItemForm = z.infer<typeof schema>

const CAT_BADGE: Record<string, string> = {
  Revenue:  'badge-blue',
  Expense:  'badge-red',
  Contract: 'badge-indigo',
  Invoice:  'badge-amber',
  Other:    'badge-slate',
}

export default function BusinessDetail() {
  const { id } = useParams<{ id: string }>()
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [catFilter, setCatFilter] = useState<string>('all')
  const money = (n: number) => formatMoney(n, country)
  const today = new Date().toISOString().split('T')[0]

  const { data: business, isLoading: bizLoading } = useQuery<Business>({
    queryKey: ['business', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery<BusinessItem[]>({
    queryKey: ['business_items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_items').select('*').eq('business_id', id).order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!id,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ItemForm>({
    resolver: zodResolver(schema),
    defaultValues: { category: 'Revenue', date: today },
  })

  const addMutation = useMutation({
    mutationFn: async (form: ItemForm) => {
      const { error } = await supabase.from('business_items').insert({
        business_id: id, ...form, notes: form.notes ?? '',
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business_items', id] }); reset({ category: 'Revenue', date: today }); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from('business_items').delete().eq('id', itemId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business_items', id] }),
  })

  // KPI aggregates
  const totalRevenue  = items.filter(i => i.category === 'Revenue' || i.category === 'Invoice').reduce((s, i) => s + i.value, 0)
  const totalExpense  = items.filter(i => i.category === 'Expense').reduce((s, i) => s + i.value, 0)
  const totalContracts= items.filter(i => i.category === 'Contract').reduce((s, i) => s + i.value, 0)
  const net           = totalRevenue - totalExpense

  const filteredItems = catFilter === 'all' ? items : items.filter(i => i.category === catFilter)

  if (bizLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-7 h-7 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!business) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
        <span className="text-4xl">❓</span>
        <p className="text-sm font-semibold text-slate-500">Business not found.</p>
        <Link to="/business" className="btn-primary btn-sm">← Back to Business Hub</Link>
      </div>
    )
  }

  return (
    <div>
      {/* Back link */}
      <Link to="/business" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-5">
        ← Business Hub
      </Link>

      <PageHeader
        title={business.name}
        subtitle={`${business.type}${business.description ? ' · ' + business.description : ''}`}
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add item</button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Total revenue"   value={money(totalRevenue)}   footColor="income"  foot="Revenue + invoices" icon="💰" />
        <KpiCard label="Total expenses"  value={money(totalExpense)}   footColor="expense" foot="All expenses" icon="📤" />
        <KpiCard label="Net"             value={money(Math.abs(net))} footColor={net >= 0 ? 'income' : 'expense'} foot={net >= 0 ? '↑ Positive' : '↓ Negative'} icon={net >= 0 ? '📈' : '📉'} />
        <KpiCard label="Contracts"       value={money(totalContracts)} foot={`${items.filter(i => i.category === 'Contract').length} records`} icon="📄" />
      </div>

      {/* Items table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex-1">Records</h3>
          <span className="badge badge-slate">{items.length} items</span>
          {/* Category filter pills */}
          {['all','Revenue','Expense','Contract','Invoice','Other'].map(c => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                catFilter === c
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >{c === 'all' ? 'All' : c}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Label</th>
                <th className="table-th">Category</th>
                <th className="table-th">Date</th>
                <th className="table-th">Notes</th>
                <th className="table-th text-right">Value</th>
                <th className="table-th w-16"></th>
              </tr>
            </thead>
            <tbody>
              {itemsLoading ? (
                <tr><td colSpan={6} className="table-td text-center py-10 text-slate-400 text-sm">Loading…</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400 text-sm">
                  {items.length === 0 ? 'No records yet. Add your first item.' : 'No items in this category.'}
                </td></tr>
              ) : filteredItems.map(item => (
                <tr key={item.id} className="table-row">
                  <td className="table-td text-sm font-semibold text-slate-800 dark:text-slate-200">{item.label}</td>
                  <td className="table-td"><span className={`badge ${CAT_BADGE[item.category] ?? 'badge-slate'}`}>{item.category}</span></td>
                  <td className="table-td text-sm text-slate-500 dark:text-slate-400">{formatDate(item.date)}</td>
                  <td className="table-td text-sm text-slate-400 dark:text-slate-500 max-w-[180px] truncate">{item.notes || '—'}</td>
                  <td className="table-td text-right">
                    <span className={`text-sm font-bold ${item.category === 'Expense' ? 'text-expense' : 'text-income'}`}>
                      {item.category === 'Expense' ? '−' : '+'}{money(item.value)}
                    </span>
                  </td>
                  <td className="table-td">
                    <button
                      onClick={() => { if (confirm('Delete this record?')) deleteMutation.mutate(item.id) }}
                      className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add item modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset({ category: 'Revenue', date: today }) }} title={`Add record — ${business.name}`} wide>
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Label</label>
            <input {...register('label')} className="input" placeholder="AMC contract — Client A" autoFocus />
            {errors.label && <p className="text-xs text-red-500 mt-1">{errors.label.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category</label>
              <select {...register('category')} className="input">
                <option>Revenue</option>
                <option>Expense</option>
                <option>Contract</option>
                <option>Invoice</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Date</label>
              <input {...register('date')} type="date" className="input" />
              {errors.date && <p className="text-xs text-red-500 mt-1">{errors.date.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Value ({country === 'UAE' ? 'AED' : 'INR'})</label>
            <input {...register('value')} type="number" className="input" min="0" step="0.01" />
            {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value.message}</p>}
          </div>
          <div>
            <label className="label">Notes (optional)</label>
            <input {...register('notes')} className="input" placeholder="Additional details…" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset({ category: 'Revenue', date: today }) }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
