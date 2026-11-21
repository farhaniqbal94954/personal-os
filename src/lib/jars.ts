/* Safety Jars — reserve part of a bank balance for a purpose. Money never leaves the account. */
import type { Account, AppData, Country, Jar } from '../types/database'
import { activeAccounts, avgExpense, balanceNow, monthIE, suggestions, type Suggestion } from './finance'
import { cents, daysUntil, formatDate, formatMoney, monthAdd, parseD, r2, sum, thisMonth, today } from './formatters'

export const ACCOUNT_PURPOSES: [string, string][] = [['Daily', '💳 Daily spending'], ['Savings', '🏦 Savings'], ['Business', '🏢 Business / company'], ['Other', '• Other']]
export const purposeLabel = (p: string | null | undefined) => ACCOUNT_PURPOSES.find((x) => x[0] === p)?.[1] || ''

export interface JarTemplate { key: string; name: string; icon: string; kind: 'money' | 'protection'; target_mode: 'fixed' | 'months'; target_months?: number; hint: string; core?: boolean }
export const JAR_TEMPLATES: JarTemplate[] = [
  { key: 'starter', name: 'Starter emergency fund', icon: '🚨', kind: 'money', target_mode: 'months', target_months: 1, hint: '1 month of expenses — your first safety net.', core: true },
  { key: 'health', name: 'Health insurance', icon: '🏥', kind: 'protection', target_mode: 'fixed', hint: 'You and your family — UAE and India.', core: true },
  { key: 'life', name: 'Life insurance (term)', icon: '🛡️', kind: 'protection', target_mode: 'fixed', hint: 'About 10× yearly income if family depends on you.', core: true },
  { key: 'full', name: 'Full emergency fund', icon: '🧯', kind: 'money', target_mode: 'months', target_months: 6, hint: '6–9 months of expenses. Expats: job loss affects your visa.', core: true },
  { key: 'yearly', name: 'Yearly big costs', icon: '📅', kind: 'money', target_mode: 'fixed', hint: 'Car insurance, school fees, flights home, renewals.', core: true },
  { key: 'debt', name: 'Clear credit card debt', icon: '💳', kind: 'money', target_mode: 'fixed', hint: 'Save to pay off high-interest debt in full.' },
  { key: 'hajj', name: 'Hajj / Umrah', icon: '🕋', kind: 'money', target_mode: 'fixed', hint: 'Plan the journey without borrowing.' },
  { key: 'edu', name: "Children's education", icon: '🎓', kind: 'money', target_mode: 'fixed', hint: 'School and university fees.' },
  { key: 'home', name: 'Home down payment', icon: '🏠', kind: 'money', target_mode: 'fixed', hint: 'Deposit for a home in UAE or India.' },
  { key: 'car', name: 'Car replacement', icon: '🚗', kind: 'money', target_mode: 'fixed', hint: 'Buy the next car in cash.' },
  { key: 'custom', name: '', icon: '🫙', kind: 'money', target_mode: 'fixed', hint: 'Any goal you want to protect.' },
]
export const JAR_ICONS = ['🚨', '🧯', '🏥', '🛡️', '📅', '💳', '🕋', '🎓', '🏠', '🚗', '✈️', '💍', '👶', '🎁', '💻', '🫙']

export const wsJars = (d: AppData, ws: Country) => d.jars.filter((j) => j.country === ws && !j.archived).sort((a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at))

/** reserved money per account for one jar (only accounts with a non-zero amount) */
export function jarByAccount(d: AppData, jar: Jar): { account: Account; amount: number }[] {
  const m = new Map<string, number>()
  d.jar_allocations.filter((x) => x.jar_id === jar.id).forEach((x) => m.set(x.account_id, (m.get(x.account_id) || 0) + cents(x.amount)))
  return [...m.entries()].filter(([, c]) => c !== 0).map(([id, c]) => ({ account: d.accounts.find((a) => a.id === id)!, amount: c / 100 })).filter((x) => x.account)
}
export const jarSaved = (d: AppData, jar: Jar) => sum(d.jar_allocations.filter((x) => x.jar_id === jar.id), (x) => x.amount)
export const jarInAccount = (d: AppData, jarId: string, accountId: string) => sum(d.jar_allocations.filter((x) => x.jar_id === jarId && x.account_id === accountId), (x) => x.amount)

/** money reserved by ALL jars inside one account */
export const reservedIn = (d: AppData, accountId: string) => sum(d.jar_allocations.filter((x) => x.account_id === accountId), (x) => x.amount)
/** balance you can spend without touching jar money */
export const freeIn = (d: AppData, a: Account) => r2(balanceNow(d, a) - reservedIn(d, a.id))
/** jars that hold money in this account, e.g. [{name:'Emergency', amount: 10000}] */
export function jarsInAccount(d: AppData, accountId: string) {
  return d.jars.map((j) => ({ jar: j, amount: jarInAccount(d, j.id, accountId) })).filter((x) => x.amount !== 0)
}
export const reservedTotal = (d: AppData, ws: Country) => sum(d.accounts.filter((a) => a.country === ws), (a) => reservedIn(d, a.id))

