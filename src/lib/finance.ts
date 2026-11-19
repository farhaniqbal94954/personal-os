import type { Account, AppData, Business, BusinessItem, Country, Project, Reminder, Transaction } from '../types/database'
import { DEFAULT_EXPENSE, DEFAULT_INCOME } from './data'
import { addMonths, cents, daysUntil, formatDate, formatMoney, monthAdd, monthEnd, monthLabel, pct, r2, sum, thisMonth, today, WS } from './formatters'

export const ACC_TYPES = ['Savings', 'Current', 'Salary', 'Business', 'Credit card', 'Cash', 'Wallet', 'Deposit'] as const
export const HOLD_TYPES = ['Mutual fund', 'Stocks', 'ETF', 'Gold', 'Deposit', 'Bonds', 'Crypto', 'Real estate', 'Pension', 'Other']
export const FREQ_M: Record<string, number> = { Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Yearly: 12 }

export const incomeCats = (d: AppData) => d.settings.income_categories?.length ? d.settings.income_categories : DEFAULT_INCOME
export const expenseCats = (d: AppData) => d.settings.expense_categories?.length ? d.settings.expense_categories : DEFAULT_EXPENSE

export const accById = (d: AppData, id: string | null | undefined) => (id ? d.accounts.find((a) => a.id === id) : undefined)
export const accCountry = (d: AppData, id: string | null | undefined) => accById(d, id)?.country
export const accLabel = (d: AppData, id: string | null | undefined) => { const a = accById(d, id); return a ? `${a.bank} · ${a.name}` : '(deleted account)' }
export const activeAccounts = (d: AppData, ws: Country) => d.accounts.filter((a) => a.country === ws && !a.archived)
export const isFlow = (t: Transaction) => t.type === 'Income' || t.type === 'Expense'
export const sortTx = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || (b.created_at || '').localeCompare(a.created_at || '')

/**
 * THE balance rule (same everywhere):
 *   balance = opening_balance + every transaction dated ON or AFTER opening_date
 *   Income/Adjustment(+/−) add · Expense subtracts · Transfer moves money from account_id to to_account_id
 * Returns null when asked for a date before the account existed.
 */
export function accBalance(d: AppData, a: Account, upTo?: string): number | null {
  const from = a.opening_date || '0000'
  if (upTo && upTo < from) return null
  let b = cents(a.opening_balance)
  for (const t of d.transactions) {
    if (t.date < from || (upTo && t.date > upTo)) continue
    if (t.account_id === a.id) {
      if (t.type === 'Income' || t.type === 'Adjustment') b += cents(t.amount)
      else b -= cents(t.amount) // Expense, Transfer out
    }
    if (t.type === 'Transfer' && t.to_account_id === a.id) b += cents(t.to_amount ?? t.amount)
  }
  return b / 100
}
export const balanceNow = (d: AppData, a: Account) => accBalance(d, a) ?? 0
export function bankTotal(d: AppData, ws: Country) { return sum(d.accounts.filter((a) => a.country === ws), (a) => balanceNow(d, a)) }
export function bankTotalAt(d: AppData, ws: Country, upTo: string): number | null {
  const vals = d.accounts.filter((a) => a.country === ws).map((a) => accBalance(d, a, upTo)).filter((v): v is number => v !== null)
  return vals.length ? sum(vals, (v) => v) : null
}
export const investTotal = (d: AppData, ws: Country) => sum(d.holdings.filter((h) => h.country === ws), (h) => h.current_value)
export const investedTotal = (d: AppData, ws: Country) => sum(d.holdings.filter((h) => h.country === ws), (h) => h.invested)

/** transactions visible in a workspace (incl. transfers arriving from the other country) */
export const wsTxns = (d: AppData, ws: Country) =>
  d.transactions.filter((t) => t.country === ws || (t.type === 'Transfer' && t.to_account_id && accCountry(d, t.to_account_id) === ws))
