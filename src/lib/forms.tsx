/* All add / edit / delete flows live here so every page behaves the same way. */
import { openForm, type Vals } from '../components/FormModal'
import type { Account, AppData, Business, BusinessItem, Country, Holding, Project, Reminder, Task, Note, Budget, Transaction } from '../types/database'
import type { useDb } from './data'
import { ACC_TYPES, FREQ_M, HOLD_TYPES, accBalance, accCountry, activeAccounts, balanceNow, expenseCats, incomeCats, isFlow, nextDue } from './finance'
import { addMonths, formatDate, formatMoney, r2, today, WS } from './formatters'
import { toast } from '../store/useAppStore'
import { ACCOUNT_PURPOSES, freeIn, jarsInAccount, reservedIn } from './jars'

type Db = ReturnType<typeof useDb>
const accOpts = (d: AppData, ws: Country | '*', keep?: string | null): [string, string][] =>
  d.accounts.filter((a) => (ws === '*' || a.country === ws) && (!a.archived || a.id === keep))
    .map((a) => [a.id, `${a.bank} · ${a.name}${ws === '*' ? ` (${WS[a.country].cur})` : ''}`])
const list = (xs: readonly string[]): [string, string][] => xs.map((x) => [x, x])
const catOpts = (d: AppData, type: string, keep?: string | null) => {
  const o = list(type === 'Income' ? incomeCats(d) : expenseCats(d)); if (keep && !o.find((x) => x[0] === keep)) o.push([keep, keep]); return o
}
const positive = (v: Vals, k = 'amount') => (!(Number(v[k]) > 0) ? 'Amount must be greater than 0.' : null)

/* ---------------- Accounts ---------------- */
export function accountForm(d: AppData, db: Db, ws: Country, rec?: Account) {
  const cur = WS[rec?.country || ws].cur
  openForm({
    title: rec ? 'Edit bank account' : 'Add bank account',
    initial: rec ? { ...rec } : { type: 'Savings', opening_balance: '', opening_date: today(), archived: false },
    info: (v) => rec
      ? <>Current balance: <b>{formatMoney(accBalance(d, { ...rec, opening_balance: Number(v.opening_balance) || 0, opening_date: v.opening_date || rec.opening_date }) ?? 0, rec.country)}</b> = starting balance + transactions since the start date.</>
      : <>Type the balance your bank app shows <b>today</b>. From now on every transaction you add moves this balance automatically.</>,
    fields: () => [
      { k: 'bank', l: 'Bank / provider', req: true, ph: ws === 'UAE' ? 'Emirates NBD' : 'HDFC Bank' },
      { k: 'name', l: 'Account name', req: true, ph: 'Current account' },
      { k: 'type', l: 'Type', t: 'select', req: true, opts: list(ACC_TYPES) },
      { k: 'purpose', l: 'What is it for?', t: 'select', blank: '— Not set —', opts: ACCOUNT_PURPOSES, hint: 'Daily spending, savings or company — jars suggest savings accounts first.' },
      { k: 'last4', l: 'Last 4 digits', ph: '4821', max: 4 },
      { k: 'opening_balance', l: `Starting balance (${cur})`, t: 'number', req: true, hint: 'Credit card: enter the amount you owe as a negative number, e.g. -2500.' },
      { k: 'opening_date', l: 'Balance as of (start date)', t: 'date', req: true, hint: 'Older transactions are kept as history but not added to the balance.' },
      { k: 'archived', l: 'Archive (hide from pickers, keep history)', t: 'check', show: !!rec },
    ],
    validate: (v) => (v.last4 && !/^\d{4}$/.test(v.last4) ? 'Last 4 digits must be exactly 4 numbers.' : null),
    onSubmit: async (v) => {
      const row = { bank: v.bank, name: v.name, type: v.type, purpose: v.purpose || null, last4: v.last4 || null, number: v.last4 ? '•••• ' + v.last4 : '', opening_balance: v.opening_balance, opening_date: v.opening_date, archived: !!v.archived, balance: v.opening_balance }
      if (rec) await db.update('accounts', rec.id, row); else await db.insert('accounts', { ...row, country: ws })
    },
    success: rec ? 'Account updated' : 'Account added',
  })
}

