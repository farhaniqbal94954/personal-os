import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useData, useDb } from '../lib/data'
import { useAppStore } from '../store/useAppStore'
import { daysUntil, formatDate, formatMoney, fmtNum, WS } from '../lib/formatters'
import type { AppData, Transaction } from '../types/database'
import { accLabel, beforeStart, txnCurrencyCountry, txnSigned } from '../lib/finance'
import { deleteTxn, txnForm } from '../lib/forms'

/** data is guaranteed loaded inside Layout */
export function usePage() {
  const { data } = useData()
  const db = useDb()
  const ws = useAppStore((s) => s.country)
  return { d: data as AppData, db, ws, money: (n: number) => formatMoney(n, ws) }
}

/** Shrinks its text until it fits the box — numbers are never cut off with "…" */
export function FitText({ children, max = 26, min = 13, className = '', title }: { children: ReactNode; max?: number; min?: number; className?: string; title?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const fit = () => {
      let size = max; el.style.fontSize = size + 'px'; el.style.whiteSpace = 'nowrap'
      while (el.scrollWidth > el.clientWidth + 0.5 && size > min) { size -= 0.5; el.style.fontSize = size + 'px' }
      if (el.scrollWidth > el.clientWidth + 0.5) el.style.whiteSpace = 'normal' // long names wrap instead of being cut
    }
    fit()
    const ro = new ResizeObserver(fit); ro.observe(el)
    return () => ro.disconnect()
  }, [children, max, min])
  return <div ref={ref} title={title} className={`whitespace-nowrap overflow-hidden ${className}`}>{children}</div>
}

/** "−INR 46,88,146.50" → small grey currency code + big number */
export function MoneyText({ value }: { value: ReactNode }) {
  if (typeof value !== 'string') return <>{value}</>
  const m = value.match(/^([+−-]?)([A-Z]{3}) (.+)$/)
  if (!m) return <>{value}</>
  return <>{m[1]}<span className="text-[0.58em] font-bold opacity-55 mr-[0.25em] align-[0.12em]">{m[2]}</span>{m[3]}</>
}

export function Kpi({ label, value, foot, tone, icon }: { label: string; value: ReactNode; foot?: ReactNode; tone?: 'pos' | 'neg' | 'warn'; icon?: string }) {
  const c = tone === 'pos' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'neg' ? 'text-red-500 dark:text-red-400' : tone === 'warn' ? 'text-amber-500' : 'text-slate-900 dark:text-white'
  const isMoney = typeof value === 'string' && /^[+−-]?[A-Z]{3} /.test(value)
  return (
    <div className="card p-4 2xl:p-5 min-w-0 h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] 2xl:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider leading-tight">{label}</span>
        {icon && <span className="hidden 2xl:flex w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 items-center justify-center text-sm shrink-0">{icon}</span>}
      </div>
      <FitText max={isMoney ? 24 : 22} min={isMoney ? 13 : 14} title={typeof value === 'string' ? value : undefined}
        className={`font-black tracking-tight leading-tight mb-1 tabular-nums ${c}`}>
        <span data-testid={`kpi-${label}`}><MoneyText value={value} /></span>
      </FitText>
      <div className="text-[11px] 2xl:text-xs font-semibold text-slate-400 dark:text-slate-500 mt-auto leading-snug">{foot}</div>
    </div>
  )
}

export function Progress({ value, max, neutral }: { value: number; max: number; neutral?: boolean }) {
  const p = max ? (value / max) * 100 : 0
  const c = neutral ? 'bg-indigo-500' : p > 100 ? 'bg-red-500' : p >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  return <div className="progress-track"><div className={`h-full rounded-full transition-all ${c}`} style={{ width: `${Math.min(100, Math.max(0, p))}%` }} /></div>
}

export function DueBadge({ date }: { date: string }) {
  const n = daysUntil(date)
  if (n < 0) return <span className="badge-red">{-n}d overdue</span>
  if (n === 0) return <span className="badge-red">Today</span>
  if (n === 1) return <span className="badge-amber">Tomorrow</span>
  if (n <= 7) return <span className="badge-amber">{n} days</span>
  return <span className="badge-blue">{formatDate(date)}</span>
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className="text-center py-10 px-4 text-sm text-slate-400 dark:text-slate-500">{children}{action && <div className="mt-3">{action}</div>}</div>
}

export function CardHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>{children && <div className="flex flex-wrap items-center gap-2">{children}</div>}</div>
}

