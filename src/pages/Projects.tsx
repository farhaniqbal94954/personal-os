import PageHeader from '../components/PageHeader'
import { Empty, Kpi, Progress, TxnTable, usePage } from '../components/ui'
import { projSpent, sortTx } from '../lib/finance'
import { deleteProject, projectForm, txnForm } from '../lib/forms'
import { formatDate, pct, sum } from '../lib/formatters'
import { useState } from 'react'
import Modal from '../components/Modal'

export default function Projects() {
  const { d, db, ws, money } = usePage()
  const [hist, setHist] = useState<string | null>(null)
  const ps = d.projects.filter((p) => p.country === ws)
  const tb = sum(ps, (p) => p.budget), ts = sum(ps, (p) => projSpent(d, p))
  const hp = ps.find((p) => p.id === hist)
  return (
    <div>
      <PageHeader title="Projects & Budgets" subtitle="Budgets for big goals — fed automatically by expenses you tag with the project." action={<button className="btn-primary" onClick={() => projectForm(db, ws)}>+ Add project</button>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Kpi label="Total budget" value={money(tb)} foot={`${ps.length} projects`} />
        <Kpi label="Spent" value={money(ts)} foot={`${pct(ts, tb)}% of budget`} />
        <Kpi label="Remaining" value={money(tb - ts)} tone={tb - ts < 0 ? 'neg' : 'pos'} />
        <Kpi label="Active" value={String(ps.filter((p) => p.status !== 'Completed').length)} foot="Not completed" />
      </div>
      {ps.length === 0 ? <div className="card"><Empty action={<button className="btn-primary btn-sm" onClick={() => projectForm(db, ws)}>+ Add project</button>}>No projects yet.</Empty></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ps.map((p) => { const sp = projSpent(d, p); const n = d.transactions.filter((t) => t.project_id === p.id).length; return (
            <div key={p.id} className="card p-5">
              <div className="flex justify-between items-start gap-2 mb-3"><h3 className="font-bold">{p.name}</h3><span className={p.status === 'Completed' ? 'badge bg-emerald-100 text-emerald-700' : p.status === 'On hold' ? 'badge-amber' : 'badge-blue'}>{p.status}</span></div>
              <div className="flex justify-between text-xs mb-1"><span>{money(sp)} spent</span><span className="text-slate-400">of {money(p.budget)}</span></div>
              <Progress value={sp} max={p.budget} />
              <p className="text-xs text-slate-400 mt-2">{pct(sp, p.budget)}% used · {money(p.budget - sp)} left · {n} tagged expense{n !== 1 ? 's' : ''}{p.manual_spent ? ` + ${money(p.manual_spent)} earlier` : ''}{p.deadline ? ` · due ${formatDate(p.deadline)}` : ''}</p>
              {p.note && <p className="text-xs mt-2">{p.note}</p>}
              <div className="flex gap-3 mt-4 text-xs items-center">
                <button className="btn btn-sm" onClick={() => txnForm(d, db, ws, undefined, { type: 'Expense', project_id: p.id, category: 'Project expense' })}>+ Expense</button>
                <button className="text-slate-500 hover:text-indigo-600" onClick={() => setHist(p.id)}>History</button>
                <button className="text-slate-500 hover:text-indigo-600" onClick={() => projectForm(db, ws, p)}>Edit</button>
                <button className="text-slate-400 hover:text-red-500" onClick={() => deleteProject(db, p)}>Delete</button>
              </div>
            </div>) })}
        </div>)}
      <Modal open={!!hp} onClose={() => setHist(null)} title={`History · ${hp?.name || ''}`} wide>
        <TxnTable list={d.transactions.filter((t) => t.project_id === hist).sort(sortTx)} empty="No tagged expenses yet." />
      </Modal>
    </div>
  )
}