export function reconcileForm(d: AppData, db: Db, a: Account) {
  const cur = balanceNow(d, a)
  openForm({
    title: `Reconcile · ${a.bank} ${a.name}`, submitLabel: 'Fix balance',
    initial: { actual: cur, date: today() },
    info: () => <>App balance: <b>{formatMoney(cur, a.country)}</b>. Type the exact balance from your bank app — an adjustment is recorded for any difference, so the app matches your bank.</>,
    fields: () => [{ k: 'actual', l: `Actual balance in bank (${WS[a.country].cur})`, t: 'number', req: true }, { k: 'date', l: 'As of', t: 'date', req: true }],
    validate: (v) => (v.date < a.opening_date ? `Date cannot be before the account start date (${formatDate(a.opening_date)}). Edit the account's starting balance instead.` : null),
    onSubmit: async (v) => {
      const diff = r2(v.actual - (accBalance(d, a, v.date) ?? 0))
      if (diff) await db.insert('transactions', { country: a.country, type: 'Adjustment', date: v.date, account_id: a.id, amount: diff, description: 'Reconciliation with bank statement' })
      await db.update('accounts', a.id, { last_reconciled: v.date })
      toast(diff ? `Adjusted by ${formatMoney(diff, a.country)}` : 'Balance already matches ✓')
    },
  })
}

export async function deleteAccount(d: AppData, db: Db, a: Account) {
  const txs = d.transactions.filter((t) => t.account_id === a.id || t.to_account_id === a.id)
  if (txs.length) {
    if (!confirm(`"${a.bank} · ${a.name}" has ${txs.length} transaction(s).\n\nOK = delete the account AND those transactions.\nCancel = keep it (tip: Edit → Archive keeps history).`)) return
    for (const t of txs) await deleteTxn(d, db, t, true)
  } else if (!confirm(`Delete "${a.bank} · ${a.name}"?`)) return
  await db.remove('accounts', a.id); await db.refresh(); toast('Account deleted')
}

