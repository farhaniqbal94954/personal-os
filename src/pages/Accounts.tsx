import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import PageHeader from '../components/PageHeader'
import { Empty, Kpi, chartTooltip, usePage } from '../components/ui'
import { accBalance, balanceNow, bankTotal, bankTotalAt } from '../lib/finance'
import { accountForm, deleteAccount, reconcileForm, txnForm } from '../lib/forms'
import { cents, formatDate, monthAdd, monthEnd, monthShort, moneyShort, thisMonth, today, WS } from '../lib/formatters'

export default function Accounts() {
  const { d, db, ws, money } = usePage()
  const nav = useNavigate()
  const [search, setSearch] = useState('')
  const [showArch, setShowArch] = useState(false)
  const all = d.accounts.filter((a) => a.country === ws)
  const active = all.filter((a) => !a.archived)
  const list = (showArch ? all : active).filter((a) => `${a.bank} ${a.name} ${a.type}`.toLowerCase().includes(search.toLowerCase()))
  const total = bankTotal(d, ws)
  const cards = active.filter((a) => a.type === 'Credit card')
  const owed = -cards.reduce((s, a) => s + Math.min(0, balanceNow(d, a)), 0)
  const mk = thisMonth()
  const monthMove = (id: string, from: string) => d.transactions.filter((t) => t.date.startsWith(mk) && t.date >= from && (t.account_id === id || t.to_account_id === id))
    .reduce((s, t) => s + (t.account_id === id ? (t.type === 'Income' || t.type === 'Adjustment' ? cents(t.amount) : -cents(t.amount)) : cents(t.to_amount ?? t.amount)), 0) / 100
  const firstStart = all.map((a) => a.opening_date).sort()[0] || today()
  const trend = Array.from({ length: 12 }, (_, i) => monthAdd(mk, i - 11)).filter((m) => m >= firstStart.slice(0, 7))
    .map((m) => ({ month: monthShort(m) + ' ' + m.slice(2, 4), Balance: bankTotalAt(d, ws, m === mk ? today() : monthEnd(m)) ?? 0 }))

  return (
    <div>
      <PageHeader title="Bank Accounts" subtitle="Balances are calculated from your transactions — always consistent."
        action={<div className="flex gap-2"><button className="btn" onClick={() => { const a = active; txnForm(d, db, ws, undefined, { type: 'Transfer', account_id: a[0]?.id, to_account_id: a[1]?.id }) }}>⇄ Transfer</button><button className="btn-primary" onClick={() => accountForm(d, db, ws)}>+ Add account</button></div>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total balance" value={money(total)} foot="All accounts, net of credit cards" icon="💰" />
        <Kpi label="Accounts" value={String(active.length)} foot={`Across ${new Set(active.map((a) => a.bank)).size} bank(s)`} icon="🏦" />
        <Kpi label="Card outstanding" value={money(owed)} foot={cards.length ? `${cards.length} card(s)` : 'No credit cards'} tone={owed ? 'neg' : undefined} icon="💳" />
        <Kpi label="Currency" value={WS[ws].cur} foot="No conversion inside a workspace" icon="💱" />
      </div>

      <div className="card mb-5">
        <div className="px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold flex-1">My bank accounts</h3>
          <label className="text-xs text-slate-500 flex items-center gap-1.5"><input type="checkbox" checked={showArch} onChange={(e) => setShowArch(e.target.checked)} /> Show archived</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="input sm:max-w-xs text-sm" placeholder="Search accounts…" />
        </div>
        <div className="md:hidden">
          {list.length === 0 ? <Empty action={<button className="btn-primary btn-sm" onClick={() => accountForm(d, db, ws)}>+ Add account</button>}>{search ? 'No accounts match.' : 'No accounts yet in this workspace.'}</Empty> : list.map((a) => {
            const b = accBalance(d, a) ?? 0; const mv = monthMove(a.id, a.opening_date)
            return (
              <div key={a.id} className={`m-row ${a.archived ? 'opacity-50' : ''}`} data-testid="acc-card">
                <div className="flex justify-between gap-3">
                  <div className="min-w-0"><div className="font-semibold truncate">{a.bank}</div><div className="text-xs text-slate-400 truncate">{a.name} · {a.type}{a.last4 ? ' · ••' + a.last4 : ''}{a.archived ? ' · archived' : ''}</div></div>
                  <div className="text-right shrink-0"><div className={`font-black ${b < 0 ? 'text-red-500' : ''}`}>{money(b)}</div>{mv ? <div className={`text-xs ${mv > 0 ? 'text-income' : 'text-expense'}`}>{mv > 0 ? '+' : ''}{money(mv)} this month</div> : null}</div>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">Start {formatDate(a.opening_date)} · {money(a.opening_balance)} · checked {a.last_reconciled ? formatDate(a.last_reconciled) : 'never'}</div>
                <div className="m-actions"><button className="!text-indigo-600" onClick={() => reconcileForm(d, db, a)}>Reconcile</button><button onClick={() => nav(`/transactions?account=${a.id}`)}>History</button><button onClick={() => accountForm(d, db, ws, a)}>Edit</button><button className="!text-red-500" onClick={() => deleteAccount(d, db, a)}>Delete</button></div>
              </div>)
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead><tr>{['Account', 'Type', 'Number', 'Start', 'Starting bal.', 'This month', 'Current balance', 'Checked', ''].map((h, i) => <th key={i} className={`table-th ${i >= 4 && i <= 6 ? 'text-right' : ''} ${i === 1 || i === 2 ? 'hidden 2xl:table-cell' : ''}`}>{h}</th>)}</tr></thead>
            <tbody>
              {list.length === 0 ? <tr><td colSpan={9}><Empty action={<button className="btn-primary btn-sm" onClick={() => accountForm(d, db, ws)}>+ Add account</button>}>{search ? 'No accounts match.' : 'No accounts yet in this workspace.'}</Empty></td></tr> : list.map((a) => {
                const b = accBalance(d, a) ?? 0; const mv = monthMove(a.id, a.opening_date)
                return (
                  <tr key={a.id} className={`table-row ${a.archived ? 'opacity-50' : ''}`} data-testid="acc-row">
                    <td className="table-td"><div className="font-semibold">{a.bank}</div><div className="text-xs text-slate-400">{a.name}<span className="2xl:hidden"> · {a.type}{a.last4 ? ' · ••' + a.last4 : ''}</span>{a.archived ? ' · archived' : ''}</div></td>
                    <td className="table-td text-slate-600 dark:text-slate-300 hidden 2xl:table-cell">{a.type}</td>
                    <td className="table-td font-mono text-slate-400 hidden 2xl:table-cell">{a.last4 ? '•••• ' + a.last4 : '—'}</td>
                    <td className="table-td text-xs text-slate-400 whitespace-nowrap">{formatDate(a.opening_date)}</td>
                    <td className="table-td text-right">{money(a.opening_balance)}</td>
                    <td className={`table-td text-right ${mv > 0 ? 'text-income' : mv < 0 ? 'text-expense' : 'text-slate-400'}`}>{mv ? (mv > 0 ? '+' : '') + money(mv) : '—'}</td>
                    <td className={`table-td text-right font-black ${b < 0 ? 'text-red-500' : ''}`} data-testid="acc-balance">{money(b)}</td>
                    <td className="table-td text-xs whitespace-nowrap">{a.last_reconciled ? formatDate(a.last_reconciled) : <span className="text-slate-400">never</span>}</td>
                    <td className="table-td text-right whitespace-nowrap text-xs">
                      <button className="text-indigo-600 font-semibold mr-3" onClick={() => reconcileForm(d, db, a)}>Reconcile</button>
                      <button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => nav(`/transactions?account=${a.id}`)}>History</button>
                      <button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => accountForm(d, db, ws, a)}>Edit</button>
                      <button className="text-slate-400 hover:text-red-500" onClick={() => deleteAccount(d, db, a)}>Delete</button>
                    </td>
                  </tr>)
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5 mb-4">
        <h3 className="text-sm font-bold mb-4">Total bank balance at month-end</h3>
        {trend.length < 2 ? <Empty>The trend appears after your first month of tracking.</Empty> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => moneyShort(v, ws)} />
              <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
              <Line isAnimationActive={false} type="monotone" dataKey="Balance" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>)}
      </div>
      <div className="text-xs font-semibold px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300">
        How balances work: <b>Current balance = Starting balance + income − expenses ± transfers ± adjustments</b> (only transactions on/after the start date). If it doesn't match your bank app, click <b>Reconcile</b> and type the real figure.
      </div>
    </div>
  )
}
