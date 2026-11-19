import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney } from '../lib/formatters'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'
import type { Transaction, Account, Holding } from '../types/database'

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { country } = useAppStore()
  const money = (n: number) => formatMoney(n, country)

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ['transactions', country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions').select('*').eq('country', country).order('date', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('country', country)
      if (error) throw error
      return data
    },
  })

  const { data: holdings = [] } = useQuery<Holding[]>({
    queryKey: ['holdings', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('holdings').select('*').eq('country', country)
      if (error) throw error
      return data
    },
  })

  const income      = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expenses    = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  const net         = income - expenses
  const bankBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const investValue = holdings.reduce((s, h) => s + h.current_value, 0)

  // Category breakdown
  const catBreakdown = transactions.reduce<Record<string, { income: number; expense: number }>>((acc, t) => {
    if (!acc[t.category]) acc[t.category] = { income: 0, expense: 0 }
    if (t.type === 'Income') acc[t.category].income += t.amount
    else acc[t.category].expense += t.amount
    return acc
  }, {})

  // Monthly summary
  const monthlyMap = transactions.reduce<Record<string, { income: number; expense: number }>>((acc, t) => {
    const key = t.date.slice(0, 7)
    if (!acc[key]) acc[key] = { income: 0, expense: 0 }
    if (t.type === 'Income') acc[key].income += t.amount
    else acc[key].expense += t.amount
    return acc
  }, {})
  const months = Object.keys(monthlyMap).sort().reverse().slice(0, 12)

  function exportTransactions() {
    const header = ['Date', 'Description', 'Category', 'Type', 'Amount', 'Country']
    const rows   = transactions.map(t => [t.date, t.description, t.category, t.type, String(t.amount), t.country])
    downloadCSV([header, ...rows], `personal-os-transactions-${country}-${new Date().toISOString().slice(0,10)}.csv`)
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={`Financial summary for ${country === 'UAE' ? '🇦🇪 UAE · AED' : '🇮🇳 India · INR'} workspace.`}
        action={
          <button className="btn" onClick={exportTransactions}>
            ↓ Export CSV
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
        <KpiCard label="Total income"      value={money(income)}      footColor="income"  foot="All transactions" icon="↗️" />
        <KpiCard label="Total expenses"    value={money(expenses)}    footColor="expense" foot="All transactions" icon="↘️" />
        <KpiCard label="Net cash flow"     value={money(Math.abs(net))} footColor={net >= 0 ? 'income' : 'expense'} foot={net >= 0 ? '↑ Positive' : '↓ Negative'} icon="⚖️" />
        <KpiCard label="Bank balance"      value={money(bankBalance)} foot={`${accounts.length} accounts`} icon="🏦" />
        <KpiCard label="Portfolio value"   value={money(investValue)} foot={`${holdings.length} holdings`} icon="📈" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Monthly breakdown */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly summary</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Last 12 months with data</p>
          </div>
          {isLoading ? (
            <div className="text-center py-10 text-slate-400 text-sm">Loading…</div>
          ) : months.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Month</th>
                    <th className="table-th text-right">Income</th>
                    <th className="table-th text-right">Expense</th>
                    <th className="table-th text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map(m => {
                    const { income: inc, expense: exp } = monthlyMap[m]
                    const n = inc - exp
                    return (
                      <tr key={m} className="table-row">
                        <td className="table-td text-sm font-semibold text-slate-700 dark:text-slate-300">{m}</td>
                        <td className="table-td text-right text-sm text-income font-semibold">+{money(inc)}</td>
                        <td className="table-td text-right text-sm text-expense font-semibold">−{money(exp)}</td>
                        <td className={`table-td text-right text-sm font-bold ${n >= 0 ? 'text-income' : 'text-expense'}`}>
                          {n >= 0 ? '+' : '−'}{money(Math.abs(n))}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        <div className="card">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">By category</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Income & expenses per category</p>
          </div>
          {Object.keys(catBreakdown).length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">No data yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Category</th>
                    <th className="table-th text-right">Income</th>
                    <th className="table-th text-right">Expense</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(catBreakdown)
                    .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
                    .map(([cat, vals]) => (
                      <tr key={cat} className="table-row">
                        <td className="table-td text-sm font-semibold text-slate-700 dark:text-slate-300">{cat}</td>
                        <td className="table-td text-right text-sm">
                          {vals.income > 0 ? <span className="text-income font-semibold">+{money(vals.income)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="table-td text-right text-sm">
                          {vals.expense > 0 ? <span className="text-expense font-semibold">−{money(vals.expense)}</span> : <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
