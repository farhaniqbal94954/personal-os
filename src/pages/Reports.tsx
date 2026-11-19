import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'
import PageHeader from '../components/PageHeader'
import { Empty, Kpi, PALETTE, chartTooltip, usePage } from '../components/ui'
import { bankTotal, bankTotalAt, download, flows, investTotal, monthIE, sortTx, toCSV, txCsvRows } from '../lib/finance'
import { monthAdd, monthEnd, monthLabel, monthShort, moneyShort, pct, sum, thisMonth, today } from '../lib/formatters'

const PERIODS = [['month', 'This month'], ['last', 'Last month'], ['ytd', 'Year to date'], ['12m', 'Last 12 months'], ['ly', 'Last year'], ['all', 'All time']] as const

export default function Reports() {
  const { d, ws, money } = usePage()
  const [p, setP] = useState<(typeof PERIODS)[number][0]>('12m')
  const y = new Date().getFullYear(); let from = '0000', to = today()
  if (p === 'month') from = thisMonth() + '-01'
  else if (p === 'last') { const lm = monthAdd(thisMonth(), -1); from = lm + '-01'; to = monthEnd(lm) }
  else if (p === 'ytd') from = `${y}-01-01`
  else if (p === 'ly') { from = `${y - 1}-01-01`; to = `${y - 1}-12-31` }
  else if (p === '12m') from = monthAdd(thisMonth(), -11) + '-01'
  const label = PERIODS.find((x) => x[0] === p)![1]
  const tx = flows(d, ws).filter((t) => t.date >= from && t.date <= to)
  const inc = sum(tx.filter((t) => t.type === 'Income'), (t) => t.amount), exp = sum(tx.filter((t) => t.type === 'Expense'), (t) => t.amount)
  const months: string[] = []
  { let mk = (from === '0000' ? tx.map((t) => t.date).sort()[0] || today() : from).slice(0, 7); let g = 0; while (mk <= to.slice(0, 7) && g++ < 240) { months.push(mk); mk = monthAdd(mk, 1) } }
  const rows = months.map((mk) => { const x = monthIE(d, ws, mk); return { mk, ...x, net: x.inc - x.exp } })
  const firstM = (tx.map((t) => t.date).sort()[0] || today()).slice(0, 7); const n = Math.max(1, months.filter((m) => m >= firstM).length)
  const group = (type: string) => { const o: Record<string, number> = {}; tx.filter((t) => t.type === type).forEach((t) => (o[t.category || '—'] = (o[t.category || '—'] || 0) + t.amount)); return Object.entries(o).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value })) }
  const ec = group('Expense'), ic = group('Income')
  const Donut = ({ data }: { data: { name: string; value: number }[] }) => { const tot = sum(data, (x) => x.value); return data.length === 0 ? <Empty>No data</Empty> : (
    <div className="flex flex-wrap items-center gap-4">
      <div className="w-40 h-40"><PieChart width={160} height={160}><Pie data={data} dataKey="value" innerRadius={42} outerRadius={75} paddingAngle={data.length > 1 ? 2 : 0} isAnimationActive={false}>{data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Pie><Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /></PieChart></div>
      <div className="space-y-1 text-xs">{data.slice(0, 9).map((x, i) => <div key={x.name}><span className="inline-block w-2.5 h-2.5 rounded-sm mr-2" style={{ background: PALETTE[i % PALETTE.length] }} />{x.name} — <b>{pct(x.value, tot)}%</b> · {money(x.value)}</div>)}</div>
    </div>) }
  return (
    <div>
      <PageHeader title="Reports" subtitle="Monthly summaries and breakdowns." action={<div className="flex gap-2"><button className="btn" onClick={() => download(`report-${ws}-${p}.csv`, toCSV(txCsvRows(d, [...tx].sort(sortTx))))}>Export CSV</button><button className="btn" onClick={() => window.print()}>Print / PDF</button></div>} />
      <div className="flex flex-wrap gap-2 mb-5">{PERIODS.map(([k, l]) => <button key={k} onClick={() => setP(k)} className={`btn btn-sm ${p === k ? '!bg-indigo-50 !text-indigo-700 dark:!bg-indigo-900/30 dark:!text-indigo-300' : ''}`}>{l}</button>)}</div>
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        <Kpi label="Income" value={money(inc)} foot={label} tone="pos" />
        <Kpi label="Expenses" value={money(exp)} foot={label} tone="neg" />
        <Kpi label="Net savings" value={money(inc - exp)} foot={inc ? `Savings rate ${pct(inc - exp, inc)}%` : ''} tone={inc - exp >= 0 ? 'pos' : 'neg'} />
        <Kpi label="Avg monthly spend" value={money(exp / n)} foot={`${n} month(s)`} />
        <Kpi label="Net worth now" value={money(bankTotal(d, ws) + investTotal(d, ws))} foot={`Bank ${moneyShort(bankTotal(d, ws), ws)} · Invest ${moneyShort(investTotal(d, ws), ws)}`} />
      </div>
      <div className="card p-5 mb-5">
        <h3 className="text-sm font-bold mb-4">Monthly income vs expenses</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={rows.slice(-12).map((r) => ({ month: monthShort(r.mk), Income: r.inc, Expenses: r.exp }))} barGap={3} barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => moneyShort(v, ws)} />
            <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar isAnimationActive={false} dataKey="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} /><Bar isAnimationActive={false} dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="card p-5"><h3 className="text-sm font-bold mb-3">Expenses by category</h3><Donut data={ec} /></div>
        <div className="card p-5"><h3 className="text-sm font-bold mb-3">Income by source</h3><Donut data={ic} /></div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead><tr>{['Month', 'Income', 'Expenses', 'Net', 'Savings rate', 'Bank balance at month-end'].map((h, i) => <th key={i} className={`table-th ${i ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {[...rows].reverse().map((r) => { const bal = bankTotalAt(d, ws, r.mk === thisMonth() ? today() : monthEnd(r.mk)); return (
              <tr key={r.mk} className="table-row"><td className="table-td">{monthLabel(r.mk)}</td><td className="table-td text-right text-income">{money(r.inc)}</td><td className="table-td text-right text-expense">{money(r.exp)}</td><td className={`table-td text-right font-semibold ${r.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{money(r.net)}</td><td className="table-td text-right">{r.inc ? pct(r.net, r.inc) + '%' : '—'}</td><td className="table-td text-right">{bal === null ? <span className="text-slate-400">—</span> : money(bal)}</td></tr>) })}
            <tr className="font-black"><td className="table-td">Total</td><td className="table-td text-right text-income">{money(inc)}</td><td className="table-td text-right text-expense">{money(exp)}</td><td className="table-td text-right">{money(inc - exp)}</td><td className="table-td text-right">{inc ? pct(inc - exp, inc) + '%' : '—'}</td><td className="table-td" /></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
