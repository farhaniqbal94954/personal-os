import { openForm, type Vals } from '../components/FormModal'
import type { AppData, Country, Jar, Transaction } from '../types/database'
import type { useDb } from './data'
import { activeAccounts, balanceNow, expenseCats } from './finance'
import { formatMoney, r2, today, WS } from './formatters'
import { JAR_ICONS, JAR_TEMPLATES, expenseBase, freeIn, jarByAccount, jarInAccount, jarTarget, jarsInAccount, wsJars } from './jars'
import { toast } from '../store/useAppStore'

type Db = ReturnType<typeof useDb>
const nextPriority = (d: AppData, ws: Country) => Math.max(0, ...wsJars(d, ws).map((j) => j.priority)) + 1
const freq: Record<string, 'monthly' | 'quarterly' | 'yearly'> = { Monthly: 'monthly', Quarterly: 'quarterly', Yearly: 'yearly' }

/** account options with what is free in each, savings accounts first */
function accountOptions(d: AppData, ws: Country): [string, string][] {
  const rank = (p: string | null) => (p === 'Savings' ? 0 : p === 'Daily' ? 2 : p === 'Business' ? 3 : 1)
  return activeAccounts(d, ws).filter((a) => a.type !== 'Credit card').sort((a, b) => rank(a.purpose) - rank(b.purpose))
    .map((a) => [a.id, `${a.bank} · ${a.name}${a.purpose ? ` (${a.purpose})` : ''} — free ${formatMoney(freeIn(d, a), ws)}`])
}

/* ---------- create / edit a jar ---------- */
export function jarForm(d: AppData, db: Db, ws: Country, rec?: Jar, templateKey = 'custom') {
  const t = JAR_TEMPLATES.find((x) => x.key === templateKey) || JAR_TEMPLATES[JAR_TEMPLATES.length - 1]
  const c = rec?.country || ws; const cur = WS[c].cur; const base = expenseBase(d, c)
  const card = r2(activeAccounts(d, c).filter((a) => a.type === 'Credit card').reduce((s, a) => s + Math.max(0, -balanceNow(d, a)), 0)) // amount owed on cards
  const init: Vals = rec ? { ...rec } : {
    name: t.name, icon: t.icon, kind: t.kind, priority: nextPriority(d, c), target_mode: t.target_mode, target_months: t.target_months ?? '',
    target_amount: t.key === 'debt' ? card || '' : '', covered: false, premium_freq: 'Yearly',
  }
  openForm({
    title: rec ? `Edit jar · ${rec.name}` : t.key === 'custom' ? 'New jar' : `New jar · ${t.name}`,
    initial: init,
    info: (v) => v.kind === 'protection'
      ? <>A <b>protection jar</b> tracks an insurance policy: covered or not, coverage, premium and renewal. Adding a renewal date creates a reminder automatically.</>
      : <>A <b>money jar</b> reserves part of your bank balance. The money stays in the account — the app shows it as 🔒 reserved and warns you before you spend it.{v.target_mode === 'months' ? <> Target = {v.target_months || '?'} × your average monthly expenses{base > 0 ? <> ({formatMoney(base, c)}) ≈ <b>{formatMoney(Math.round(base * (Number(v.target_months) || 0)), c)}</b>. It updates as your spending changes.</> : ' (shown once you have a month of expenses).'}</> : null}</>,
    fields: (v) => {
      const money = v.kind === 'money'
      return [
        { k: 'name', l: 'Jar name', req: true, full: true, ph: 'Emergency fund' },
        { k: 'icon', l: 'Icon', t: 'select', req: true, opts: JAR_ICONS.map((i) => [i, i]) },
        { k: 'kind', l: 'Type', t: 'select', req: true, opts: [['money', '💰 Money jar (savings)'], ['protection', '🛡️ Protection (insurance)']], show: !rec },
        { k: 'priority', l: 'Priority (1 = fill first)', t: 'number', step: '1', req: true },
        { k: 'target_mode', l: 'Target', t: 'select', req: true, show: money, opts: [['months', 'Months of my expenses (auto)'], ['fixed', 'Fixed amount']] },
        { k: 'target_months', l: 'Months of expenses', t: 'number', step: '0.5', req: true, show: money && v.target_mode === 'months', hint: base > 0 ? `Your average: ${formatMoney(base, c)} / month` : 'Used once you have expense history' },
        { k: 'target_amount', l: money && v.target_mode === 'months' ? `Minimum target (${cur}, used until you have expense history)` : `Target amount (${cur})`, t: 'number', req: money && v.target_mode === 'fixed', show: money },
        { k: 'target_date', l: 'Target date (optional)', t: 'date', show: money, hint: 'Gives you a monthly saving plan.' },
        { k: 'covered', l: 'I am covered (policy active)', t: 'check', show: !money },
        { k: 'provider', l: 'Insurer / provider', show: !money, ph: 'Daman / Star Health' },
        { k: 'policy_no', l: 'Policy number', show: !money },
        { k: 'coverage', l: `Coverage amount (${cur})`, t: 'number', show: !money },
        { k: 'premium', l: `Premium (${cur})`, t: 'number', show: !money },
        { k: 'premium_freq', l: 'Premium paid', t: 'select', show: !money, opts: [['Yearly', 'Yearly'], ['Quarterly', 'Quarterly'], ['Monthly', 'Monthly']] },
        { k: 'renewal_date', l: 'Next renewal / payment date', t: 'date', show: !money },
        { k: 'note', l: 'Notes', t: 'textarea', rows: 2 },
      ]
    },
    validate: (v) => {
      if (!(Number(v.priority) >= 1)) return 'Priority must be 1 or more.'
      if (v.kind === 'money' && v.target_mode === 'months' && !(Number(v.target_months) > 0)) return 'Months must be more than 0.'
      if (v.kind === 'money' && v.target_mode === 'fixed' && !(Number(v.target_amount) > 0)) return 'Target amount must be more than 0.'
      return null
    },
    onSubmit: async (v) => {
      const money = v.kind === 'money'
      const row: Record<string, unknown> = {
        name: v.name, icon: v.icon, kind: v.kind, priority: Math.round(Number(v.priority)), note: v.note || '',
        target_mode: money ? v.target_mode : 'fixed', target_months: money && v.target_mode === 'months' ? v.target_months : null,
        target_amount: money ? v.target_amount || 0 : 0, target_date: money ? v.target_date : null,
        covered: !money && !!v.covered, provider: money ? '' : v.provider || '', policy_no: money ? '' : v.policy_no || '',
        coverage: money ? null : v.coverage, premium: money ? null : v.premium, premium_freq: money ? null : v.premium_freq, renewal_date: money ? null : v.renewal_date,
      }
      // protection: keep a renewal reminder in sync
      if (!money && v.renewal_date) {
        const rem = { name: `Renew: ${v.name}`, due_date: v.renewal_date, repeat: freq[v.premium_freq] || 'yearly', amount: v.premium || null, category: expenseCats(d).includes('Insurance') ? 'Insurance' : null, detail: [v.provider, v.policy_no && `Policy ${v.policy_no}`].filter(Boolean).join(' · ') }
        const existing = rec?.reminder_id && d.reminders.find((r) => r.id === rec.reminder_id)
        if (existing) await db.update('reminders', existing.id, { ...rem, status: 'Upcoming' })
        else { const [r] = await db.insert<{ id: string }>('reminders', { ...rem, country: c, status: 'Upcoming' }); row.reminder_id = r.id }
      }
      if (rec) await db.update('jars', rec.id, row); else await db.insert('jars', { ...row, country: c })
    },
    success: rec ? 'Jar updated' : 'Jar created',
  })
}