/* ---------------- Transactions ---------------- */
export function txnForm(d: AppData, db: Db, ws: Country, rec?: Transaction, preset: Vals = {}) {
  if (rec?.holding_id) return toast('Investment buy/sell entries cannot be edited — delete and record again.', 'err')
  if (rec?.bitem_id) return toast('This receipt is linked to an invoice/contract — delete it and collect again.', 'err')
  if (!rec && !activeAccounts(d, ws).length) { toast(`Add a ${WS[ws].label} bank account first — every transaction belongs to an account.`, 'err'); return accountForm(d, db, ws) }
  const country = rec?.country || ws
  openForm({
    title: rec ? 'Edit transaction' : 'Add transaction',
    info: (v) => {
      // 🔒 warn before spending money that is reserved in a jar
      if (!(v.type === 'Expense' || v.type === 'Transfer') || !v.account_id) return null
      const a = d.accounts.find((x) => x.id === v.account_id); if (!a || reservedIn(d, a.id) <= 0) return null
      const res = reservedIn(d, a.id); const already = rec && rec.account_id === a.id && (rec.type === 'Expense' || rec.type === 'Transfer') ? rec.amount : 0
      const free = freeIn(d, a) + already; const amt = Number(v.amount) || 0; const names = jarsInAccount(d, a.id).map((x) => x.jar.name).join(', ')
      return amt > free + 0.001
        ? <span className="text-red-600 dark:text-red-400" data-testid="reserve-warning">⚠️ This uses <b>{formatMoney(amt - Math.max(0, free), a.country)}</b> of jar money ({names}). Free to use in {a.bank}: {formatMoney(Math.max(0, free), a.country)}. You can still save — the jar will show it was touched.</span>
        : <>🔒 {formatMoney(res, a.country)} in {a.bank} is reserved for {names}. Free to use: <b>{formatMoney(free, a.country)}</b>.</>
    },
    initial: rec ? { ...rec } : { type: 'Expense', date: today(), account_id: activeAccounts(d, ws)[0]?.id, category: '', description: '', ...preset },
    fields: (v) => {
      const xfer = v.type === 'Transfer'
      const cross = xfer && v.account_id && v.to_account_id && accCountry(d, v.account_id) !== accCountry(d, v.to_account_id)
      const fromCur = v.account_id ? WS[accCountry(d, v.account_id) || country].cur : WS[country].cur
      return [
        { k: 'type', l: 'Type', t: 'select', req: true, resets: ['category'], opts: [['Expense', '📤 Expense'], ['Income', '📥 Income'], ['Transfer', '⇄ Transfer between my accounts'], ['Adjustment', '± Balance adjustment']] },
        { k: 'date', l: 'Date', t: 'date', req: true },
        { k: 'account_id', l: xfer ? 'From account' : 'Account', t: 'select', req: true, opts: accOpts(d, xfer ? '*' : country, v.account_id) },
        { k: 'to_account_id', l: 'To account', t: 'select', req: true, show: xfer, opts: accOpts(d, '*', v.to_account_id).filter((o) => o[0] !== v.account_id) },
        { k: 'amount', l: v.type === 'Adjustment' ? `Amount (${fromCur}) — use minus to reduce` : `Amount (${fromCur})`, t: 'number', req: true },
        { k: 'to_amount', l: `Amount received (${v.to_account_id ? WS[accCountry(d, v.to_account_id)!].cur : ''})`, t: 'number', req: true, show: !!cross, hint: 'Different currency — enter what actually arrived.' },
        { k: 'category', l: 'Category', t: 'select', req: true, blank: '— Select —', show: isFlow(v as Transaction), opts: catOpts(d, v.type, v.category) },
        { k: 'description', l: 'Description', req: !xfer && v.type !== 'Adjustment', full: true, ph: v.type === 'Income' ? 'Monthly salary' : xfer ? 'Monthly savings' : 'Groceries — Carrefour' },
        { k: 'project_id', l: 'Project (optional)', t: 'select', blank: '— None —', show: v.type === 'Expense', opts: d.projects.filter((p) => p.country === country).map((p) => [p.id, p.name]) },
        { k: 'business_id', l: 'Business (optional)', t: 'select', blank: '— None —', show: isFlow(v as Transaction), opts: d.businesses.filter((b) => b.country === country).map((b) => [b.id, b.name]) },
      ]
    },
    validate: (v) => {
      if (v.type === 'Adjustment') return v.amount ? null : 'Adjustment cannot be 0.'
      if (!(v.amount > 0)) return 'Amount must be greater than 0.'
      if (v.type === 'Transfer' && v.account_id === v.to_account_id) return 'From and To accounts must be different.'
      return null
    },
    onSubmit: async (v) => {
      const xfer = v.type === 'Transfer'; const cross = xfer && accCountry(d, v.account_id) !== accCountry(d, v.to_account_id)
      const row = {
        type: v.type, date: v.date, amount: v.amount, account_id: v.account_id,
        country: accCountry(d, v.account_id) || country,
        to_account_id: xfer ? v.to_account_id : null, to_amount: cross ? v.to_amount : null,
        category: isFlow(v as Transaction) ? v.category : null,
        description: v.description || (xfer ? 'Transfer' : v.type === 'Adjustment' ? 'Balance adjustment' : ''),
        project_id: v.type === 'Expense' ? v.project_id || null : null,
        business_id: isFlow(v as Transaction) ? v.business_id || null : null,
      }
      if (rec) await db.update('transactions', rec.id, row); else await db.insert('transactions', row)
    },
    success: rec ? 'Transaction updated' : 'Saved — balance updated',
  })
}

/** deletes a transaction and undoes its side-effects (investment value, invoice status) */
export async function deleteTxn(d: AppData, db: Db, t: Transaction, silent = false) {
  if (!silent && !confirm('Delete this transaction? The account balance is recalculated.')) return
  if (t.holding_id) {
    const h = d.holdings.find((x) => x.id === t.holding_id)
    if (h) await db.update('holdings', h.id, t.kind === 'buy'
      ? { invested: r2(h.invested - t.amount), current_value: r2(h.current_value - t.amount) }
      : { invested: r2(h.invested + (t.cost || 0)), current_value: r2(h.current_value + t.amount) })
  }
  if (t.bitem_id) {
    const it = d.business_items.find((i) => i.id === t.bitem_id)
    if (it && it.category === 'Invoice' && it.txn_id === t.id) await db.update('business_items', it.id, { status: 'Unpaid', txn_id: null, paid_on: null })
  }
  await db.remove('transactions', t.id)
  if (!silent) toast('Deleted')
}

