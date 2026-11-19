import type { Country } from '../types/database'

export const WS: Record<Country, { cur: string; flag: string; label: string; locale: string }> = {
  UAE:   { cur: 'AED', flag: '🇦🇪', label: 'UAE',   locale: 'en-US' },
  INDIA: { cur: 'INR', flag: '🇮🇳', label: 'India', locale: 'en-IN' },
}
export const CURRENCIES: Record<string, string> = { UAE: 'AED', INDIA: 'INR' }
export const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** money maths in integer cents — avoids 0.1 + 0.2 errors */
export const cents = (n: unknown) => Math.round((Number(n) || 0) * 100)
export const r2 = (n: unknown) => cents(n) / 100
export function sum<T>(arr: T[], f: (x: T) => unknown): number {
  return arr.reduce((s, x) => s + cents(f(x)), 0) / 100
}

export function fmtNum(n: number, country: Country) {
  const v = Math.abs(r2(n))
  return new Intl.NumberFormat(WS[country].locale, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v)
}
/** "AED 1,250.50" / "−INR 4,66,200" — keeps the minus sign (old version dropped it) */
export function formatMoney(amount: number, country: Country | string): string {
  const c = (country in WS ? country : 'UAE') as Country
  return (r2(amount) < 0 ? '−' : '') + WS[c].cur + ' ' + fmtNum(amount, c)
}
export function moneyShort(n: number, country: Country) {
  const a = Math.abs(n); let s: string
  if (country === 'INDIA') s = a >= 1e7 ? (a / 1e7).toFixed(1) + 'Cr' : a >= 1e5 ? (a / 1e5).toFixed(1) + 'L' : a >= 1e3 ? (a / 1e3).toFixed(0) + 'k' : a.toFixed(0)
  else s = a >= 1e6 ? (a / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'k' : a.toFixed(0)
  return (n < 0 ? '−' : '') + s
}

/* ---- dates: always LOCAL dates (old code used toISOString = UTC → wrong day before 4am in Dubai) ---- */
const pad = (n: number | string) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const thisMonth = () => today().slice(0, 7)
export function parseD(s: string) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
export function addMonths(s: string, n: number) {
  const d = parseD(s); const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return ymd(d)
}
export const monthAdd = (mk: string, n: number) => addMonths(mk + '-01', n).slice(0, 7)
export const monthEnd = (mk: string) => ymd(new Date(+mk.slice(0, 4), +mk.slice(5), 0))
export const monthLabel = (mk: string) => MON[+mk.slice(5) - 1] + ' ' + mk.slice(0, 4)
export const monthShort = (mk: string) => MON[+mk.slice(5) - 1]

export function formatDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = parseD(s.slice(0, 10)); if (isNaN(d.getTime())) return s
  return `${pad(d.getDate())} ${MON[d.getMonth()]} ${d.getFullYear()}`
}
export function daysUntil(s: string): number { return Math.round((parseD(s.slice(0, 10)).getTime() - parseD(today()).getTime()) / 86400000) }
export function urgencyColor(s: string): 'red' | 'amber' | 'blue' { const d = daysUntil(s); return d < 0 ? 'red' : d <= 3 ? 'amber' : 'blue' }
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
