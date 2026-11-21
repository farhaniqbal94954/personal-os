import { Link, useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import PageHeader from '../components/PageHeader'
import { Amount, CardHead, DueBadge, Empty, Kpi, Progress, chartTooltip, usePage } from '../components/ui'
import { activeAccounts, balanceNow, bankTotal, catTotals, investTotal, investedTotal, monthIE, sortTx, upcomingItems, wsTxns } from '../lib/finance'
import { allSuggestions, freeIn, jarProgress, reservedIn, reservedTotal, safetyScore, wsJars } from '../lib/jars'
import { accountForm, txnForm } from '../lib/forms'
import { formatDate, monthAdd, monthShort, moneyShort, pct, r2, thisMonth, today, WS } from '../lib/formatters'

export default function Dashboard() {
  const { d, db, ws, money } = usePage()
  const nav = useNavigate()
  const m = thisMonth(), pm = monthAdd(m, -1)
  const accs = activeAccounts(d, ws)
  const bal = bankTotal(d, ws), { inc, exp } = monthIE(d, ws, m), last = monthIE(d, ws, pm)
  const inv = investTotal(d, ws), invCost = investedTotal(d, ws), nw = r2(bal + inv)
  const rate = inc ? Math.round(((inc - exp) / inc) * 100) : null
  const other = ws === 'UAE' ? 'INDIA' : 'UAE'; const onw = bankTotal(d, other) + investTotal(d, other); const fx = d.settings.fx_aed_inr
  const combined = fx ? (ws === 'UAE' ? nw + onw / fx : nw + onw * fx) : null
  const chart = Array.from({ length: 6 }, (_, i) => { const mk = monthAdd(m, i - 5); const x = monthIE(d, ws, mk); return { month: monthShort(mk), Income: x.inc, Expenses: x.exp } })
  const sg = allSuggestions(d, ws)
  const reserved = reservedTotal(d, ws)
  const safety = safetyScore(d, ws)
  const jars = wsJars(d, ws)
  const recent = wsTxns(d, ws).sort(sortTx).slice(0, 6)
  const prio = { High: 0, Medium: 1, Low: 2 }
  const tasks = d.tasks.filter((t) => !t.done).sort((a, b) => a.due_date.localeCompare(b.due_date) || prio[a.priority] - prio[b.priority]).slice(0, 6)
  const upcoming = upcomingItems(d, ws, 21).slice(0, 6)
  const cats = Object.entries(catTotals(d, ws, m)).sort((a, b) => b[1] - a[1])
  const chg = (a: number, b: number, inverse?: boolean) => { if (!b) return 'This month'; const p = Math.round(((a - b) / b) * 100); const good = inverse ? p <= 0 : p >= 0; return <span className={good ? 'text-emerald-600' : 'text-red-500'}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)}% vs last month</span> }

  if (!d.accounts.length && !d.transactions.length) return (
    <div className="card max-w-xl mx-auto mt-10 p-10 text-center">
      <div className="text-4xl mb-3">👋</div>
      <h2 className="text-xl font-black mb-2">Welcome to Personal OS</h2>
      <p className="text-sm text-slate-500 mb-6">Start by adding your bank accounts with <b>today's balance</b> from your bank app. Every income, expense and transfer you add afterwards updates the balances automatically.</p>
      <button className="btn-primary" onClick={() => accountForm(d, db, ws)}>+ Add first bank account</button>
    </div>
  )

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${WS[ws].flag} ${WS[ws].label} · ${WS[ws].cur} — your money and priorities at a glance.`}
        action={<button className="btn-primary" onClick={() => txnForm(d, db, ws)}>+ Transaction</button>} />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 2xl:gap-4 mb-4">
        <Kpi label="Bank balance" value={money(bal)} foot={reserved ? <>Free {money(r2(bal - reserved))} · <span className="text-indigo-600 dark:text-indigo-400">🔒 {money(reserved)}</span></> : `${accs.length} active account${accs.length !== 1 ? 's' : ''}`} icon="🏦" tone={bal < 0 ? 'neg' : undefined} />
        <Kpi label={`Income · ${monthShort(m)}`} value={money(inc)} foot={chg(inc, last.inc)} tone="pos" icon="↗️" />
        <Kpi label={`Expenses · ${monthShort(m)}`} value={money(exp)} foot={chg(exp, last.exp, true)} tone="neg" icon="↘️" />
        <Kpi label="Investments" value={money(inv)} foot={invCost ? <span className={inv >= invCost ? 'text-emerald-600' : 'text-red-500'}>{inv >= invCost ? '+' : ''}{pct(inv - invCost, invCost)}% return</span> : `${d.holdings.filter((h) => h.country === ws).length} holdings`} icon="📈" />
        <div className="col-span-2 lg:col-span-1"><Kpi label="Net worth" value={money(nw)} foot={combined !== null ? `Both countries ≈ ${money(combined)}` : 'Bank + investments'} icon="💎" /></div>
      </div>

      <Link to="/jars" className="card px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 hover:border-indigo-400 transition-colors" data-testid="safety-strip">
        <div className="flex items-center gap-2.5 shrink-0"><span className="text-xl">🫙</span><div><div className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">Safety base</div><div className="text-sm font-black">{jars.length ? `Level ${safety.level} of 5 · ${safety.score}% strong` : 'Not started'}</div></div></div>
        <div className="flex-1 min-w-[180px] flex gap-1.5 items-center">
          {jars.length ? jars.map((j) => <div key={j.id} title={`${j.name}: ${Math.round(jarProgress(d, j) * 100)}%`} className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${jarProgress(d, j) * 100}%`, background: jarProgress(d, j) >= 1 ? '#10b981' : safety.next?.id === j.id ? '#6366f1' : '#94a3b8' }} /></div>)
            : <span className="text-xs text-slate-400">Create jars for an emergency fund and insurance →</span>}
        </div>
        {safety.next && <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Fill next: <b className="text-slate-700 dark:text-slate-200">{safety.next.icon} {safety.next.name}</b></div>}
        {reserved > 0 && <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">🔒 {money(reserved)} reserved</div>}
      </Link>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 2xl:gap-4 mb-4">
        <div className="card p-5 xl:col-span-3 flex flex-col">
          <CardHead title="Cash flow — last 6 months">{rate !== null && <span className="text-xs text-slate-400">Savings rate this month: <b className={rate >= d.settings.savings_target ? 'text-emerald-600' : rate < 0 ? 'text-red-500' : 'text-amber-500'}>{rate}%</b></span>}</CardHead>
          <div className="flex-1 min-h-[220px]"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barGap={3} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => moneyShort(v, ws)} />
              <Tooltip {...chartTooltip} formatter={(v: number) => money(v)} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar isAnimationActive={false} dataKey="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar isAnimationActive={false} dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer></div>
        </div>
        <div className="card p-5 xl:col-span-2">
          <CardHead title={<>💡 Suggestions <span className="badge-slate ml-1">{sg.length}</span></>} />
          <div className="xl:max-h-[300px] xl:overflow-y-auto -mx-2" data-testid="suggestions">
            {sg.length === 0 ? <Empty>All good — nothing needs attention 🎉</Empty> : sg.map((s, i) => (
              <div key={i} className={`flex gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0 px-2 rounded-lg ${s.to ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30' : ''}`} onClick={() => s.to && nav(s.to)}>
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.lvl === 'red' ? 'bg-red-500' : s.lvl === 'amber' ? 'bg-amber-500' : s.lvl === 'green' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <div><div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{s.title}</div><div className="text-xs text-slate-500 dark:text-slate-400">{s.text}</div></div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2">Calculated from your own data with fixed rules (no AI cost). Not financial advice.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 2xl:gap-4 mb-4">
        <div className="card p-5">
          <CardHead title="Bank accounts"><Link to="/accounts" className="btn btn-sm">View all →</Link></CardHead>
          {accs.length === 0 ? <Empty action={<button className="btn-primary btn-sm" onClick={() => accountForm(d, db, ws)}>+ Add account</button>}>No accounts in this workspace.</Empty> : <>
            {accs.map((a) => { const b = balanceNow(d, a); return (
              <div key={a.id} className="flex justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50">
                <div className="min-w-0"><div className="text-sm font-semibold truncate">{a.bank}</div><div className="text-xs text-slate-400">{a.name} · {a.purpose || a.type}</div></div>
                <div className="text-right shrink-0"><div className={`text-sm font-bold ${b < 0 ? 'text-red-500' : ''}`}>{money(b)}</div>{reservedIn(d, a.id) ? <div className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">🔒 {money(reservedIn(d, a.id))} · free {money(freeIn(d, a))}</div> : null}</div>
              </div>) })}
            <div className="flex justify-between pt-3 text-sm font-black"><span>Total</span><span data-testid="dash-total">{money(bal)}</span></div>
          </>}
        </div>
        <div className="card p-5">
          <CardHead title={`Where money went · ${monthShort(m)}`}><Link to="/budgets" className="btn btn-sm">Budgets →</Link></CardHead>
          {cats.length === 0 ? <Empty>No expenses this month yet.</Empty> : cats.slice(0, 6).map(([c, v]) => { const b = d.budgets.find((x) => x.country === ws && x.category === c); return (
            <div key={c} className="py-1.5">
              <div className="flex justify-between text-xs mb-1"><b className="text-slate-700 dark:text-slate-200">{c}</b><span>{money(v)}{b && <span className="text-slate-400"> / {moneyShort(b.monthly_limit, ws)}</span>}</span></div>
              <Progress value={v} max={b ? b.monthly_limit : exp} neutral={!b} />
            </div>) })}
        </div>
        <div className="card p-5">
          <CardHead title="Coming up"><Link to="/reminders" className="btn btn-sm">Reminders →</Link></CardHead>
          {upcoming.length === 0 ? <Empty>Nothing due in the next 3 weeks.</Empty> : upcoming.map((u, i) => (
            <Link to={u.to} key={i} className="flex justify-between items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <div className="min-w-0"><div className="text-sm font-semibold truncate">{u.name}</div><div className="text-xs text-slate-400">{u.sub}</div></div><DueBadge date={u.due} />
            </Link>))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 2xl:gap-4">
        <div className="card p-5">
          <CardHead title="Recent transactions"><Link to="/transactions" className="btn btn-sm">View all →</Link></CardHead>
          {recent.length === 0 ? <Empty action={<button className="btn-primary btn-sm" onClick={() => txnForm(d, db, ws)}>+ Add transaction</button>}>No transactions yet.</Empty> : recent.map((t) => (
            <div key={t.id} className="flex justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <div className="min-w-0"><div className="text-sm font-semibold truncate">{t.description || t.category || t.type}</div><div className="text-xs text-slate-400">{formatDate(t.date)} · {t.type === 'Transfer' ? 'Transfer' : t.category || t.type}</div></div>
              <Amount d={d} t={t} ws={ws} />
            </div>))}
        </div>
        <div className="card p-5">
          <CardHead title="Priorities"><Link to="/tasks" className="btn btn-sm">All tasks →</Link></CardHead>
          {tasks.length === 0 ? <Empty>No pending tasks 🎉</Empty> : tasks.map((t) => (
            <div key={t.id} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
              <input type="checkbox" className="mt-1 w-4 h-4 accent-indigo-600" checked={false} onChange={() => db.update('tasks', t.id, { done: true, done_on: today() })} />
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{t.name}</div><div className="text-xs text-slate-400">{formatDate(t.due_date)} · {t.priority} priority</div></div>
              <DueBadge date={t.due_date} />
            </div>))}
        </div>
      </div>
    </div>
  )
}
