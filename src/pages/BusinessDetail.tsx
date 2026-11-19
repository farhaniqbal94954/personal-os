import { Link, useNavigate, useParams } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { CardHead, DueBadge, Empty, Kpi, TxnTable, chartTooltip, usePage } from '../components/ui'
import { bizStats, sortTx } from '../lib/finance'
import { businessForm, collectForm, contractForm, deleteBusiness, invoiceForm, manualEntryForm, txnForm } from '../lib/forms'
import { daysUntil, formatDate, monthAdd, monthShort, moneyShort, pct, sum, thisMonth } from '../lib/formatters'
import { toast } from '../store/useAppStore'
import type { BusinessItem } from '../types/database'

export default function BusinessDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { d, db, ws, money } = usePage()
  const b = d.businesses.find((x) => x.id === id)
  if (!b) return <div className="card p-8 text-center"><p className="mb-3">Business not found.</p><Link to="/business" className="btn">← Back</Link></div>
  const s = bizStats(d, b)
  const invs = s.items.filter((i) => i.category === 'Invoice').sort((a, c) => Number(a.status === 'Paid') - Number(c.status === 'Paid') || (a.due_date || '').localeCompare(c.due_date || ''))
  const ctrs = s.items.filter((i) => i.category === 'Contract')
  const manual = [...s.manualRev.filter((i) => i.category === 'Revenue'), ...s.manualExp].sort((a, c) => c.date.localeCompare(a.date))
  const chart = Array.from({ length: 6 }, (_, i) => monthAdd(thisMonth(), i - 5)).map((mk) => ({
    month: monthShort(mk),
    Revenue: sum(s.tx.filter((t) => t.type === 'Income' && t.date.startsWith(mk)), (t) => t.amount) + sum(s.manualRev.filter((i) => (i.paid_on || i.date).startsWith(mk)), (i) => i.value),
    Expenses: sum(s.tx.filter((t) => t.type === 'Expense' && t.date.startsWith(mk)), (t) => t.amount) + sum(s.manualExp.filter((i) => i.date.startsWith(mk)), (i) => i.value),
  }))
  const delItem = async (it: BusinessItem) => {
    if (!confirm(`Delete this ${it.category.toLowerCase()}?${it.txn_id ? ' The linked bank receipt stays.' : ''}`)) return
    await db.remove('business_items', it.id); toast('Deleted')
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3"><Link to="/business" className="btn btn-sm">← All</Link>
          <div><h1 className="text-2xl font-black">{b.name}</h1><p className="text-xs text-slate-400">{b.type}{b.licence ? ` · Licence ${b.licence}` : ''}{b.licence_expiry ? ` · expires ${formatDate(b.licence_expiry)}` : ''}</p></div></div>
        <div className="flex gap-2"><button className="btn" onClick={() => businessForm(db, ws, b)}>Edit</button><button className="btn-danger" onClick={async () => { if (await deleteBusiness(db, b)) nav('/business') }}>Delete</button></div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <Kpi label="Revenue (all time)" value={money(s.rev)} foot={`YTD ${money(s.ytdR)}`} tone="pos" />
        <Kpi label="Expenses (all time)" value={money(s.exp)} foot={`YTD ${money(s.ytdE)}`} tone="neg" />
        <Kpi label="Profit" value={money(s.rev - s.exp)} foot={s.rev ? `Margin ${pct(s.rev - s.exp, s.rev)}%` : ''} tone={s.rev - s.exp >= 0 ? 'pos' : 'neg'} />
        <Kpi label="Receivables" value={money(s.recv)} foot={`${invs.filter((i) => i.status !== 'Paid').length} unpaid invoices`} />
        <Kpi label="Contract value / yr" value={money(s.annual)} foot={`${s.contracts.length} active`} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-5">
        <div className="card p-5 xl:col-span-3">
          <CardHead title="Revenue vs expenses"><button className="btn btn-sm" onClick={() => txnForm(d, db, ws, undefined, { type: 'Income', business_id: b.id, category: 'Business income' })}>+ Income</button><button className="btn btn-sm" onClick={() => txnForm(d, db, ws, undefined, { type: 'Expense', business_id: b.id, category: 'Business expense' })}>+ Expense</button><button className="btn btn-sm" onClick={() => manualEntryForm(db, b)}>+ Manual entry</button></CardHead>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chart} barGap={3} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => moneyShort(v, ws)} />
              <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar isAnimationActive={false} dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} /><Bar isAnimationActive={false} dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5 xl:col-span-2">
          <CardHead title="Contracts / AMC"><button className="btn-primary btn-sm" onClick={() => contractForm(db, b)}>+ Contract</button></CardHead>
          {ctrs.length === 0 ? <Empty>No contracts yet.</Empty> : ctrs.map((c) => (
            <div key={c.id} className="flex justify-between gap-2 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <div className="min-w-0"><div className="text-sm font-semibold">{c.client || c.label} <span className={c.status === 'Active' ? 'badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'badge-slate'}>{c.status}</span></div>
                <div className="text-xs text-slate-400">{c.label} · {c.freq} {money(c.value)} · next {formatDate(c.next_due)}{c.end_date ? ` · ends ${formatDate(c.end_date)}` : ''}</div></div>
              <div className="flex items-center gap-2 text-xs shrink-0">{c.status === 'Active' && <button className="btn btn-sm" onClick={() => collectForm(d, db, c)}>Collect</button>}<button className="text-slate-400 hover:text-indigo-600" onClick={() => contractForm(db, b, c)}>Edit</button><button className="text-slate-400 hover:text-red-500" onClick={() => delItem(c)}>✕</button></div>
            </div>))}
        </div>
      </div>
      <div className="card mb-5">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between"><h3 className="text-sm font-bold">Invoices</h3><button className="btn-primary btn-sm" onClick={() => invoiceForm(db, b)}>+ Invoice</button></div>
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr>{['No.', 'Client', 'Issued', 'Due', 'Amount', 'Status', ''].map((h, i) => <th key={i} className={`table-th ${i === 4 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>{invs.length === 0 ? <tr><td colSpan={7}><Empty>No invoices.</Empty></td></tr> : invs.map((i) => (
            <tr key={i.id} className="table-row">
              <td className="table-td">{i.number || '—'}</td>
              <td className="table-td"><div className="font-semibold">{i.client || i.label}</div><div className="text-xs text-slate-400">{i.client ? i.label : ''}</div></td>
              <td className="table-td">{formatDate(i.date)}</td><td className="table-td">{formatDate(i.due_date)}</td>
              <td className="table-td text-right font-bold">{money(i.value)}</td>
              <td className="table-td">{i.status === 'Paid' ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Paid {formatDate(i.paid_on)}</span> : i.due_date && daysUntil(i.due_date) < 0 ? <span className="badge-red">Overdue</span> : i.due_date ? <DueBadge date={i.due_date} /> : <span className="badge-amber">Unpaid</span>}</td>
              <td className="table-td text-right text-xs whitespace-nowrap">{i.status !== 'Paid' && <button className="btn-primary btn-sm mr-2" onClick={() => collectForm(d, db, i)}>Mark paid</button>}<button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => invoiceForm(db, b, i)}>Edit</button><button className="text-slate-400 hover:text-red-500" onClick={() => delItem(i)}>Delete</button></td>
            </tr>))}</tbody>
        </table></div>
      </div>
      {manual.length > 0 && <div className="card mb-5 p-5"><h3 className="text-sm font-bold mb-2">Manual entries <span className="text-xs font-normal text-slate-400">(not linked to a bank account)</span></h3>{manual.map((i) => (
        <div key={i.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 text-sm">
          <span>{formatDate(i.date)} · {i.label}</span>
          <span className="flex items-center gap-3"><b className={i.category === 'Revenue' ? 'text-emerald-600' : 'text-red-500'}>{i.category === 'Revenue' ? '+' : '−'}{money(i.value)}</b><button className="text-xs text-slate-400 hover:text-indigo-600" onClick={() => manualEntryForm(db, b, i)}>Edit</button><button className="text-xs text-slate-400 hover:text-red-500" onClick={() => delItem(i)}>Delete</button></span>
        </div>))}</div>}
      <div className="card"><div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700"><h3 className="text-sm font-bold">Bank transactions for this business</h3></div>
        <TxnTable list={s.tx.sort(sortTx)} empty="Tag income/expenses with this business, or use Collect / Mark paid." /></div>
    </div>
  )
}
