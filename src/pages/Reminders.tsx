import PageHeader from '../components/PageHeader'
import { DueBadge, Empty, Kpi, usePage } from '../components/ui'
import { completeReminder, payReminderForm, reminderForm } from '../lib/forms'
import { daysUntil, formatDate, sum } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Reminders() {
  const { d, db, ws, money } = usePage()
  const rs = d.reminders.filter((r) => r.country === ws && r.status !== 'Done').sort((a, b) => a.due_date.localeCompare(b.due_date))
  const done = d.reminders.filter((r) => r.country === ws && r.status === 'Done').sort((a, b) => (b.done_on || '').localeCompare(a.done_on || ''))
  const monthly = sum(rs, (r) => (r.amount || 0) / (r.repeat === 'monthly' ? 1 : r.repeat === 'quarterly' ? 3 : r.repeat === 'yearly' ? 12 : Infinity))
  const del = async (id: string) => { if (confirm('Delete this reminder?')) { await db.remove('reminders', id); toast('Deleted') } }
  return (
    <div>
      <PageHeader title="Reminders" subtitle="Bills, renewals and recurring payments. Pay records the expense and moves the next due date." action={<button className="btn-primary" onClick={() => reminderForm(d, db, ws)}>+ Add reminder</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Upcoming" value={String(rs.length)} />
        <Kpi label="Overdue" value={String(rs.filter((r) => daysUntil(r.due_date) < 0).length)} tone={rs.some((r) => daysUntil(r.due_date) < 0) ? 'neg' : undefined} />
        <Kpi label="Due in 7 days" value={money(sum(rs.filter((r) => daysUntil(r.due_date) <= 7), (r) => r.amount || 0))} foot="Amount to pay" />
        <Kpi label="Recurring bills / month" value={money(monthly)} foot="Average of repeating bills" />
      </div>
      <div className="card overflow-x-auto mb-5">
        <table className="w-full">
          <thead><tr>{['Reminder', 'Due', 'Repeats', 'Amount', 'Status', ''].map((h, i) => <th key={i} className={`table-th ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {rs.length === 0 ? <tr><td colSpan={6}><Empty action={<button className="btn-primary btn-sm" onClick={() => reminderForm(d, db, ws)}>+ Add reminder</button>}>No upcoming reminders.</Empty></td></tr> : rs.map((r) => (
              <tr key={r.id} className="table-row">
                <td className="table-td"><div className="font-semibold">{r.name}</div><div className="text-xs text-slate-400">{r.detail}</div></td>
                <td className="table-td whitespace-nowrap">{formatDate(r.due_date)}</td>
                <td className="table-td">{r.repeat === 'none' ? '—' : r.repeat}</td>
                <td className="table-td text-right">{r.amount ? money(r.amount) : '—'}</td>
                <td className="table-td"><DueBadge date={r.due_date} /></td>
                <td className="table-td text-right text-xs whitespace-nowrap">
                  {r.amount ? <button className="btn-primary btn-sm mr-2" onClick={() => payReminderForm(d, db, r)}>Pay</button> : null}
                  <button className="text-slate-500 hover:text-indigo-600 mr-3" onClick={() => completeReminder(db, r).catch((e) => toast(e.message, 'err'))}>{r.repeat !== 'none' ? 'Skip / done' : 'Done'}</button>
                  <button className="text-slate-400 hover:text-indigo-600 mr-3" onClick={() => reminderForm(d, db, ws, r)}>Edit</button>
                  <button className="text-slate-400 hover:text-red-500" onClick={() => del(r.id)}>Delete</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {done.length > 0 && <div className="card p-5"><h3 className="text-sm font-bold mb-2">Completed</h3>{done.slice(0, 10).map((r) => (
        <div key={r.id} className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0 text-sm">
          <span className="text-slate-400">{r.name} · done {formatDate(r.done_on)}</span>
          <span className="text-xs"><button className="text-slate-500 hover:text-indigo-600 mr-3" onClick={() => db.update('reminders', r.id, { status: 'Upcoming', done_on: null })}>Restore</button><button className="text-slate-400 hover:text-red-500" onClick={() => del(r.id)}>Delete</button></span>
        </div>))}</div>}
    </div>
  )
}