/** real income & expenses only — transfers, investments and adjustments are NOT income/expense */
export const flows = (d: AppData, ws: Country, mk?: string) => d.transactions.filter((t) => t.country === ws && isFlow(t) && (!mk || t.date.startsWith(mk)))
export function monthIE(d: AppData, ws: Country, mk: string) {
  const f = flows(d, ws, mk)
  return { inc: sum(f.filter((t) => t.type === 'Income'), (t) => t.amount), exp: sum(f.filter((t) => t.type === 'Expense'), (t) => t.amount) }
}
export function avgExpense(d: AppData, ws: Country, months = 3) {
  let tot = 0
  for (let i = 1; i <= months; i++) tot += monthIE(d, ws, monthAdd(thisMonth(), -i)).exp
  return tot / months
}
export function catTotals(d: AppData, ws: Country, mk: string, type: 'Income' | 'Expense' = 'Expense') {
  const o: Record<string, number> = {}
  flows(d, ws, mk).filter((t) => t.type === type).forEach((t) => { const c = t.category || 'Uncategorised'; o[c] = r2((o[c] || 0) + t.amount) })
  return o
}
export const projSpent = (d: AppData, p: Project) => r2((p.manual_spent || 0) + sum(d.transactions.filter((t) => t.project_id === p.id && t.type === 'Expense'), (t) => t.amount))

/** signed amount as seen from one workspace; 0 for a transfer between two accounts of the same workspace */
export function txnSigned(d: AppData, t: Transaction, ws: Country): number {
  if (t.type === 'Income' || t.type === 'Adjustment') return t.amount
  if (t.type === 'Expense') return -t.amount
  const fromHere = !!t.account_id && accCountry(d, t.account_id) === ws
  const toHere = !!t.to_account_id && accCountry(d, t.to_account_id) === ws
  if (fromHere && toHere) return 0
  if (fromHere) return -t.amount
  if (toHere) return t.to_amount ?? t.amount
  if (t.holding_id) return t.kind === 'buy' ? -t.amount : t.amount
  return 0
}
export function txnCurrencyCountry(d: AppData, t: Transaction, ws: Country): Country {
  if (t.type === 'Transfer' && t.to_account_id && accCountry(d, t.to_account_id) === ws && accCountry(d, t.account_id) !== ws) return ws
  return t.country
}
export function beforeStart(d: AppData, t: Transaction) {
  const a = accById(d, t.account_id) || accById(d, t.to_account_id)
  return !!a && t.date < a.opening_date
}

export const nextDue = (r: Pick<Reminder, 'due_date' | 'repeat'>) => addMonths(r.due_date, r.repeat === 'monthly' ? 1 : r.repeat === 'quarterly' ? 3 : 12)

export function bizStats(d: AppData, b: Business) {
  const tx = d.transactions.filter((t) => t.business_id === b.id)
  const items = d.business_items.filter((i) => i.business_id === b.id)
  const y = String(new Date().getFullYear())
  // manual entries (no bank account) + legacy paid invoices that have no linked transaction
  const manualRev = items.filter((i) => i.category === 'Revenue' || (i.category === 'Invoice' && i.status === 'Paid' && !i.txn_id))
  const manualExp = items.filter((i) => i.category === 'Expense')
  const rev = sum(tx.filter((t) => t.type === 'Income'), (t) => t.amount) + sum(manualRev, (i) => i.value)
  const exp = sum(tx.filter((t) => t.type === 'Expense'), (t) => t.amount) + sum(manualExp, (i) => i.value)
  const ytdR = sum(tx.filter((t) => t.type === 'Income' && t.date.startsWith(y)), (t) => t.amount) + sum(manualRev.filter((i) => (i.paid_on || i.date).startsWith(y)), (i) => i.value)
  const ytdE = sum(tx.filter((t) => t.type === 'Expense' && t.date.startsWith(y)), (t) => t.amount) + sum(manualExp.filter((i) => i.date.startsWith(y)), (i) => i.value)
  const recv = sum(items.filter((i) => i.category === 'Invoice' && i.status !== 'Paid'), (i) => i.value)
  const contracts = items.filter((i) => i.category === 'Contract' && i.status === 'Active')
  const annual = sum(contracts, (c) => (c.value * 12) / (FREQ_M[c.freq || 'Yearly'] || 12))
  return { tx, items, rev: r2(rev), exp: r2(exp), ytdR: r2(ytdR), ytdE: r2(ytdE), recv, contracts, annual, manualRev, manualExp }
}

