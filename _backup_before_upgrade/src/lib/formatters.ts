export const CURRENCIES: Record<string, string> = {
  UAE: 'AED',
  INDIA: 'INR',
}

export function formatMoney(amount: number, country: string): string {
  const currency = CURRENCIES[country] ?? 'AED'
  const hasDecimals = amount % 1 !== 0
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return `${currency} ${formatted}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function urgencyColor(dateStr: string): 'red' | 'amber' | 'blue' {
  const d = daysUntil(dateStr)
  if (d < 0) return 'red'
  if (d <= 3) return 'amber'
  return 'blue'
}
