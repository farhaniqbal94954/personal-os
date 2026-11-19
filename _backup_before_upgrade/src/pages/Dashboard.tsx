import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney, formatDate } from '../lib/formatters'
import KpiCard from '../components/KpiCard'
import PageHeader from '../components/PageHeader'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import type { Account, Transaction, Holding, Task } from '../types/database'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Dashboard() {
  const { country } = useAppStore()
  const money = (n: number) => formatMoney(n, country)

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['accounts', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('accounts').select('*').eq('country', country).order('bank')
      if (error) throw error
      return data
    },
  })

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions', country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions').select('*').eq('country', country)
        .order('date', { ascending: false }).limit(200)
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

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('done', false)
        .order('due_date').limit(8)
      if (error) throw error
      return data
    },
  })

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const income       = transactions.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0)
  const expenses     = transactions.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0)
  const investValue  = holdings.reduce((s, h) => s + h.current_value, 0)
  const recentTx     = transactions.slice(0, 5)

  // Cash-flow chart: last 6 months
  const now = new Date()
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const slice = transactions.filter(t => t.date.startsWith(prefix))
    return {
      month: MONTHS[d.getMonth()],
      Income:  slice.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0),
      Expense: slice.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0),
    }
  })

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${country === 'UAE' ? '🇦🇪 UAE · AED' : '🇮🇳 India · INR'} — a clear view of your finances and priorities.`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard label="Total bank balance"    value={money(totalBalance)} foot={`${accounts.length} accounts`} icon="🏦" />
        <KpiCard label="Income this month"     value={money(income)}    footColor="income"  foot="↑ from transactions" icon="↗️" />
        <KpiCard label="Expenses this month"   value={money(expenses)}  footColor="expense" foot="↓ from transactions" icon="↘️" />
        <KpiCard label="Investment portfolio"  value={money(investValue)} foot={`${holdings.length} holdings`} icon="📈" />
      </div>

      {/* Chart + Accounts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
        {/* Cash flow chart */}
        <div className="card p-5 xl:col-span-3">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cash flow</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Income & expenses — last 6 months</p>
          </div>
          {transactions.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-slate-400">
              Add transactions to see your cash flow chart.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={3} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.07} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b', border: 'none', borderRadius: 10,
                    color: '#f1f5f9', fontSize: 12, padding: '8px 12px',
                  }}
                  cursor={{ fill: 'rgba(99,102,241,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
                <Bar dataKey="Income"  fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Expense" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bank accounts mini */}
        <div className="card p-5 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bank accounts</h3>
            <Link to="/accounts" className="btn btn-sm text-xs">View all →</Link>
          </div>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">No accounts yet.</p>
              <Link to="/accounts" className="btn-primary btn-sm">+ Add account</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-sm shrink-0">🏦</div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{a.bank}</div>
                      <div className="text-xs text-slate-400">{a.name}</div>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 shrink-0">{money(a.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent transactions + Tasks */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Recent transactions */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent transactions</h3>
            <Link to="/transactions" className="btn btn-sm text-xs">View all →</Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400 dark:text-slate-500 mb-3">No transactions yet.</p>
              <Link to="/transactions" className="btn-primary btn-sm">+ Add transaction</Link>
            </div>
          ) : (
            <div>
              {recentTx.map(t => (
                <div key={t.id} className="flex items-center justify-between gap-3 py-3 border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.description}</div>
                    <div className="text-xs text-slate-400">{formatDate(t.date)} · {t.category}</div>
                  </div>
                  <span className={`text-sm font-bold shrink-0 ${t.type === 'Income' ? 'text-income' : 'text-expense'}`}>
                    {t.type === 'Income' ? '+' : '−'}{money(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today's priorities</h3>
            <Link to="/tasks" className="btn btn-sm text-xs">All tasks →</Link>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-sm text-slate-400 dark:text-slate-500">All caught up! No pending tasks.</p>
            </div>
          ) : (
            <div>
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-start gap-3 py-3 border-b border-slate-50 dark:border-slate-700/40 last:border-0">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    t.priority === 'High' ? 'bg-red-500' :
                    t.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{t.name}</div>
                    <div className="text-xs text-slate-400">{formatDate(t.due_date)} · {t.priority} priority</div>
                  </div>
                  <span className={`badge ${
                    t.priority === 'High' ? 'badge-red' :
                    t.priority === 'Medium' ? 'badge-amber' : 'badge-slate'
                  }`}>{t.priority}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
