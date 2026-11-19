import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { usePage } from '../components/ui'
import { DEFAULT_EXPENSE, DEFAULT_INCOME } from '../lib/data'
import { download, expenseCats, incomeCats } from '../lib/finance'
import { today } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Settings() {
  const { d, db } = usePage()
  const s = d.settings
  const [fx, setFx] = useState(String(s.fx_aed_inr))
  const [em, setEm] = useState(String(s.emergency_months))
  const [st, setSt] = useState(String(s.savings_target))
  const [ic, setIc] = useState(incomeCats(d).join(', '))
  const [ec, setEc] = useState(expenseCats(d).join(', '))
  const [busy, setBusy] = useState(false)
  async function save() {
    const split = (x: string) => [...new Set(x.split(',').map((y) => y.trim()).filter(Boolean))]
    if (!(Number(fx) > 0)) return toast('Exchange rate must be greater than 0', 'err')
    setBusy(true)
    try { await db.saveSettings({ fx_aed_inr: Number(fx), emergency_months: Math.max(1, Math.round(Number(em) || 6)), savings_target: Math.max(0, Math.min(100, Math.round(Number(st) || 20))), income_categories: split(ic), expense_categories: split(ec) }); toast('Settings saved') }
    catch (e) { toast((e as Error).message, 'err') } finally { setBusy(false) }
  }
  const counts = { Accounts: d.accounts.length, Transactions: d.transactions.length, Investments: d.holdings.length, Projects: d.projects.length, Budgets: d.budgets.length, Tasks: d.tasks.length, Reminders: d.reminders.length, Notes: d.notes.length, Businesses: d.businesses.length, 'Invoices & contracts': d.business_items.length }
  return (
    <div>
      <PageHeader title="Settings" subtitle="Preferences, categories and data export." />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold">Preferences</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="label">1 AED = ? INR</label><input className="input" type="number" step="0.01" value={fx} onChange={(e) => setFx(e.target.value)} /><p className="text-[11px] text-slate-400 mt-1">Only for the "both countries" net worth.</p></div>
            <div><label className="label">Emergency fund (months)</label><input className="input" type="number" value={em} onChange={(e) => setEm(e.target.value)} /></div>
            <div><label className="label">Savings target (%)</label><input className="input" type="number" value={st} onChange={(e) => setSt(e.target.value)} /></div>
          </div>
          <div><label className="label">Income categories (comma separated)</label><textarea className="input" rows={3} value={ic} onChange={(e) => setIc(e.target.value)} /><button className="text-xs text-slate-400 hover:text-indigo-600 mt-1" onClick={() => setIc(DEFAULT_INCOME.join(', '))}>Reset to defaults</button></div>
          <div><label className="label">Expense categories (comma separated)</label><textarea className="input" rows={4} value={ec} onChange={(e) => setEc(e.target.value)} /><button className="text-xs text-slate-400 hover:text-indigo-600 mt-1" onClick={() => setEc(DEFAULT_EXPENSE.join(', '))}>Reset to defaults</button></div>
          <div className="flex justify-end"><button className="btn-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </div>
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold">Your data</h3>
          <p className="text-sm text-slate-500">Stored in your Supabase project and protected by Row-Level Security — only your login can read it. Supabase free projects pause after a week without activity; download a backup now and then.</p>
          <div className="grid grid-cols-2 gap-2 text-sm">{Object.entries(counts).map(([k, v]) => <div key={k} className="flex justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900"><span className="text-slate-500">{k}</span><b>{v}</b></div>)}</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => { download(`personal-os-backup-${today()}.json`, JSON.stringify(d, null, 1), 'application/json'); toast('Backup downloaded') }}>Download full backup (.json)</button>
            <button className="btn" onClick={() => { db.refresh(); toast('Reloaded from Supabase') }}>Reload data</button>
          </div>
        </div>
      </div>
    </div>
  )
}