/* ---------------- Investments ---------------- */
export function holdingForm(db: Db, ws: Country, rec?: Holding) {
  openForm({
    title: rec ? 'Edit holding' : 'Add investment',
    initial: rec ? { ...rec } : { type: 'Mutual fund', invested: '', current_value: '' },
    fields: () => [
      { k: 'name', l: 'Name', req: true, full: true, ph: 'Parag Parikh Flexi Cap' },
      { k: 'type', l: 'Type', t: 'select', req: true, opts: list(HOLD_TYPES) },
      { k: 'units', l: 'Units / qty (optional)', t: 'number', step: 'any' },
      { k: 'invested', l: 'Total invested (cost)', t: 'number', req: true },
      { k: 'current_value', l: 'Current market value', t: 'number', req: true },
      { k: 'note', l: 'Notes', t: 'textarea', rows: 2 },
    ],
    validate: (v) => (v.invested < 0 || v.current_value < 0 ? 'Values cannot be negative.' : null),
    onSubmit: async (v) => {
      const row = { name: v.name, type: v.type, units: v.units, invested: v.invested, current_value: v.current_value, note: v.note || '', updated_on: today() }
      if (rec) await db.update('holdings', rec.id, row); else await db.insert('holdings', { ...row, country: ws })
    },
    success: 'Holding saved',
  })
}
export function holdValueForm(db: Db, h: Holding) {
  openForm({
    title: `Update value · ${h.name}`, initial: { current_value: h.current_value },
    fields: () => [{ k: 'current_value', l: `Current market value (${WS[h.country].cur})`, t: 'number', req: true, hint: `Invested: ${formatMoney(h.invested, h.country)}` }],
    validate: (v) => (v.current_value < 0 ? 'Value cannot be negative.' : null),
    onSubmit: (v) => db.update('holdings', h.id, { current_value: v.current_value, updated_on: today() }), success: 'Value updated',
  })
}
export function investMoveForm(d: AppData, db: Db, h: Holding, kind: 'buy' | 'sell') {
  const sell = kind === 'sell'
  openForm({
    title: `${sell ? 'Sell / withdraw' : 'Buy more / top-up'} · ${h.name}`,
    initial: { date: today(), amount: '', account_id: activeAccounts(d, h.country)[0]?.id || '' },
    info: () => (sell ? <>Current value {formatMoney(h.current_value, h.country)}. Cost basis reduces proportionally; the cash goes to the account you choose.</> : <>Moves money from a bank account into this investment. It is a <b>transfer, not an expense</b>, so your savings rate is not affected.</>),
    fields: () => [
      { k: 'amount', l: `Amount (${WS[h.country].cur})`, t: 'number', req: true },
      { k: 'date', l: 'Date', t: 'date', req: true },
      { k: 'account_id', l: sell ? 'Receive into account' : 'Pay from account', t: 'select', blank: sell ? '— Not into a tracked account —' : '— Not from a tracked account —', opts: accOpts(d, h.country) },
    ],
    validate: (v) => positive(v) || (sell && v.amount > h.current_value + 0.001 ? 'Cannot sell more than the current value.' : null),
    onSubmit: async (v) => {
      if (sell) {
        const cost = h.current_value ? r2((h.invested * v.amount) / h.current_value) : 0
        if (v.account_id) await db.insert('transactions', { country: h.country, type: 'Transfer', date: v.date, account_id: null, to_account_id: v.account_id, amount: v.amount, holding_id: h.id, kind: 'sell', cost, description: `Sold — ${h.name}` })
        await db.update('holdings', h.id, { invested: r2(h.invested - cost), current_value: r2(h.current_value - v.amount), updated_on: today() })
      } else {
        if (v.account_id) await db.insert('transactions', { country: h.country, type: 'Transfer', date: v.date, account_id: v.account_id, to_account_id: null, amount: v.amount, holding_id: h.id, kind: 'buy', description: `Invested — ${h.name}` })
        await db.update('holdings', h.id, { invested: r2(h.invested + v.amount), current_value: r2(h.current_value + v.amount), updated_on: today() })
      }
    },
    success: sell ? 'Sale recorded' : 'Top-up recorded',
  })
}
export function targetsForm(d: AppData, db: Db, ws: Country) {
  const t = d.settings.targets[ws] || {}; const init: Vals = {}; HOLD_TYPES.forEach((x) => (init[x] = t[x] ?? ''))
  openForm({
    title: `Target allocation (%) · ${WS[ws].label}`, initial: init,
    fields: () => HOLD_TYPES.map((x) => ({ k: x, l: x, t: 'number' as const, step: '1' })),
    validate: (v) => { const s = HOLD_TYPES.reduce((a, x) => a + (Number(v[x]) || 0), 0); return s && s !== 100 ? `Targets add up to ${s}% — they must total 100%.` : null },
    onSubmit: (v) => { const o: Record<string, number> = {}; HOLD_TYPES.forEach((x) => { if (Number(v[x])) o[x] = Number(v[x]) }); return db.saveSettings({ targets: { ...d.settings.targets, [ws]: o } }) },
    success: 'Targets saved',
  })
}
export async function deleteHolding(db: Db, h: Holding) {
  if (!confirm(`Delete "${h.name}"? Past buy/sell transfers stay in your history.`)) return
  await db.remove('holdings', h.id); await db.refresh(); toast('Deleted')
}