/** average monthly expenses (last 3 full months, falls back to this month) */
export function expenseBase(d: AppData, ws: Country) {
  const avg = avgExpense(d, ws, 3)
  return avg > 0 ? r2(avg) : monthIE(d, ws, thisMonth()).exp
}
export function jarTarget(d: AppData, jar: Jar): { target: number; auto: boolean; base: number } {
  if (jar.kind === 'protection') return { target: 0, auto: false, base: 0 }
  if (jar.target_mode === 'months' && jar.target_months) {
    const base = expenseBase(d, jar.country)
    if (base > 0) return { target: Math.round(base * jar.target_months), auto: true, base }
  }
  return { target: jar.target_amount || 0, auto: false, base: 0 }
}
export function jarProgress(d: AppData, jar: Jar) {
  if (jar.kind === 'protection') return jar.covered ? 1 : 0
  const { target } = jarTarget(d, jar); const saved = jarSaved(d, jar)
  return target > 0 ? Math.max(0, Math.min(1, saved / target)) : saved > 0 ? 1 : 0
}
export const jarComplete = (d: AppData, jar: Jar) => jarProgress(d, jar) >= 0.9999

export const LEVELS = ['Not started', 'Starting', 'Building', 'Steady', 'Strong', 'Rock solid']
export function safetyScore(d: AppData, ws: Country) {
  const jars = wsJars(d, ws)
  if (!jars.length) return { score: 0, level: 0, levelName: LEVELS[0], next: undefined as Jar | undefined, done: 0, total: 0 }
  const score = Math.round((jars.reduce((s, j) => s + jarProgress(d, j), 0) / jars.length) * 100)
  const level = score >= 100 ? 5 : score >= 75 ? 4 : score >= 50 ? 3 : score >= 25 ? 2 : score > 0 ? 1 : 0
  return { score, level, levelName: LEVELS[level], next: jars.find((j) => !jarComplete(d, j)), done: jars.filter((j) => jarComplete(d, j)).length, total: jars.length }
}

/** average money left over per month (income − expenses, last 3 months) */
export function avgSurplus(d: AppData, ws: Country) {
  let s = 0; for (let i = 1; i <= 3; i++) { const x = monthIE(d, ws, monthAdd(thisMonth(), -i)); s += x.inc - x.exp }
  return s / 3
}
function monthsBetween(from: string, to: string) { const a = parseD(from), b = parseD(to); return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() >= a.getDate() ? 0 : -1) }
/** a one-line plan: how much per month, or how long at your usual surplus */
export function jarPlan(d: AppData, jar: Jar): string | null {
  if (jar.kind === 'protection') return null
  const { target } = jarTarget(d, jar); const left = r2(target - jarSaved(d, jar)); const money = (n: number) => formatMoney(n, jar.country)
  if (target <= 0 || left <= 0) return null
  if (jar.target_date) {
    const m = monthsBetween(today(), jar.target_date)
    if (m <= 0) return daysUntil(jar.target_date) < 0 ? `Target date passed — ${money(left)} still to go.` : `Add ${money(left)} this month to reach the target.`
    return `Add ${money(Math.ceil(left / m))}/month to be full by ${formatDate(jar.target_date)}.`
  }
  const sp = avgSurplus(d, jar.country)
  if (sp > 0) { const m = Math.ceil(left / sp); return `At your usual surplus (${money(Math.round(sp))}/month) — full in about ${m} month${m > 1 ? 's' : ''}.` }
  return `${money(left)} to go. Set a target date to get a monthly plan.`
}

/** all dashboard tips + jar tips, most urgent first */
export function allSuggestions(d: AppData, ws: Country): Suggestion[] {
  const out = suggestions(d, ws); const money = (n: number) => formatMoney(n, ws)
  const add = (lvl: Suggestion['lvl'], title: string, text: string, to = '/jars') => out.push({ lvl, title, text, to })
  activeAccounts(d, ws).forEach((a) => {
    const res = reservedIn(d, a.id); const bal = balanceNow(d, a)
    if (res > 0 && bal < res) add('red', `Jar money touched in ${a.bank} · ${a.name}`, `${money(res)} is reserved for jars but the balance is ${money(bal)}. Refill ${money(res - bal)} or release it from a jar.`)
  })
  const jars = wsJars(d, ws)
  if (!jars.length && activeAccounts(d, ws).length) add('blue', 'Build your safety base', 'Create jars for an emergency fund and insurance — the money stays in your bank, jars just reserve it.')
  const sc = safetyScore(d, ws)
  if (sc.next) {
    const j = sc.next
    if (j.kind === 'protection') add('amber', `${j.icon} ${j.name} — not covered yet`, j.priority <= 3 ? 'This is one of your first safety steps. Add the policy details once you are covered.' : 'Add the policy details once you are covered.')
    else { const left = jarTarget(d, j).target - jarSaved(d, j); if (left > 0) add('blue', `Fill next: ${j.icon} ${j.name}`, `${money(left)} to go. ${jarPlan(d, j) || ''}`) }
    // unassigned savings could go into the next jar
    const freeSavings = sum(activeAccounts(d, ws).filter((a) => a.purpose === 'Savings'), (a) => Math.max(0, freeIn(d, a)))
    if (j.kind === 'money' && freeSavings > 0) add('blue', `${money(freeSavings)} in savings is not in any jar`, `Reserve part of it for ${j.name}.`)
  } else if (jars.length) add('green', 'Safety base complete 🎉', 'Every jar is full and covered. New savings can go to long-term investing.', '/investments')
  jars.filter((j) => j.kind === 'protection' && j.covered && j.renewal_date && daysUntil(j.renewal_date) <= 30 && !j.reminder_id)
    .forEach((j) => add(daysUntil(j.renewal_date!) < 0 ? 'red' : 'amber', `${j.name} renewal ${daysUntil(j.renewal_date!) < 0 ? 'overdue' : 'soon'}`, `Renews ${formatDate(j.renewal_date)}${j.provider ? ' · ' + j.provider : ''}.`))
  const order = { red: 0, amber: 1, blue: 2, green: 3 }
  return out.sort((a, b) => order[a.lvl] - order[b.lvl])
}