export interface Upcoming { name: string; sub: string; due: string; to: string }
export function upcomingItems(d: AppData, ws: Country, days: number): Upcoming[] {
  const out: Upcoming[] = []
  d.reminders.filter((r) => r.country === ws && r.status !== 'Done' && daysUntil(r.due_date) <= days)
    .forEach((r) => out.push({ name: r.name, sub: (r.amount ? formatMoney(r.amount, ws) + ' · ' : '') + (r.repeat !== 'none' ? r.repeat : 'one-time'), due: r.due_date, to: '/reminders' }))
  const bs = d.businesses.filter((b) => b.country === ws)
  d.business_items.forEach((i: BusinessItem) => {
    const b = bs.find((x) => x.id === i.business_id); if (!b) return
    if (i.category === 'Invoice' && i.status !== 'Paid' && i.due_date && daysUntil(i.due_date) <= days) out.push({ name: `Invoice — ${i.client || i.label}`, sub: 'Receivable · ' + formatMoney(i.value, ws), due: i.due_date, to: `/business/${b.id}` })
    if (i.category === 'Contract' && i.status === 'Active' && i.next_due && daysUntil(i.next_due) <= days) out.push({ name: `Collect — ${i.client || i.label}`, sub: `${i.freq} · ${formatMoney(i.value, ws)}`, due: i.next_due, to: `/business/${b.id}` })
  })
  bs.forEach((b) => { if (b.licence_expiry && daysUntil(b.licence_expiry) <= days) out.push({ name: `Licence — ${b.name}`, sub: 'Renewal', due: b.licence_expiry, to: `/business/${b.id}` }) })
  return out.sort((a, b) => a.due.localeCompare(b.due))
}