/* ---------------- Budgets / Projects ---------------- */
export function budgetForm(d: AppData, db: Db, ws: Country, rec?: Budget) {
  openForm({
    title: rec ? 'Edit budget' : 'Add monthly budget', initial: rec ? { ...rec } : { category: '', monthly_limit: '' },
    fields: () => [
      { k: 'category', l: 'Expense category', t: 'select', req: true, blank: '— Select —', opts: catOpts(d, 'Expense', rec?.category).filter((o) => o[0] === rec?.category || !d.budgets.find((b) => b.country === ws && b.category === o[0])) },
      { k: 'monthly_limit', l: `Monthly limit (${WS[ws].cur})`, t: 'number', req: true },
    ],
    validate: (v) => positive(v, 'monthly_limit'),
    onSubmit: (v) => (rec ? db.update('budgets', rec.id, { category: v.category, monthly_limit: v.monthly_limit }) : db.insert('budgets', { country: ws, category: v.category, monthly_limit: v.monthly_limit })),
    success: 'Budget saved',
  })
}
export function projectForm(db: Db, ws: Country, rec?: Project) {
  openForm({
    title: rec ? 'Edit project' : 'Add project',
    initial: rec ? { ...rec } : { status: 'Active', budget: '', manual_spent: 0 },
    info: () => <>Spent = expenses tagged with this project + anything spent before you started tracking.</>,
    fields: () => [
      { k: 'name', l: 'Project name', req: true, full: true },
      { k: 'budget', l: `Budget (${WS[rec?.country || ws].cur})`, t: 'number', req: true },
      { k: 'manual_spent', l: 'Already spent before tracking', t: 'number' },
      { k: 'status', l: 'Status', t: 'select', req: true, opts: list(['Active', 'In progress', 'On hold', 'Completed']) },
      { k: 'deadline', l: 'Target date', t: 'date' },
      { k: 'note', l: 'Notes', t: 'textarea', rows: 2 },
    ],
    validate: (v) => (v.budget < 0 ? 'Budget cannot be negative.' : null),
    onSubmit: (v) => { const row = { name: v.name, budget: v.budget, manual_spent: v.manual_spent || 0, status: v.status, deadline: v.deadline, note: v.note || '' }; return rec ? db.update('projects', rec.id, row) : db.insert('projects', { ...row, country: ws }) },
    success: 'Project saved',
  })
}
export async function deleteProject(db: Db, p: Project) {
  if (!confirm(`Delete project "${p.name}"? Tagged expenses stay (untagged).`)) return
  await db.remove('projects', p.id); await db.refresh(); toast('Deleted')
}

