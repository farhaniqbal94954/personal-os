import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import { DueBadge, Empty, FitText, Kpi, MoneyText, usePage } from '../components/ui'
import { activeAccounts, balanceNow } from '../lib/finance'
import { formatDate, formatMoney, pct } from '../lib/formatters'
import { JAR_TEMPLATES, freeIn, jarByAccount, jarComplete, jarPlan, jarProgress, jarSaved, jarTarget, jarsInAccount, purposeLabel, reservedIn, reservedTotal, safetyScore, wsJars } from '../lib/jars'
import { createCoreJars, deleteJar, jarForm, moveForm, moveJar } from '../lib/jarForms'
import { accountForm } from '../lib/forms'
import { toast } from '../store/useAppStore'
import type { Jar } from '../types/database'

function Ring({ value, size = 92, stroke = 9, color = '#6366f1', children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-100 dark:text-slate-700" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} style={{ transition: 'stroke-dashoffset .5s' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  )
}

export default function Jars() {
  const { d, db, ws, money } = usePage()
  const [picker, setPicker] = useState(false)
  const [hist, setHist] = useState<Jar | null>(null)
  const jars = wsJars(d, ws)
  const sc = safetyScore(d, ws)
  const accs = activeAccounts(d, ws).filter((a) => a.type !== 'Credit card')
  const reserved = reservedTotal(d, ws)
  const free = accs.reduce((s, a) => s + freeIn(d, a), 0)
  const prot = jars.filter((j) => j.kind === 'protection')
  const touched = accs.filter((a) => reservedIn(d, a.id) > 0 && balanceNow(d, a) < reservedIn(d, a.id))
  const levelColor = sc.level >= 4 ? '#10b981' : sc.level >= 2 ? '#6366f1' : '#f59e0b'

  const run = (p: Promise<unknown>) => p.catch((e) => toast((e as Error).message, 'err'))

  return (
    <div>
      <PageHeader title="Safety Jars" subtitle="Your safety base. Money stays in your bank — jars only reserve it, so you know what not to touch."
        action={<button className="btn-primary" onClick={() => setPicker(true)}>+ Add jar</button>} />

      {touched.length > 0 && (
        <div className="mb-4 rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300" data-testid="touched-alert">
          <b>⚠️ Jar money was spent.</b> {touched.map((a) => `${a.bank} · ${a.name} has ${money(balanceNow(d, a))} but ${money(reservedIn(d, a.id))} is reserved`).join(' · ')}. Refill the account or release money from a jar.
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 2xl:gap-4 mb-5">
        <div className="card p-4 2xl:p-5 col-span-2 flex items-center gap-4" data-testid="safety-score">
          <Ring value={sc.score / 100} color={levelColor}><div><div className="text-xl font-black leading-none">{sc.score}%</div><div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">strong</div></div></Ring>
          <div className="min-w-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Safety base</div>
            <div className="text-lg font-black leading-tight">Level {sc.level} of 5 · {sc.levelName}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sc.total ? `${sc.done} of ${sc.total} jars complete. ` : ''}{sc.next ? <>Fill next: <b>{sc.next.icon} {sc.next.name}</b></> : sc.total ? 'Every jar is full 🎉' : 'Create your first jars to start.'}</div>
          </div>
        </div>
        <Kpi label="Reserved in jars" value={money(reserved)} foot={`🔒 across ${accs.filter((a) => reservedIn(d, a.id) !== 0).length} account(s)`} />
        <Kpi label="Free to use" value={money(free)} foot={prot.length ? `Insurance: ${prot.filter((p) => p.covered).length} of ${prot.length} covered` : 'Bank balance minus jar money'} tone={free < 0 ? 'neg' : undefined} />
      </div>

      {jars.length === 0 ? (
        <div className="card p-8 text-center max-w-2xl mx-auto">
          <div className="text-4xl mb-2">🫙</div>
          <h2 className="text-lg font-black mb-1">Build your safety base</h2>
          <p className="text-sm text-slate-500 mb-5">Start with the five steps most financial planners recommend, in this order: a starter emergency fund, health insurance, life insurance, a full emergency fund, and a jar for yearly big costs.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button className="btn-primary" data-testid="create-core" onClick={() => run(createCoreJars(d, db, ws))}>Create the 5 recommended jars</button>
            <button className="btn" onClick={() => setPicker(true)}>Choose my own</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3 2xl:gap-4 mb-6">
          {jars.map((j, i) => {
            const isNext = sc.next?.id === j.id; const done = jarComplete(d, j); const p = jarProgress(d, j)
            const { target, auto } = jarTarget(d, j); const saved = jarSaved(d, j); const where = jarByAccount(d, j); const plan = jarPlan(d, j)
            const color = done ? '#10b981' : isNext ? '#6366f1' : '#94a3b8'
            return (
              <div key={j.id} data-testid="jar-card" className={`card p-4 2xl:p-5 flex flex-col ${isNext ? 'ring-2 ring-indigo-500/60' : ''}`}>
                <div className="flex items-start gap-3">
                  <Ring value={p} size={58} stroke={6} color={color}><span className="text-2xl">{j.icon}</span></Ring>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="badge-slate">#{j.priority}</span>
                      {done ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{j.kind === 'protection' ? 'Covered ✓' : 'Full ✓'}</span>
                        : isNext ? <span className="badge-indigo">Fill next</span>
                        : j.kind === 'protection' ? <span className="badge-amber">Not covered</span> : null}
                    </div>
                    <h3 className="font-bold mt-1 leading-tight">{j.name}</h3>
                  </div>
                  <div className="flex flex-col -mr-1">
                    <button aria-label="Move up" disabled={i === 0} className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 px-1 leading-none" onClick={() => run(moveJar(d, db, j, -1))}>▲</button>
                    <button aria-label="Move down" disabled={i === jars.length - 1} className="text-slate-300 hover:text-indigo-600 disabled:opacity-30 px-1 leading-none" onClick={() => run(moveJar(d, db, j, 1))}>▼</button>
                  </div>
                </div>

                {j.kind === 'money' ? (
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <FitText max={20} min={13} className="font-black tabular-nums"><MoneyText value={money(saved)} /></FitText>
                      <span className="text-xs text-slate-400 whitespace-nowrap">{target > 0 ? `of ${money(target)} · ${pct(saved, target)}%` : 'no target yet'}</span>
                    </div>
                    <div className="progress-track mt-1.5"><div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: color }} /></div>
                    <div className="text-[11px] text-slate-400 mt-1.5">{auto && j.target_months ? `Target = ${j.target_months} month${j.target_months === 1 ? '' : 's'} of your expenses (updates automatically)` : target > 0 ? 'Fixed target' : <button className="text-indigo-600 font-semibold" onClick={() => jarForm(d, db, ws, j)}>Set a target →</button>}{j.target_date ? ` · by ${formatDate(j.target_date)}` : ''}</div>
                    {where.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{where.map((w) => <span key={w.account.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">🔒 {w.account.bank} · {money(w.amount)}</span>)}</div>}
                    {plan && !done && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">💡 {plan}</p>}
                  </div>
                ) : (
                  <div className="mt-3 text-sm space-y-1">
                    {j.covered ? <>
                      {j.provider && <div className="flex justify-between gap-2"><span className="text-slate-400 text-xs">Provider</span><b className="text-right">{j.provider}{j.policy_no ? <span className="font-normal text-slate-400"> · {j.policy_no}</span> : null}</b></div>}
                      {j.coverage ? <div className="flex justify-between gap-2"><span className="text-slate-400 text-xs">Coverage</span><b>{money(j.coverage)}</b></div> : null}
                      {j.premium ? <div className="flex justify-between gap-2"><span className="text-slate-400 text-xs">Premium</span><span>{money(j.premium)} / {(j.premium_freq || 'Yearly').toLowerCase().replace('ly', '')}</span></div> : null}
                      {j.renewal_date && <div className="flex justify-between items-center gap-2"><span className="text-slate-400 text-xs">Renews</span><DueBadge date={j.renewal_date} /></div>}
                    </> : <p className="text-xs text-slate-500 dark:text-slate-400">{JAR_TEMPLATES.find((t) => t.name === j.name)?.hint || 'Not covered yet.'} Add the policy details once you have it.</p>}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-auto pt-3 text-xs font-semibold">
                  {j.kind === 'money' ? <>
                    <button className="btn-primary btn-sm" data-testid="jar-add" onClick={() => moveForm(d, db, j, 'add')}>+ Add money</button>
                    {saved > 0 && <button className="text-slate-500 hover:text-indigo-600" onClick={() => moveForm(d, db, j, 'release')}>Release</button>}
                    {saved > 0 && <button className="text-red-500" onClick={() => moveForm(d, db, j, 'use')}>Use in emergency</button>}
                    <button className="text-slate-500 hover:text-indigo-600" onClick={() => setHist(j)}>History</button>
                  </> : <button className={j.covered ? 'btn btn-sm' : 'btn-primary btn-sm'} onClick={() => jarForm(d, db, ws, j)}>{j.covered ? 'Policy details' : 'Add policy'}</button>}
                  <span className="flex-1" />
                  <button className="text-slate-400 hover:text-indigo-600" onClick={() => jarForm(d, db, ws, j)}>Edit</button>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => deleteJar(d, db, j)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* where the jar money is kept */}
      <div className="card">
        <div className="px-4 2xl:px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">Where your money is — reserved vs free</h3>
          <span className="text-xs text-slate-400">Your bank balance never changes when you fill a jar.</span>
        </div>
        {accs.length === 0 ? <Empty action={<button className="btn-primary btn-sm" onClick={() => accountForm(d, db, ws)}>+ Add account</button>}>No accounts yet.</Empty> : accs.map((a) => {
          const bal = balanceNow(d, a), res = reservedIn(d, a.id), fr = freeIn(d, a), list = jarsInAccount(d, a.id)
          return (
            <div key={a.id} className="m-row 2xl:px-5" data-testid="reserve-row">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <div className="min-w-0"><div className="font-semibold">{a.bank} · {a.name}</div><div className="text-xs text-slate-400">{purposeLabel(a.purpose) || <button className="text-indigo-600" onClick={() => accountForm(d, db, ws, a)}>Set what this account is for →</button>}</div></div>
                <div className="flex gap-5 text-right text-sm tabular-nums">
                  <div><div className="text-[10px] text-slate-400 font-bold uppercase">Balance</div><b>{money(bal)}</b></div>
                  <div><div className="text-[10px] text-slate-400 font-bold uppercase">🔒 Reserved</div><b className="text-indigo-600 dark:text-indigo-400">{money(res)}</b></div>
                  <div><div className="text-[10px] text-slate-400 font-bold uppercase">Free</div><b className={fr < 0 ? 'text-red-500' : 'text-emerald-600'}>{money(fr)}</b></div>
                </div>
              </div>
              {bal > 0 && res > 0 && <div className="flex h-2 rounded-full overflow-hidden mt-2 bg-emerald-100 dark:bg-emerald-900/30"><div className="bg-indigo-500" style={{ width: `${Math.min(100, (res / bal) * 100)}%` }} /></div>}
              {list.length > 0 && <div className="text-[11px] text-slate-400 mt-1">{list.map((x) => `${x.jar.icon} ${x.jar.name} ${money(x.amount)}`).join(' · ')}</div>}
            </div>
          )
        })}
      </div>

      {/* template picker */}
      <Modal open={picker} onClose={() => setPicker(false)} title="Add a jar" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {JAR_TEMPLATES.map((t) => {
            const exists = jars.some((j) => j.name === t.name && t.key !== 'custom')
            return (
              <button key={t.key} data-testid={`tpl-${t.key}`} disabled={exists} onClick={() => { setPicker(false); jarForm(d, db, ws, undefined, t.key) }}
                className="text-left flex gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 disabled:opacity-40 disabled:pointer-events-none">
                <span className="text-2xl">{t.icon}</span>
                <span className="min-w-0"><span className="block font-semibold text-sm">{t.name || 'Custom jar'}{exists ? ' ✓' : ''}</span><span className="block text-xs text-slate-400">{t.kind === 'protection' ? '🛡️ Insurance · ' : ''}{t.hint}</span></span>
              </button>
            )
          })}
        </div>
      </Modal>

      {/* history */}
      <Modal open={!!hist} onClose={() => setHist(null)} title={`History · ${hist?.name || ''}`}>
        {hist && (() => {
          const rows = d.jar_allocations.filter((x) => x.jar_id === hist.id).sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
          return rows.length === 0 ? <Empty>No money added yet.</Empty> : rows.map((x) => {
            const a = d.accounts.find((y) => y.id === x.account_id)
            return (
              <div key={x.id} className="flex justify-between items-center gap-3 py-2.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                <div className="min-w-0"><div className="text-sm font-semibold">{x.kind === 'add' ? '🔒 Reserved' : x.kind === 'release' ? '↩ Released' : '🚨 Used'}{x.note ? ` — ${x.note}` : ''}</div><div className="text-xs text-slate-400">{formatDate(x.date)} · {a ? `${a.bank} · ${a.name}` : 'deleted account'}</div></div>
                <div className="flex items-center gap-3"><b className={`text-sm whitespace-nowrap ${x.amount > 0 ? 'text-indigo-600' : 'text-slate-500'}`}>{x.amount > 0 ? '+' : '−'}{formatMoney(Math.abs(x.amount), hist.country)}</b>
                  <button className="text-xs text-slate-400 hover:text-red-500" onClick={async () => { const after = d.jar_allocations.filter((y) => y.jar_id === x.jar_id && y.account_id === x.account_id && y.id !== x.id).reduce((s, y) => s + y.amount, 0); if (after < -0.001) return toast('Undo the later release/use entries first — the jar cannot go below zero.', 'err'); if (confirm('Undo this entry? (A linked expense, if any, stays — delete it in Transactions.)')) { await db.remove('jar_allocations', x.id); toast('Removed') } }}>Undo</button></div>
              </div>
            )
          })
        })()}
      </Modal>
    </div>
  )
}
