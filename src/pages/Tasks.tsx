import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { DueBadge, Empty, Kpi, usePage } from '../components/ui'
import { taskForm } from '../lib/forms'
import { daysUntil, formatDate, today } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Tasks() {
  const { d, db } = usePage()
  const [f, setF] = useState<'open' | 'today' | 'done' | 'all'>('open')
  const prio = { High: 0, Medium: 1, Low: 2 }
  let ts = [...d.tasks].sort((a, b) => Number(a.done) - Number(b.done) || a.due_date.localeCompare(b.due_date) || prio[a.priority] - prio[b.priority])
  if (f === 'open') ts = ts.filter((t) => !t.done); if (f === 'today') ts = ts.filter((t) => !t.done && daysUntil(t.due_date) <= 0); if (f === 'done') ts = ts.filter((t) => t.done)
  const open = d.tasks.filter((t) => !t.done)
  const toggle = (id: string, done: boolean) => db.update('tasks', id, { done, done_on: done ? today() : null }).catch((e) => toast(e.message, 'err'))
  return (
    <div>
      <PageHeader title="Tasks" subtitle="Your to-do list." action={<button className="btn-primary" onClick={() => taskForm(db)}>+ Add task</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Open" value={String(open.length)} />
        <Kpi label="Due today / overdue" value={String(open.filter((t) => daysUntil(t.due_date) <= 0).length)} tone={open.some((t) => daysUntil(t.due_date) < 0) ? 'neg' : undefined} />
        <Kpi label="High priority" value={String(open.filter((t) => t.priority === 'High').length)} />
        <Kpi label="Completed" value={String(d.tasks.length - open.length)} />
      </div>
      <div className="card p-5">
        <div className="flex flex-wrap justify-between gap-3 mb-3">
          <div className="flex gap-2">{([['open', 'Open'], ['today', 'Today & overdue'], ['done', 'Done'], ['all', 'All']] as const).map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`btn btn-sm ${f === k ? '!bg-indigo-50 !text-indigo-700 dark:!bg-indigo-900/30 dark:!text-indigo-300' : ''}`}>{l}</button>)}</div>
          <button className="btn btn-sm" onClick={async () => { const done = d.tasks.filter((t) => t.done); if (done.length && confirm(`Delete ${done.length} completed task(s)?`)) { await db.remove('tasks', done.map((t) => t.id)); toast('Cleared') } }}>Clear done</button>
        </div>
        {ts.length === 0 ? <Empty>Nothing here.</Empty> : ts.map((t) => (
          <div key={t.id} className="flex items-start gap-3 py-3 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
            <input type="checkbox" className="mt-1 w-4 h-4 accent-indigo-600" checked={t.done} onChange={(e) => toggle(t.id, e.target.checked)} />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${t.done ? 'line-through text-slate-400' : ''}`}>{t.name}</div>
              <div className="text-xs text-slate-400">{formatDate(t.due_date)} · {t.priority} priority{t.note ? ' · ' + t.note : ''}{t.done && t.done_on ? ' · done ' + formatDate(t.done_on) : ''}</div>
            </div>
            {!t.done && <DueBadge date={t.due_date} />}
            <span className={t.priority === 'High' ? 'badge-red' : t.priority === 'Medium' ? 'badge-amber' : 'badge-slate'}>{t.priority}</span>
            <button className="text-xs text-slate-400 hover:text-indigo-600" onClick={() => taskForm(db, t)}>Edit</button>
            <button className="text-xs text-slate-400 hover:text-red-500" onClick={async () => { if (confirm('Delete this task?')) { await db.remove('tasks', t.id); toast('Deleted') } }}>Delete</button>
          </div>))}
      </div>
    </div>
  )
}