/* ---------------- Tasks / Reminders / Notes ---------------- */
export function taskForm(db: Db, rec?: Task) {
  openForm({
    title: rec ? 'Edit task' : 'Add task', initial: rec ? { ...rec } : { priority: 'Medium', due_date: today(), done: false },
    fields: () => [{ k: 'name', l: 'Task', req: true, full: true }, { k: 'due_date', l: 'Due date', t: 'date', req: true }, { k: 'priority', l: 'Priority', t: 'select', req: true, opts: list(['High', 'Medium', 'Low']) }, { k: 'note', l: 'Notes', t: 'textarea', rows: 2 }, { k: 'done', l: 'Completed', t: 'check', show: !!rec }],
    onSubmit: (v) => { const row = { name: v.name, due_date: v.due_date, priority: v.priority, note: v.note || '', done: !!v.done, done_on: v.done ? rec?.done_on || today() : null }; return rec ? db.update('tasks', rec.id, row) : db.insert('tasks', row) },
    success: 'Task saved',
  })
}
export function reminderForm(d: AppData, db: Db, ws: Country, rec?: Reminder) {
  const c = rec?.country || ws
  openForm({
    title: rec ? 'Edit reminder' : 'Add reminder / bill', initial: rec ? { ...rec } : { due_date: today(), repeat: 'none', amount: '' },
    fields: (v) => [
      { k: 'name', l: 'Title', req: true, full: true, ph: 'DEWA bill / Trade licence renewal' },
      { k: 'due_date', l: 'Due date', t: 'date', req: true },
      { k: 'repeat', l: 'Repeats', t: 'select', req: true, opts: [['none', 'Does not repeat'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly']] },
      { k: 'amount', l: `Amount to pay (${WS[c].cur}, optional)`, t: 'number' },
      { k: 'account_id', l: 'Usually paid from', t: 'select', blank: '— Choose when paying —', show: Number(v.amount) > 0, opts: accOpts(d, c, v.account_id) },
      { k: 'category', l: 'Expense category', t: 'select', blank: '— Select —', show: Number(v.amount) > 0, opts: catOpts(d, 'Expense', v.category) },
      { k: 'detail', l: 'Details', t: 'textarea', rows: 2 },
    ],
    onSubmit: (v) => { const row = { name: v.name, due_date: v.due_date, repeat: v.repeat, amount: v.amount, account_id: v.amount ? v.account_id : null, category: v.amount ? v.category : null, detail: v.detail || '' }; return rec ? db.update('reminders', rec.id, row) : db.insert('reminders', { ...row, country: c, status: 'Upcoming' }) },
    success: 'Reminder saved',
  })
}
export async function completeReminder(db: Db, r: Reminder, silent = false) {
  if (r.repeat !== 'none') { const n = nextDue(r); await db.update('reminders', r.id, { due_date: n }); if (!silent) toast('Done — next due ' + formatDate(n)) }
  else { await db.update('reminders', r.id, { status: 'Done', done_on: today() }); if (!silent) toast('Marked done') }
}
export function payReminderForm(d: AppData, db: Db, r: Reminder) {
  openForm({
    title: `Pay · ${r.name}`, submitLabel: 'Record payment',
    initial: { amount: r.amount, account_id: r.account_id || activeAccounts(d, r.country)[0]?.id, date: today(), category: r.category || 'Utilities' },
    info: () => (r.repeat !== 'none' ? <>After paying, the next due date moves to {formatDate(nextDue(r))}.</> : <>The reminder will be marked done.</>),
    fields: () => [{ k: 'amount', l: `Amount (${WS[r.country].cur})`, t: 'number', req: true }, { k: 'date', l: 'Paid on', t: 'date', req: true }, { k: 'account_id', l: 'From account', t: 'select', req: true, opts: accOpts(d, r.country) }, { k: 'category', l: 'Category', t: 'select', req: true, opts: catOpts(d, 'Expense', r.category) }],
    validate: (v) => positive(v) || (!v.account_id ? 'Add a bank account first.' : null),
    onSubmit: async (v) => {
      await db.insert('transactions', { country: r.country, type: 'Expense', date: v.date, account_id: v.account_id, amount: v.amount, category: v.category, description: r.name })
      await completeReminder(db, r, true)
    },
    success: 'Paid — expense recorded',
  })
}
export function noteForm(db: Db, rec?: Note) {
  openForm({
    title: rec ? 'Edit note' : 'New note', initial: rec ? { ...rec } : { tag: 'Personal', pinned: false }, wide: true,
    fields: () => [{ k: 'title', l: 'Title', req: true, full: true }, { k: 'tag', l: 'Tag', t: 'select', req: true, opts: list(['Personal', 'Business', 'Technical', 'Finance', 'Ideas', 'Other']) }, { k: 'pinned', l: 'Pin to top', t: 'check' }, { k: 'content', l: 'Content', t: 'textarea', rows: 10, req: true }],
    onSubmit: (v) => { const row = { title: v.title, tag: v.tag, pinned: !!v.pinned, content: v.content, updated_at: new Date().toISOString() }; return rec ? db.update('notes', rec.id, row) : db.insert('notes', row) },
    success: 'Note saved',
  })
}

/* ---------------- Business ---------------- */
export function businessForm(db: Db, ws: Country, rec?: Business) {
  openForm({
    title: rec ? 'Edit business' : 'Add business', initial: rec ? { ...rec } : {},
    fields: () => [{ k: 'name', l: 'Business name', req: true, full: true }, { k: 'type', l: 'Type', req: true, ph: 'IT services / Trading' }, { k: 'licence', l: 'Licence no. (optional)' }, { k: 'licence_expiry', l: 'Licence expiry', t: 'date' }, { k: 'description', l: 'Description', t: 'textarea', rows: 2 }],
    onSubmit: (v) => { const row = { name: v.name, type: v.type, licence: v.licence || '', licence_expiry: v.licence_expiry, description: v.description || '' }; return rec ? db.update('businesses', rec.id, row) : db.insert('businesses', { ...row, country: ws }) },
    success: 'Business saved',
  })
}
export async function deleteBusiness(db: Db, b: Business) {
  if (!confirm(`Delete "${b.name}" with its invoices & contracts? Bank transactions stay (untagged).`)) return false
  await db.remove('businesses', b.id); await db.refresh(); toast('Business deleted'); return true
}
export function invoiceForm(db: Db, b: Business, rec?: BusinessItem) {
  openForm({
    title: rec ? 'Edit invoice' : 'New invoice', initial: rec ? { ...rec } : { date: today(), due_date: addMonths(today(), 1) },
    fields: () => [{ k: 'number', l: 'Invoice no.', ph: 'INV-001' }, { k: 'client', l: 'Client', req: true }, { k: 'label', l: 'Description', full: true }, { k: 'value', l: `Amount (${WS[b.country].cur})`, t: 'number', req: true }, { k: 'date', l: 'Issued', t: 'date', req: true }, { k: 'due_date', l: 'Due', t: 'date', req: true }],
    validate: (v) => positive(v, 'value'),
    onSubmit: (v) => { const row = { number: v.number || '', client: v.client, label: v.label || v.client, value: v.value, date: v.date, due_date: v.due_date }; return rec ? db.update('business_items', rec.id, row) : db.insert('business_items', { ...row, business_id: b.id, category: 'Invoice', status: 'Unpaid' }) },
    success: 'Invoice saved',
  })
}
export function contractForm(db: Db, b: Business, rec?: BusinessItem) {
  openForm({
    title: rec ? 'Edit contract' : 'New contract / AMC', initial: rec ? { ...rec } : { freq: 'Quarterly', date: today(), next_due: today(), status: 'Active' },
    fields: () => [{ k: 'client', l: 'Client', req: true }, { k: 'label', l: 'Service', ph: 'IT AMC' }, { k: 'value', l: `Amount per period (${WS[b.country].cur})`, t: 'number', req: true }, { k: 'freq', l: 'Billing', t: 'select', req: true, opts: list(['Monthly', 'Quarterly', 'Half-yearly', 'Yearly']) }, { k: 'date', l: 'Start date', t: 'date', req: true }, { k: 'end_date', l: 'End / renewal date', t: 'date' }, { k: 'next_due', l: 'Next collection due', t: 'date', req: true }, { k: 'status', l: 'Status', t: 'select', req: true, opts: list(['Active', 'Paused', 'Ended']) }],
    validate: (v) => positive(v, 'value'),
    onSubmit: (v) => { const row = { client: v.client, label: v.label || 'Contract', value: v.value, freq: v.freq, date: v.date, end_date: v.end_date, next_due: v.next_due, status: v.status }; return rec ? db.update('business_items', rec.id, row) : db.insert('business_items', { ...row, business_id: b.id, category: 'Contract' }) },
    success: 'Contract saved',
  })
}
export function manualEntryForm(db: Db, b: Business, rec?: BusinessItem) {
  openForm({
    title: rec ? 'Edit manual entry' : 'Manual revenue / expense', initial: rec ? { ...rec } : { category: 'Revenue', date: today() },
    info: () => <>For amounts that did <b>not</b> go through a tracked bank account. Money that hit your bank should be added as a transaction tagged with this business instead.</>,
    fields: () => [{ k: 'category', l: 'Type', t: 'select', req: true, opts: list(['Revenue', 'Expense']) }, { k: 'date', l: 'Date', t: 'date', req: true }, { k: 'label', l: 'Description', req: true, full: true }, { k: 'value', l: `Amount (${WS[b.country].cur})`, t: 'number', req: true }, { k: 'notes', l: 'Notes', t: 'textarea', rows: 2 }],
    validate: (v) => positive(v, 'value'),
    onSubmit: (v) => { const row = { category: v.category, date: v.date, label: v.label, value: v.value, notes: v.notes || '' }; return rec ? db.update('business_items', rec.id, row) : db.insert('business_items', { ...row, business_id: b.id }) },
    success: 'Saved',
  })
}
export function collectForm(d: AppData, db: Db, item: BusinessItem) {
  const b = d.businesses.find((x) => x.id === item.business_id)!; const inv = item.category === 'Invoice'
  openForm({
    title: inv ? `Receive payment · ${item.client || item.label}` : `Collect · ${item.client || item.label}`, submitLabel: 'Record receipt',
    initial: { amount: item.value, date: today(), account_id: activeAccounts(d, b.country)[0]?.id },
    info: () => (inv ? <>Creates income in the chosen account and marks the invoice paid.</> : <>Creates income and moves the next due date to {formatDate(addMonths(item.next_due || today(), FREQ_M[item.freq || 'Quarterly'] || 3))}.</>),
    fields: () => [{ k: 'amount', l: `Amount received (${WS[b.country].cur})`, t: 'number', req: true }, { k: 'date', l: 'Received on', t: 'date', req: true }, { k: 'account_id', l: 'Into account', t: 'select', req: true, opts: accOpts(d, b.country) }],
    validate: (v) => positive(v) || (!v.account_id ? 'Add a bank account first.' : null),
    onSubmit: async (v) => {
      const cats = incomeCats(d)
      const [t] = await db.insert<Transaction>('transactions', { country: b.country, type: 'Income', date: v.date, account_id: v.account_id, amount: v.amount, category: inv ? (cats.includes('Business income') ? 'Business income' : cats[0]) : (cats.includes('AMC collection') ? 'AMC collection' : cats[0]), description: `${inv ? 'Invoice ' + (item.number || '') : item.label || 'Contract'} — ${item.client}`.trim(), business_id: b.id, bitem_id: item.id })
      if (inv) await db.update('business_items', item.id, { status: 'Paid', txn_id: t.id, paid_on: v.date })
      else await db.update('business_items', item.id, { next_due: addMonths(item.next_due || today(), FREQ_M[item.freq || 'Quarterly'] || 3) })
    },
    success: 'Receipt recorded',
  })
}