export function Amount({ d, t, ws }: { d: AppData; t: Transaction; ws: string }) {
  const v = txnSigned(d, t, ws as 'UAE')
  const cc = txnCurrencyCountry(d, t, ws as 'UAE')
  const cls = v > 0 ? 'text-income' : v < 0 ? 'text-expense' : 'text-slate-500'
  return <span className={`text-sm font-bold whitespace-nowrap ${cls}`}>{v > 0 ? '+' : v < 0 ? '−' : '⇄ '}{WS[cc].cur} {fmtNum(v || t.amount, cc)}</span>
}

export function TxnTable({ list, empty }: { list: Transaction[]; empty?: ReactNode }) {
  const { d, db, ws } = usePage()
  const hold = (id: string | null) => d.holdings.find((h) => h.id === id)?.name || 'Investment'
  const accText = (t: Transaction) => t.type === 'Transfer' ? `${t.account_id ? accLabel(d, t.account_id) : hold(t.holding_id)} → ${t.to_account_id ? accLabel(d, t.to_account_id) : hold(t.holding_id)}` : accLabel(d, t.account_id)
  return (
    <>
    {/* phones: stacked cards */}
    <div className="md:hidden" data-testid="txn-cards">
      {list.length === 0 ? <Empty>{empty || 'No transactions.'}</Empty> : list.map((t) => {
        const proj = d.projects.find((p) => p.id === t.project_id); const biz = d.businesses.find((b) => b.id === t.business_id)
        return (
          <div key={t.id} className="m-row" data-testid="txn-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.description || t.category || t.type}</div>
                <div className="text-xs text-slate-400 mt-0.5">{formatDate(t.date)} · {t.type === 'Transfer' ? 'Transfer' : t.type === 'Adjustment' ? 'Adjustment' : t.category}</div>
                <div className="text-[11px] text-slate-400 truncate">{accText(t)}</div>
              </div>
              <div className="text-right shrink-0"><Amount d={d} t={t} ws={ws} /></div>
            </div>
            {(proj || biz || beforeStart(d, t)) && <div className="flex flex-wrap gap-1 mt-1.5">
              {proj && <span className="badge-slate">📋 {proj.name}</span>}
              {biz && <span className="badge-slate">🏢 {biz.name}</span>}
              {beforeStart(d, t) && <span className="badge-amber">not in balance</span>}
            </div>}
            <div className="m-actions"><button onClick={() => txnForm(d, db, ws, t)}>✏️ Edit</button><button className="!text-red-500" onClick={() => deleteTxn(d, db, t)}>🗑 Delete</button></div>
          </div>)
      })}
    </div>
    {/* tablets & desktop: table */}
    <div className="hidden md:block overflow-x-auto">
      <table className="w-full">
        <thead><tr><th className="table-th">Date</th><th className="table-th">Description</th><th className="table-th">Category</th><th className="table-th">Account</th><th className="table-th text-right">Amount</th><th className="table-th"></th></tr></thead>
        <tbody>
          {list.length === 0 ? <tr><td colSpan={6}><Empty>{empty || 'No transactions.'}</Empty></td></tr> : list.map((t) => {
            const proj = d.projects.find((p) => p.id === t.project_id); const biz = d.businesses.find((b) => b.id === t.business_id)
            return (
              <tr key={t.id} className="table-row" data-testid="txn-row">
                <td className="table-td whitespace-nowrap text-slate-500 dark:text-slate-400">{formatDate(t.date)}</td>
                <td className="table-td">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">{t.description || '—'}</div>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {proj && <span className="badge-slate">📋 {proj.name}</span>}
                    {biz && <span className="badge-slate">🏢 {biz.name}</span>}
                    {beforeStart(d, t) && <span className="badge-amber" title="Dated before the account's start date — history only, not counted in the balance">not in balance</span>}
                  </div>
                </td>
                <td className="table-td text-slate-500 dark:text-slate-400">{t.type === 'Transfer' ? <span className="badge-indigo">Transfer</span> : t.type === 'Adjustment' ? <span className="badge-amber">Adjustment</span> : t.category}</td>
                <td className="table-td text-xs text-slate-500 dark:text-slate-400">{accText(t)}</td>
                <td className="table-td text-right"><Amount d={d} t={t} ws={ws} /></td>
                <td className="table-td text-right whitespace-nowrap">
                  <button className="text-xs text-slate-400 hover:text-indigo-600 mr-3" onClick={() => txnForm(d, db, ws, t)}>Edit</button>
                  <button className="text-xs text-slate-400 hover:text-red-500" onClick={() => deleteTxn(d, db, t)}>Delete</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
    </>
  )
}

export const chartTooltip = { contentStyle: { background: '#1e293b', border: 'none', borderRadius: 10, color: '#f1f5f9', fontSize: 12, padding: '8px 12px' }, cursor: { fill: 'rgba(99,102,241,0.06)' } }
export const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#64748b', '#ec4899', '#84cc16']
