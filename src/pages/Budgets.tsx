import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Empty, Kpi, Progress, usePage } from '../components/ui'
import { catTotals } from '../lib/finance'
import { budgetForm } from '../lib/forms'
import { monthAdd, monthLabel, pct, sum, thisMonth } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Budgets() {
  const { d, db, ws, money } = usePage()
  const [mk, setMk] = useState(thisMonth())
  const bs = d.budgets.filter((b) => b.country === ws)
  const cats = catTotals(d, ws, mk)
  const tl = sum(bs, (b) => b.monthly_limit), ts = sum(bs, (b) => cats[b.category] || 0)
  const unb = Object.entries(cats).filter(([c]) => !bs.find((b) => b.category === c))
  const now = mk === thisMonth(); const dim = new Date(+mk.slice(0, 4), +mk.slice(5), 0).getDate(); const dom = now ? new Date().getDate() : dim
  return (
    <div>
      <PageHeader title="Budgets" subtitle="Monthly limits per category — spending is tracked automatically from your expenses." action={<button className="btn-primary" onClick={() => budgetForm(d, db, ws)}>+ Add budget</button>} />
      <div className="flex flex-wrap gap-2 mb-5">{[-2, -1, 0].map((i) => { const x = monthAdd(thisMonth(), i); return <button key={x} onClick={() => setMk(x)} className={`btn btn-sm ${x === mk ? '!bg-indigo-50 !text-indigo-700 dark:!bg-indigo-900/30 dark:!text-indigo-300' : ''}`}>{monthLabel(x)}</button> })}</div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Budgeted" value={money(tl)} foot={`${bs.length} categories`} />
        <Kpi label="Spent (budgeted)" value={money(ts)} foot={`${pct(ts, tl)}% used`} tone={ts > tl ? 'neg' : undefined} />
        <Kpi label="Remaining" value={money(tl - ts)} foot={now ? `${dim - dom} days left · ${money(Math.max(0, (tl - ts) / Math.max(1, dim - dom + 1)))}/day` : ''} tone={tl - ts < 0 ? 'neg' : 'pos'} />
        <Kpi label="Unbudgeted spend" value={money(sum(unb, (x) => x[1]))} foot={`${unb.length} categories without a budget`} />
      </div>
      <div className="card md:hidden">
        {bs.length === 0 && <Empty action={<button className="btn-primary btn-sm" onClick={() => budgetForm(d, db, ws)}>+ Add budget</button>}>Set a monthly limit per expense category.</Empty>}
        {bs.map((b) => { const sp = cats[b.category] || 0; const pace = now ? sp / ((b.monthly_limit * dom) / dim) : sp / b.monthly_limit; return (
          <div key={b.id} className="m-row">
            <div className="flex justify-between items-center gap-2 mb-1.5"><span className="font-semibold">{b.category}</span>{pace > 1.1 ? <span className="badge-red">Too fast</span> : pace > 0.9 ? <span className="badge-amber">On edge</span> : <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">OK</span>}</div>
            <Progress value={sp} max={b.monthly_limit} />
            <div className="flex justify-between text-xs mt-1.5"><span>{money(sp)} <span className="text-slate-400">of {money(b.monthly_limit)}</span></span><span className={b.monthly_limit - sp < 0 ? 'text-red-500 font-bold' : 'text-slate-500'}>{money(b.monthly_limit - sp)} left</span></div>
            <div className="m-actions"><button onClick={() => budgetForm(d, db, ws, b)}>Edit</button><button className="!text-red-500" onClick={async () => { if (confirm('Delete this budget?')) { await db.remove('budgets', b.id); toast('Deleted') } }}>Delete</button></div>
          </div>) })}
        {unb.map(([c, v]) => <div key={c} className="m-row flex justify-between text-sm text-slate-400"><span>{c} <span className="badge-slate">no budget</span></span><span>{money(v)}</span></div>)}
      </div>
      <div className="card overflow-x-auto hidden md:block">
        <table className="w-full">
          <thead><tr>{['Category', 'Progress', 'Spent', 'Limit', 'Left', 'Pace', ''].map((h, i) => <th key={i} className={`table-th ${i >= 2 && i <= 5 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {bs.length === 0 && <tr><td colSpan={7}><Empty action={<button className="btn-primary btn-sm" onClick={() => budgetForm(d, db, ws)}>+ Add budget</button>}>Set a monthly limit per expense category.</Empty></td></tr>}
            {bs.map((b) => { const sp = cats[b.category] || 0; const pace = now ? sp / ((b.monthly_limit * dom) / dim) : sp / b.monthly_limit; return (
              <tr key={b.id} className="table-row">
                <td className="table-td font-semibold">{b.category}</td>
                <td className="table-td w-1/3"><Progress value={sp} max={b.monthly_limit} /></td>
                <td className="table-td text-right">{money(sp)}</td><td className="table-td text-right">{money(b.monthly_limit)}</td>
                <td className={`table-td text-right ${b.monthly_limit - sp < 0 ? 'text-red-500 font-bold' : ''}`}>{money(b.monthly_limit - sp)}</td>
                <td className="table-td text-right">{pace > 1.1 ? <span className="badge-red">Too fast</span> : pace > 0.9 ? <span className="badge-amber">On edge</span> : <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">OK</span>}</td>
                <td className="table-td text-right text-xs whitespace-nowrap"><button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => budgetForm(d, db, ws, b)}>Edit</button><button className="text-slate-400 hover:text-red-500" onClick={async () => { if (confirm('Delete this budget?')) { await db.remove('budgets', b.id); toast('Deleted') } }}>Delete</button></td>
              </tr>) })}
            {unb.map(([c, v]) => <tr key={c} className="text-slate-400"><td className="table-td">{c} <span className="badge-slate">no budget</span></td><td className="table-td" /><td className="table-td text-right">{money(v)}</td><td colSpan={4} className="table-td" /></tr>)}
          </tbody>
        </table>
      </div>
    </div>
  )
}
