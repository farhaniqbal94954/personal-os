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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { Holding } from '../types/database'

const holdingSchema = z.object({
  name:          z.string().min(1, 'Name required'),
  type:          z.enum(['Stocks', 'Mutual fund', 'Gold', 'Deposit', 'ETF', 'Crypto', 'Other']),
  invested:      z.coerce.number().min(0),
  current_value: z.coerce.number().min(0),
})
type HoldingForm = z.infer<typeof holdingSchema>

const HOLDING_TYPES = ['Stocks','Mutual fund','Gold','Deposit','ETF','Crypto','Other'] as const

type ModalMode = 'add' | 'edit' | 'withdraw' | null

export default function Investments() {
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [activeHolding, setActiveHolding] = useState<Holding | null>(null)
  const [editValue, setEditValue] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawError, setWithdrawError] = useState('')
  const money = (n: number) => formatMoney(n, country)

  const { data: holdings = [], isLoading } = useQuery<Holding[]>({
    queryKey: ['holdings', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('holdings').select('*').eq('country', country).order('name')
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<HoldingForm>({
    resolver: zodResolver(holdingSchema),
    defaultValues: { type: 'Stocks', invested: 0, current_value: 0 },
  })

  const addHolding = useMutation({
    mutationFn: async (form: HoldingForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('holdings').insert({ user_id: session.user.id, country, ...form })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); reset(); setModalMode(null) },
  })

  const deleteHolding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holdings').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holdings'] }),
  })

  // Update current value
  const updateValue = useMutation({
    mutationFn: async ({ id, current_value }: { id: string; current_value: number }) => {
      const { error } = await supabase.from('holdings').update({ current_value }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); setModalMode(null); setActiveHolding(null) },
  })

  // Withdraw — reduces invested & current_value. If withdrawing all, deletes the holding.
  const withdrawMutation = useMutation({
    mutationFn: async ({ holding, amount }: { holding: Holding; amount: number }) => {
      if (amount >= holding.current_value) {
        // Full withdrawal — delete
        const { error } = await supabase.from('holdings').delete().eq('id', holding.id)
        if (error) throw error
      } else {
        // Partial — reduce proportionally
        const ratio = amount / holding.current_value
        const investedReduction = holding.invested * ratio
        const { error } = await supabase.from('holdings').update({
          invested: Math.max(0, holding.invested - investedReduction),
          current_value: holding.current_value - amount,
        }).eq('id', holding.id)
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holdings'] }); setModalMode(null); setActiveHolding(null); setWithdrawAmount('') },
  })

  function openEdit(h: Holding) {
    setActiveHolding(h)
    setEditValue(String(h.current_value))
    setModalMode('edit')
  }

  function openWithdraw(h: Holding) {
    setActiveHolding(h)
    setWithdrawAmount('')
    setWithdrawError('')
    setModalMode('withdraw')
  }

  function handleWithdraw() {
    if (!activeHolding) return
    const amt = parseFloat(withdrawAmount)
    if (isNaN(amt) || amt <= 0) { setWithdrawError('Enter a valid amount'); return }
    if (amt > activeHolding.current_value) { setWithdrawError(`Maximum you can withdraw is ${money(activeHolding.current_value)}`); return }
    setWithdrawError('')
    const msg = amt >= activeHolding.current_value
      ? `Full withdrawal — this will remove "${activeHolding.name}" completely. Continue?`
      : `Withdraw ${money(amt)} from "${activeHolding.name}"?`
    if (confirm(msg)) {
      withdrawMutation.mutate({ holding: activeHolding, amount: amt })
    }
  }

  const totalInvested = holdings.reduce((s, h) => s + h.invested, 0)
  const totalValue    = holdings.reduce((s, h) => s + h.current_value, 0)
  const totalGain     = totalValue - totalInvested
  const gainPct       = totalInvested > 0 ? ((totalGain / totalInvested) * 100).toFixed(1) : '0.0'

  // Group by type for allocation
  const byType = HOLDING_TYPES.map(type => {
    const slice = holdings.filter(h => h.type === type)
    const val   = slice.reduce((s, h) => s + h.current_value, 0)
    const pct   = totalValue > 0 ? (val / totalValue) * 100 : 0
    return { type, val, pct }
  }).filter(x => x.val > 0)

  // Chart data
  const chartData = holdings.map(h => ({
    name: h.name.length > 16 ? h.name.slice(0, 14) + '…' : h.name,
    Value: h.current_value,
    Invested: h.invested,
  }))

  return (
    <div>
      <PageHeader
        title="Investments"
        subtitle="Portfolio holdings, allocation and performance."
        action={<button className="btn-primary" onClick={() => { reset(); setModalMode('add') }}>+ Add holding</button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Portfolio value"   value={money(totalValue)}    foot={`${holdings.length} holdings`} icon="📈" />
        <KpiCard label="Total invested"    value={money(totalInvested)} foot="Purchase cost" icon="💵" />
        <KpiCard label="Unrealised gain"   value={money(Math.abs(totalGain))} footColor={totalGain >= 0 ? 'income' : 'expense'}
                 foot={`${totalGain >= 0 ? '+' : '−'}${gainPct}% return`} icon={totalGain >= 0 ? '📈' : '📉'} />
        <KpiCard label="Asset classes"     value={String(byType.length)} foot="Types held" icon="🗂️" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
        {/* Allocation bars */}
        <div className="card p-5 xl:col-span-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Portfolio allocation</h3>
          {byType.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No holdings yet.</p>
          ) : byType.map(({ type, val, pct }) => (
            <div key={type} className="mb-4">
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                <span>{type}</span>
                <span>{pct.toFixed(1)}% · {money(val)}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Bar chart */}
        <div className="card p-5 xl:col-span-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Invested vs current value</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">Per holding comparison</p>
          {holdings.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">Add holdings to see chart.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={3} barSize={14}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 10, color: '#f1f5f9', fontSize: 12 }} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                <Bar dataKey="Invested" fill="#94a3b8" radius={[4,4,0,0]} />
                <Bar dataKey="Value"    fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Holdings table */}
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Investment holdings</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Investment</th>
                <th className="table-th">Type</th>
                <th className="table-th text-right">Invested</th>
                <th className="table-th text-right">Current value</th>
                <th className="table-th text-right">Return</th>
                <th className="table-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="table-td text-center py-10 text-slate-400 text-sm">Loading…</td></tr>
              ) : holdings.length === 0 ? (
                <tr><td colSpan={6} className="table-td text-center py-12 text-slate-400 text-sm">No holdings yet. Add your first investment.</td></tr>
              ) : holdings.map(h => {
                const gain = h.current_value - h.invested
                const gPct = h.invested > 0 ? ((gain / h.invested) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={h.id} className="table-row">
                    <td className="table-td text-sm font-semibold text-slate-800 dark:text-slate-200">{h.name}</td>
                    <td className="table-td"><span className="badge badge-indigo">{h.type}</span></td>
                    <td className="table-td text-sm text-slate-600 dark:text-slate-300 text-right">{money(h.invested)}</td>
                    <td className="table-td text-sm font-bold text-slate-800 dark:text-slate-200 text-right">{money(h.current_value)}</td>
                    <td className="table-td text-right">
                      <span className={`text-sm font-bold ${gain >= 0 ? 'text-income' : 'text-expense'}`}>
                        {gain >= 0 ? '+' : '−'}{money(Math.abs(gain))} ({gPct}%)
                      </span>
                    </td>
                    <td className="table-td text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(h)}
                          className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                        >Update</button>
                        <button
                          onClick={() => openWithdraw(h)}
                          className="text-xs font-semibold text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                        >Withdraw</button>
                        <button
                          onClick={() => { if (confirm('Delete this holding entirely?')) deleteHolding.mutate(h.id) }}
                          className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >Delete</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== ADD HOLDING MODAL ===== */}
      <Modal open={modalMode === 'add'} onClose={() => { setModalMode(null); reset() }} title="Add investment holding">
        <form onSubmit={handleSubmit(d => addHolding.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Investment name</label>
            <input {...register('name')} className="input" placeholder="UAE Equity Fund" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Type</label>
            <select {...register('type')} className="input">
              {HOLDING_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount invested ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input {...register('invested')} type="number" className="input" min="0" step="0.01" />
              {errors.invested && <p className="text-xs text-red-500 mt-1">{errors.invested.message}</p>}
            </div>
            <div>
              <label className="label">Current value ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input {...register('current_value')} type="number" className="input" min="0" step="0.01" />
              {errors.current_value && <p className="text-xs text-red-500 mt-1">{errors.current_value.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setModalMode(null); reset() }}>Cancel</button>
            <button type="submit" disabled={addHolding.isPending} className="btn-primary">
              {addHolding.isPending ? 'Saving…' : 'Save holding'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ===== UPDATE CURRENT VALUE MODAL ===== */}
      <Modal open={modalMode === 'edit'} onClose={() => { setModalMode(null); setActiveHolding(null) }} title="Update current value">
        {activeHolding && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{activeHolding.name}</div>
              <div className="text-xs text-slate-400 mt-1">Invested: {money(activeHolding.invested)} · Current: {money(activeHolding.current_value)}</div>
            </div>
            <div>
              <label className="label">New current value ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-slate-400 mt-1.5">
                Update to today's market value. Invested amount stays the same — only current value changes.
              </p>
            </div>
            {/* Preview */}
            {editValue && !isNaN(parseFloat(editValue)) && (
              <div className={`text-sm font-semibold px-3 py-2 rounded-lg ${
                parseFloat(editValue) >= activeHolding.invested
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                {parseFloat(editValue) >= activeHolding.invested ? '📈' : '📉'} Return: {
                  money(Math.abs(parseFloat(editValue) - activeHolding.invested))
                } ({activeHolding.invested > 0 ? (((parseFloat(editValue) - activeHolding.invested) / activeHolding.invested) * 100).toFixed(1) : '0.0'}%)
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn" onClick={() => { setModalMode(null); setActiveHolding(null) }}>Cancel</button>
              <button
                className="btn-primary"
                disabled={updateValue.isPending || !editValue || isNaN(parseFloat(editValue))}
                onClick={() => updateValue.mutate({ id: activeHolding.id, current_value: parseFloat(editValue) })}
              >
                {updateValue.isPending ? 'Saving…' : 'Update value'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== WITHDRAW MODAL ===== */}
      <Modal open={modalMode === 'withdraw'} onClose={() => { setModalMode(null); setActiveHolding(null); setWithdrawAmount(''); setWithdrawError('') }} title="Withdraw from investment">
        {activeHolding && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{activeHolding.name}</div>
              <div className="text-xs text-slate-400 mt-1">
                Current value: <strong className="text-slate-700 dark:text-slate-300">{money(activeHolding.current_value)}</strong>
              </div>
            </div>
            <div>
              <label className="label">Withdraw amount ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input
                type="number"
                className="input"
                min="0.01"
                step="0.01"
                max={activeHolding.current_value}
                value={withdrawAmount}
                onChange={e => { setWithdrawAmount(e.target.value); setWithdrawError('') }}
                placeholder={`Max ${money(activeHolding.current_value)}`}
                autoFocus
              />
              {withdrawError && <p className="text-xs text-red-500 mt-1">{withdrawError}</p>}
            </div>
            {/* Quick buttons */}
            <div className="flex gap-2">
              <button className="btn btn-sm text-xs" onClick={() => setWithdrawAmount(String(activeHolding.current_value * 0.25))}>25%</button>
              <button className="btn btn-sm text-xs" onClick={() => setWithdrawAmount(String(activeHolding.current_value * 0.5))}>50%</button>
              <button className="btn btn-sm text-xs" onClick={() => setWithdrawAmount(String(activeHolding.current_value * 0.75))}>75%</button>
              <button className="btn btn-sm text-xs" onClick={() => setWithdrawAmount(String(activeHolding.current_value))}>100% (Full)</button>
            </div>
            {/* Preview */}
            {withdrawAmount && !isNaN(parseFloat(withdrawAmount)) && parseFloat(withdrawAmount) > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm font-semibold px-3 py-2 rounded-lg">
                {parseFloat(withdrawAmount) >= activeHolding.current_value
                  ? `⚠️ Full withdrawal — "${activeHolding.name}" will be removed`
                  : `Remaining after withdrawal: ${money(activeHolding.current_value - parseFloat(withdrawAmount))}`
                }
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button className="btn" onClick={() => { setModalMode(null); setActiveHolding(null); setWithdrawAmount(''); setWithdrawError('') }}>Cancel</button>
              <button
                className="btn-primary"
                disabled={withdrawMutation.isPending}
                onClick={handleWithdraw}
              >
                {withdrawMutation.isPending ? 'Processing…' : 'Withdraw'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