/* ================= Smart suggestions — rule based, runs in the browser, no AI cost ================= */
export interface Suggestion { lvl: 'red' | 'amber' | 'blue' | 'green'; title: string; text: string; to?: string; action?: string }
export function suggestions(d: AppData, ws: Country): Suggestion[] {
  const out: Suggestion[] = []; const money = (n: number) => formatMoney(n, ws)
  const add = (lvl: Suggestion['lvl'], title: string, text: string, to?: string) => out.push({ lvl, title, text, to })
  const accs = activeAccounts(d, ws)
  if (!accs.length) { add('blue', 'Add your bank accounts', "Add each account with today's balance from your bank app. Every transaction then updates it automatically.", '/accounts'); return out }

  accs.forEach((a) => {
    const b = balanceNow(d, a)
    if (a.type === 'Credit card') { if (b < 0) add('amber', `Credit card due: ${money(-b)}`, `${a.bank} ${a.name}. Pay the full statement amount before the due date to avoid interest (often 3%+ per month).`, '/accounts') }
    else if (b < 0) add('red', `${a.bank} · ${a.name} is negative (${money(b)})`, 'A transaction may be on the wrong account, or the starting balance is wrong. Use Reconcile to match your bank app.', '/accounts')
  })
  const stale = accs.filter((a) => a.type !== 'Cash' && (!a.last_reconciled || daysUntil(a.last_reconciled) < -30))
  if (stale.length) add('blue', `Reconcile ${stale.length} account${stale.length > 1 ? 's' : ''} with your bank`, 'Not checked in 30+ days. Bank accounts → Reconcile → type the real balance; the app records the difference.', '/accounts')

  const rem = d.reminders.filter((r) => r.country === ws && r.status !== 'Done')
  const over = rem.filter((r) => daysUntil(r.due_date) < 0)
  if (over.length) add('red', `${over.length} overdue reminder${over.length > 1 ? 's' : ''}`, over.slice(0, 3).map((r) => r.name).join(', '), '/reminders')
  const soon = rem.filter((r) => { const n = daysUntil(r.due_date); return n >= 0 && n <= 7 && (r.amount || 0) > 0 })
  if (soon.length) {
    const amt = sum(soon, (r) => r.amount); const avail = sum(accs.filter((a) => a.type !== 'Credit card'), (a) => balanceNow(d, a))
    add(amt > avail ? 'red' : 'amber', `${money(amt)} of bills due in 7 days`, soon.map((r) => `${r.name} (${formatDate(r.due_date)})`).join(', ') + (amt > avail ? ' — more than your available balance!' : ''), '/reminders')
  }

  const m = thisMonth(); const { inc, exp } = monthIE(d, ws, m)
  if (inc > 0) {
    const rate = Math.round(((inc - exp) / inc) * 100); const tgt = d.settings.savings_target
    if (rate < 0) add('red', 'Spending more than earning this month', `Expenses ${money(exp)} vs income ${money(inc)}. Check the biggest categories.`, '/reports')
    else if (rate < tgt) add('amber', `Savings rate ${rate}% (target ${tgt}%)`, `To reach ${tgt}% you would need to spend about ${money(exp - inc * (1 - tgt / 100))} less this month.`, '/budgets')
    else add('green', `Great — you are saving ${rate}% of income this month`, `You kept ${money(inc - exp)}. Move it to savings or investments early ("pay yourself first").`)
  } else if (exp > 0 && new Date().getDate() > 7) add('amber', 'No income recorded this month', `${money(exp)} of expenses but no income yet for ${monthLabel(m)}.`, '/transactions')

  const cats = catTotals(d, ws, m)
  Object.entries(cats).forEach(([c, v]) => {
    let avg = 0; for (let i = 1; i <= 3; i++) avg += catTotals(d, ws, monthAdd(m, -i))[c] || 0; avg /= 3
    if (avg > 0 && v > avg * 1.3 && v - avg > (ws === 'INDIA' ? 2000 : 200)) add('amber', `${c} is ${Math.round((v / avg - 1) * 100)}% above normal`, `${money(v)} this month vs ${money(avg)} 3-month average.`, '/reports')
  })
  const dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  d.budgets.filter((b) => b.country === ws).forEach((b) => {
    const sp = cats[b.category] || 0
    if (sp > b.monthly_limit) add('red', `Budget exceeded: ${b.category}`, `${money(sp)} spent of ${money(b.monthly_limit)} (${pct(sp, b.monthly_limit)}%).`, '/budgets')
    else if (sp >= b.monthly_limit * 0.8) add('amber', `Budget almost used: ${b.category}`, `${pct(sp, b.monthly_limit)}% used, ${dim - new Date().getDate()} days left.`, '/budgets')
  })

  const avgE = avgExpense(d, ws, 3)
  const liquid = sum(accs.filter((a) => !['Credit card', 'Deposit'].includes(a.type)), (a) => balanceNow(d, a))
  if (avgE > 0) {
    const need = avgE * d.settings.emergency_months; const months = (liquid / avgE).toFixed(1)
    if (liquid < need) add('amber', `Emergency fund covers ${months} months`, `Aim for ${d.settings.emergency_months} months of expenses ≈ ${money(need)}. Gap: ${money(need - liquid)}.`)
    else if (liquid > need * 1.5) add('blue', `${money(liquid - need)} may be idle cash`, `You hold ${months} months of expenses in bank accounts. Money above your ${d.settings.emergency_months}-month buffer could go into a deposit or your investment plan.`, '/investments')
  }

  const hs = d.holdings.filter((h) => h.country === ws); const tv = sum(hs, (h) => h.current_value); const tg = d.settings.targets[ws] || {}
  if (tv > 0) Object.entries(tg).forEach(([type, tp]) => {
    const ap = (sum(hs.filter((h) => h.type === type), (h) => h.current_value) / tv) * 100
    if (Math.abs(ap - tp) >= 10) add('blue', `Allocation drift: ${type} ${ap.toFixed(0)}% vs target ${tp}%`, ap > tp ? 'Over-weight — send new money to other assets instead of selling.' : 'Under-weight — new investments could go here first.', '/investments')
  })
  const oldH = hs.filter((h) => !h.updated_on || daysUntil(h.updated_on) < -30)
  if (oldH.length) add('blue', `Update ${oldH.length} investment value${oldH.length > 1 ? 's' : ''}`, 'Values are older than 30 days, so your net worth may be out of date.', '/investments')

  const bs = d.businesses.filter((b) => b.country === ws); const items = d.business_items.filter((i) => bs.some((b) => b.id === i.business_id))
  const od = items.filter((i) => i.category === 'Invoice' && i.status !== 'Paid' && i.due_date && daysUntil(i.due_date) < 0)
  if (od.length) add('red', `${od.length} overdue invoice${od.length > 1 ? 's' : ''} · ${money(sum(od, (i) => i.value))}`, od.slice(0, 3).map((i) => i.client || i.label).join(', ') + ' — follow up.', '/business')
  const col = items.filter((i) => i.category === 'Contract' && i.status === 'Active' && i.next_due && daysUntil(i.next_due) <= 7)
  if (col.length) add('amber', `${col.length} contract collection${col.length > 1 ? 's' : ''} due`, col.slice(0, 3).map((i) => `${i.client || i.label} (${formatDate(i.next_due)})`).join(', '), '/business')
  bs.filter((b) => b.licence_expiry && daysUntil(b.licence_expiry) <= 45).forEach((b) => add(daysUntil(b.licence_expiry!) < 0 ? 'red' : 'amber', `Licence renewal: ${b.name}`, `Expires ${formatDate(b.licence_expiry)}.`, `/business/${b.id}`))
  d.projects.filter((p) => p.country === ws && p.status !== 'Completed' && projSpent(d, p) > p.budget).forEach((p) => add('red', `Project over budget: ${p.name}`, `${money(projSpent(d, p))} spent of ${money(p.budget)}.`, '/projects'))

  const order = { red: 0, amber: 1, blue: 2, green: 3 }
  return out.sort((a, b) => order[a.lvl] - order[b.lvl])
}

