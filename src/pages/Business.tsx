import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { Empty, Kpi, usePage } from '../components/ui'
import { bizStats } from '../lib/finance'
import { businessForm } from '../lib/forms'
import { moneyShort, sum } from '../lib/formatters'

export default function Business() {
  const { d, db, ws, money } = usePage()
  const bs = d.businesses.filter((b) => b.country === ws)
  const st = bs.map((b) => bizStats(d, b))
  return (
    <div>
      <PageHeader title="Business Hub" subtitle="Revenue, expenses, invoices and AMC contracts per business." action={<button className="btn-primary" onClick={() => businessForm(db, ws)}>+ Add business</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Businesses" value={String(bs.length)} icon="🏢" />
        <Kpi label="Revenue (YTD)" value={money(sum(st, (s) => s.ytdR))} foot="This calendar year" tone="pos" />
        <Kpi label="Profit (YTD)" value={money(sum(st, (s) => s.ytdR - s.ytdE))} foot="Revenue − expenses" />
        <Kpi label="Receivables" value={money(sum(st, (s) => s.recv))} foot="Unpaid invoices" tone={sum(st, (s) => s.recv) ? 'warn' : undefined} />
      </div>
      {bs.length === 0 ? <div className="card"><Empty action={<button className="btn-primary btn-sm" onClick={() => businessForm(db, ws)}>+ Add business</button>}>Track each business: income, expenses, invoices and recurring contracts (AMC).</Empty></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bs.map((b, i) => { const s = st[i]; return (
            <Link key={b.id} to={`/business/${b.id}`} className="card p-5 hover:border-indigo-400 transition-colors block" data-testid="biz-card">
              <div className="flex justify-between mb-3"><h3 className="font-bold">🏢 {b.name}</h3><span className="badge-slate">{b.type}</span></div>
              {[['Revenue YTD', money(s.ytdR), 'text-emerald-600'], ['Expenses YTD', money(s.ytdE), 'text-red-500'], ['Receivables', money(s.recv), ''], ['Active contracts', `${s.contracts.length} · ${moneyShort(s.annual, ws)}/yr`, '']].map(([l, v, c]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 text-sm"><span className="text-slate-400 text-xs">{l}</span><b className={c}>{v}</b></div>))}
            </Link>) })}
        </div>)}
    </div>
  )
}