/** one click: the five core jars of a safety base, in the right order */
export async function createCoreJars(d: AppData, db: Db, ws: Country) {
  let p = nextPriority(d, ws)
  const rows = JAR_TEMPLATES.filter((t) => t.core).map((t) => ({ country: ws, name: t.name, icon: t.icon, kind: t.kind, priority: p++, target_mode: t.target_mode, target_months: t.target_months ?? null, target_amount: 0 }))
  await db.insert('jars', rows)
  toast('5 safety jars created — set targets and start filling')
}

/* ---------- reserve / release / use ---------- */
export function moveForm(d: AppData, db: Db, jar: Jar, mode: 'add' | 'release' | 'use') {
  const ws = jar.country; const cur = WS[ws].cur
  const holding = jarByAccount(d, jar)
  if (mode === 'add' && !accountOptions(d, ws).length) return toast(`Add a ${WS[ws].label} bank account first.`, 'err')
  if (mode !== 'add' && !holding.length) return toast('This jar has no money yet.', 'err')
  const opts: [string, string][] = mode === 'add' ? accountOptions(d, ws) : holding.map((h) => [h.account.id, `${h.account.bank} · ${h.account.name} — ${formatMoney(h.amount, ws)} in this jar`])
  const { target } = jarTarget(d, jar)
  const titles = { add: `Add money · ${jar.icon} ${jar.name}`, release: `Release money · ${jar.name}`, use: `Use in an emergency · ${jar.name}` }
  openForm({
    title: titles[mode], submitLabel: mode === 'add' ? 'Reserve money' : mode === 'release' ? 'Release' : 'Use money',
    initial: { account_id: opts[0]?.[0], amount: '', date: today(), record: true, category: 'Healthcare', description: '' },
    info: (v) => {
      const a = d.accounts.find((x) => x.id === v.account_id); if (!a) return null
      const free = freeIn(d, a); const inJar = jarInAccount(d, jar.id, a.id)
      if (mode === 'add') return <>The money <b>stays in {a.bank}</b>. It is only marked as 🔒 reserved for this jar. Free in this account now: <b>{formatMoney(free, ws)}</b>.{target > 0 ? <> Jar needs {formatMoney(Math.max(0, target - holding.reduce((s, h) => s + h.amount, 0)), ws)} more.</> : null}</>
      if (mode === 'release') return <>Moves {formatMoney(inJar, ws)} (or part of it) back to <b>free money</b> in {a.bank}. Nothing changes in your bank.</>
      return <>For a real emergency. The jar goes down, and you can record the expense at the same time so the bank balance is right.</>
    },
    fields: (v) => [
      { k: 'account_id', l: mode === 'add' ? 'Keep it in account' : 'From account', t: 'select', req: true, full: true, opts },
      { k: 'amount', l: `Amount (${cur})`, t: 'number', req: true },
      { k: 'date', l: 'Date', t: 'date', req: true },
      { k: 'record', l: 'Also record the expense (money left the bank)', t: 'check', show: mode === 'use' },
      { k: 'category', l: 'Expense category', t: 'select', req: true, show: mode === 'use' && !!v.record, opts: expenseCats(d).map((x) => [x, x]) },
      { k: 'description', l: 'What was it for?', req: mode === 'use', show: mode === 'use', full: true, ph: 'Hospital bill' },
      { k: 'note', l: 'Note (optional)', show: mode !== 'use', full: true },
    ],
    validate: (v) => {
      const a = d.accounts.find((x) => x.id === v.account_id); if (!a) return 'Choose an account.'
      if (!(v.amount > 0)) return 'Amount must be greater than 0.'
      if (mode === 'add') { const free = freeIn(d, a); if (v.amount > free + 0.001) return `Only ${formatMoney(Math.max(0, free), ws)} is free in ${a.bank} — the rest is already in jars or not there. Choose a smaller amount or another account.` }
      else { const inJar = jarInAccount(d, jar.id, a.id); if (v.amount > inJar + 0.001) return `This jar only has ${formatMoney(inJar, ws)} in ${a.bank}.` }
      return null
    },
    onSubmit: async (v) => {
      let txn_id: string | null = null
      if (mode === 'use' && v.record) {
        const [t] = await db.insert<Transaction>('transactions', { country: ws, type: 'Expense', date: v.date, account_id: v.account_id, amount: v.amount, category: v.category, description: v.description || `Emergency — ${jar.name}` })
        txn_id = t.id
      }
      await db.insert('jar_allocations', { jar_id: jar.id, account_id: v.account_id, amount: mode === 'add' ? v.amount : -v.amount, kind: mode, date: v.date, note: mode === 'use' ? v.description || '' : v.note || '', txn_id })
    },
    success: mode === 'add' ? 'Reserved 🔒 — the money stays in your bank' : mode === 'release' ? 'Released back to free money' : 'Recorded — refill the jar when you can',
  })
}