/* ================= CSV ================= */
const GUESS: [RegExp, string][] = [[/salary|payroll|wps/i, 'Salary'], [/carrefour|lulu|grocery|supermarket|spinneys|union coop|bigbasket|dmart|blinkit|zepto/i, 'Food & groceries'], [/restaurant|cafe|talabat|zomato|swiggy|deliveroo|noon food|kfc|mcdonald|starbucks/i, 'Dining out'], [/adnoc|enoc|eppco|fuel|petrol|salik|uber|careem|metro|rta|ola|nol/i, 'Transport & fuel'], [/dewa|sewa|addc|fewa|electric|water|bescom|gas/i, 'Utilities'], [/etisalat|\be&|\bdu\b|airtel|jio|vodafone|internet|mobile recharge/i, 'Internet & mobile'], [/rent|ejari/i, 'Rent'], [/pharmacy|hospital|clinic|medical|aster|apollo/i, 'Healthcare'], [/insurance|lic\b|premium/i, 'Insurance'], [/amazon|noon|flipkart|myntra|mall|shop/i, 'Shopping'], [/netflix|spotify|cinema|vox|youtube|prime video/i, 'Entertainment'], [/emi|loan/i, 'Loan / EMI'], [/fee|charge|commission|vat|gst/i, 'Fees & charges'], [/interest/i, 'Interest'], [/refund|reversal|cashback/i, 'Refund']]
export function guessCat(d: AppData, desc: string, type: 'Income' | 'Expense') {
  const list = type === 'Income' ? incomeCats(d) : expenseCats(d)
  for (const [re, c] of GUESS) if (re.test(desc) && list.includes(c)) return c
  return type === 'Income' ? (list.includes('Other income') ? 'Other income' : list[list.length - 1]) : (list.includes('Other expense') ? 'Other expense' : list[list.length - 1])
}
export function parseCSV(txt: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false; txt = txt.replace(/^﻿/, '')
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i]
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}
const MONS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
export function normDate(s: string): string | null {
  s = String(s).trim(); let m: RegExpMatchArray | null; const p = (x: string | number) => String(x).padStart(2, '0')
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${p(m[2])}-${p(m[3])}`
  if ((m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/))) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${p(m[2])}-${p(m[1])}`
  if ((m = s.match(/^(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{2,4})/))) { const mi = MONS.indexOf(m[2].toLowerCase()); if (mi >= 0) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${p(mi + 1)}-${p(m[1])}` }
  return null
}
export const csvNum = (s: string) => { let v = String(s ?? '').replace(/[^\d.\-()]/g, ''); if (/^\(.*\)$/.test(v)) v = '-' + v.slice(1, -1); return v === '' ? NaN : Number(v) }
export function toCSV(rows: (string | number | null | undefined)[][]) {
  const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n')
}
export function download(name: string, content: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function txCsvRows(d: AppData, list: Transaction[]) {
  const rows: (string | number | null)[][] = [['Date', 'Type', 'Description', 'Category', 'Account', 'To account', 'Amount', 'Currency', 'Project', 'Business']]
  list.forEach((t) => rows.push([t.date, t.type, t.description, t.category, t.account_id ? accLabel(d, t.account_id) : (d.holdings.find((h) => h.id === t.holding_id)?.name || ''), t.to_account_id ? accLabel(d, t.to_account_id) : (t.type === 'Transfer' ? d.holdings.find((h) => h.id === t.holding_id)?.name || '' : ''), t.amount, WS[t.country].cur, d.projects.find((p) => p.id === t.project_id)?.name || '', d.businesses.find((b) => b.id === t.business_id)?.name || '']))
  return rows
}
export { monthEnd, today }
