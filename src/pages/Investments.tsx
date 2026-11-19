import { PieChart, Pie, Cell, Tooltip } from 'recharts'
import PageHeader from '../components/PageHeader'
import { Empty, Kpi, PALETTE, chartTooltip, usePage } from '../components/ui'
import { deleteHolding, holdValueForm, holdingForm, investMoveForm, targetsForm } from '../lib/forms'
import { daysUntil, formatDate, pct, r2, sum } from '../lib/formatters'

export default function Investments() {
  const { d, db, ws, money } = usePage()
  const hs = d.holdings.filter((h) => h.country === ws).sort((a, b) => b.current_value - a.current_value)
  const iv = sum(hs, (h) => h.invested), cv = sum(hs, (h) => h.current_value), g = r2(cv - iv)
  const tg = d.settings.targets[ws] || {}
  const byType: Record<string, number> = {}; hs.forEach((h) => (byType[h.type] = r2((byType[h.type] || 0) + h.current_value)))
  const types = [...new Set([...Object.keys(byType), ...Object.keys(tg)])]
  const best = hs.filter((h) => h.invested > 0).sort((a, b) => b.current_value / b.invested - a.current_value / a.invested)[0]
  const pie = Object.entries(byType).map(([name, value]) => ({ name, value }))
  return (
    <div>
      <PageHeader title="Investments" subtitle="Holdings, returns and allocation." action={<div className="flex gap-2"><button className="btn" onClick={() => targetsForm(d, db, ws)}>Set targets</button><button className="btn-primary" onClick={() => holdingForm(db, ws)}>+ Add investment</button></div>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Current value" value={money(cv)} foot={`${hs.length} holdings`} icon="📈" />
        <Kpi label="Invested (cost)" value={money(iv)} foot="Total money put in" icon="💵" />
        <Kpi label="Gain / loss" value={(g >= 0 ? '+' : '') + money(g)} foot={iv ? `${pct(g, iv)}% overall` : '—'} tone={g >= 0 ? 'pos' : 'neg'} icon="📊" />
        <Kpi label="Best performer" value={best ? best.name : '—'} foot={best ? `+${pct(best.current_value - best.invested, best.invested)}%` : ''} icon="🏆" />
      </div>
      <div className="card mb-5 overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Name', 'Type', 'Invested', 'Value', 'Gain', 'Weight', 'Updated', ''].map((h, i) => <th key={i} className={`table-th ${i >= 2 && i <= 5 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {hs.length === 0 ? <tr><td colSpan={8}><Empty action={<button className="btn-primary btn-sm" onClick={() => holdingForm(db, ws)}>+ Add investment</button>}>No investments yet.</Empty></td></tr> : hs.map((h) => { const gg = r2(h.current_value - h.invested); return (
              <tr key={h.id} className="table-row">
                <td className="table-td"><div className="font-semibold">{h.name}</div>{h.units ? <div className="text-xs text-slate-400">{h.units} units</div> : null}</td>
                <td className="table-td"><span className="badge-slate">{h.type}</span></td>
                <td className="table-td text-right">{money(h.invested)}</td>
                <td className="table-td text-right font-bold">{money(h.current_value)}</td>
                <td className={`table-td text-right ${gg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{gg >= 0 ? '+' : ''}{money(gg)}<div className="text-xs">{h.invested ? pct(gg, h.invested) + '%' : ''}</div></td>
                <td className="table-td text-right">{pct(h.current_value, cv)}%</td>
                <td className={`table-td text-xs ${daysUntil(h.updated_on) < -30 ? 'text-amber-500' : 'text-slate-400'}`}>{formatDate(h.updated_on)}</td>
                <td className="table-td text-right text-xs whitespace-nowrap">
                  <button className="text-indigo-600 font-semibold mr-3" onClick={() => holdValueForm(db, h)}>Update value</button>
                  <button className="text-slate-500 hover:text-indigo-600 mr-3" onClick={() => investMoveForm(d, db, h, 'buy')}>Buy</button>
                  <button className="text-slate-500 hover:text-indigo-600 mr-3" onClick={() => investMoveForm(d, db, h, 'sell')}>Sell</button>
                  <button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => holdingForm(db, ws, h)}>Edit</button>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => deleteHolding(db, h)}>Delete</button>
                </td>
              </tr>) })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-bold mb-3">Allocation</h3>
          {pie.length === 0 ? <Empty>No data yet</Empty> : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-44 h-44"><PieChart width={176} height={176}><Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={pie.length > 1 ? 2 : 0} isAnimationActive={false}>{pie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /></PieChart></div>
              <div className="space-y-1.5 text-xs">{pie.map((p, i) => <div key={p.name}><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2" style={{ background: PALETTE[i % PALETTE.length] }} />{p.name} — <b>{pct(p.value, cv)}%</b> · {money(p.value)}</div>)}</div>
            </div>)}
        </div>
        <div className="card p-5">
          <div className="flex justify-between mb-3"><h3 className="text-sm font-bold">Actual vs target</h3><button className="btn btn-sm" onClick={() => targetsForm(d, db, ws)}>Edit targets</button></div>
          {types.length === 0 ? <Empty>Add holdings or targets.</Empty> : types.map((t) => { const ap = cv ? ((byType[t] || 0) / cv) * 100 : 0, tp = tg[t] || 0, df = ap - tp; return (
            <div key={t} className="py-1.5">
              <div className="flex justify-between text-xs mb-1"><b>{t}</b><span>{ap.toFixed(0)}% <span className="text-slate-400">/ target {tp}%</span> {Math.abs(df) >= 10 && <span className={df > 0 ? 'badge-amber' : 'badge-blue'}>{df > 0 ? 'over' : 'under'} {Math.abs(df).toFixed(0)}pp</span>}</span></div>
              <div className="progress-track relative"><div className="progress-fill" style={{ width: `${Math.min(100, ap)}%` }} /><span className="absolute top-0 bottom-0 w-0.5 bg-slate-800 dark:bg-white" style={{ left: `${tp}%` }} /></div>
            </div>) })}
        </div>
      </div>
    </div>
  )
}