export async function deleteJar(d: AppData, db: Db, jar: Jar) {
  const saved = r2(jarByAccount(d, jar).reduce((s, h) => s + h.amount, 0))
  if (!confirm(`Delete the jar "${jar.name}"?${saved ? `\n\n${formatMoney(saved, jar.country)} reserved in it becomes free money again (nothing changes in your bank).` : ''}`)) return
  await db.remove('jars', jar.id)
  // keep priorities 1, 2, 3 … without gaps
  const rest = wsJars(d, jar.country).filter((j) => j.id !== jar.id)
  for (let k = 0; k < rest.length; k++) if (rest[k].priority !== k + 1) await db.update('jars', rest[k].id, { priority: k + 1 })
  await db.refresh(); toast('Jar deleted')
}

export async function moveJar(d: AppData, db: Db, jar: Jar, dir: -1 | 1) {
  const list = wsJars(d, jar.country); const i = list.findIndex((j) => j.id === jar.id); const other = list[i + dir]
  if (!other) return
  // renumber 1..n so priorities stay clean
  const reordered = [...list]; reordered[i] = other; reordered[i + dir] = jar
  for (let k = 0; k < reordered.length; k++) if (reordered[k].priority !== k + 1) await db.update('jars', reordered[k].id, { priority: k + 1 })
}

/** short text for an account: "🔒 10,000 reserved (Emergency fund, Hajj)" */
export function reservedNote(d: AppData, accountId: string, ws: Country) {
  const list = jarsInAccount(d, accountId); if (!list.length) return ''
  return `🔒 ${formatMoney(list.reduce((s, x) => s + x.amount, 0), ws)} in ${list.map((x) => x.jar.name).join(', ')}`
}
