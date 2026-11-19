import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatMoney } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Project } from '../types/database'

const schema = z.object({
  name:   z.string().min(1, 'Project name required'),
  budget: z.coerce.number().min(0),
  spent:  z.coerce.number().min(0),
  status: z.enum(['Active', 'In progress', 'Completed', 'On hold']),
})
type ProjectForm = z.infer<typeof schema>

const STATUS_COLORS: Record<string, string> = {
  'Active':      'badge-blue',
  'In progress': 'badge-indigo',
  'Completed':   'badge-blue',
  'On hold':     'badge-amber',
}

export default function Projects() {
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const money = (n: number) => formatMoney(n, country)

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', country],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('country', country).order('name')
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProjectForm>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'Active', budget: 0, spent: 0 },
  })

  const addMutation = useMutation({
    mutationFn: async (form: ProjectForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('projects').insert({ user_id: session.user.id, country, ...form })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); reset(); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  const totalBudget = projects.reduce((s, p) => s + p.budget, 0)
  const totalSpent  = projects.reduce((s, p) => s + p.spent, 0)

  return (
    <div>
      <PageHeader
        title="Projects & Budgets"
        subtitle="Track project budgets and spending progress."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ New project</button>}
      />

      {/* Summary */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Projects</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{projects.length}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Total budget</span>
            <span className="text-sm font-black text-slate-800 dark:text-slate-200">{money(totalBudget)}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Spent</span>
            <span className="text-sm font-black text-expense">{money(totalSpent)}</span>
          </div>
          <div className="card px-4 py-2.5 flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Remaining</span>
            <span className="text-sm font-black text-income">{money(totalBudget - totalSpent)}</span>
          </div>
        </div>
      )}

      {/* Project cards */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="text-4xl">📋</span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No projects yet.</p>
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>+ New project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const pct  = p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0
            const over = p.spent > p.budget
            return (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight">{p.name}</h4>
                  <span className={`badge ${STATUS_COLORS[p.status] ?? 'badge-slate'} shrink-0`}>{p.status}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mb-2">
                  <span>Spent <strong className="text-slate-700 dark:text-slate-300">{money(p.spent)}</strong></span>
                  <span>Budget <strong className="text-slate-700 dark:text-slate-300">{money(p.budget)}</strong></span>
                </div>
                <div className="progress-track mb-2">
                  <div className={over ? 'progress-fill-red' : 'progress-fill'} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span className={over ? 'text-expense font-semibold' : ''}>{pct.toFixed(1)}% used</span>
                  <span className={over ? 'text-expense font-semibold' : 'text-income font-semibold'}>
                    {over ? `−${money(p.spent - p.budget)} over` : `${money(p.budget - p.spent)} left`}
                  </span>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => { if (confirm(`Delete project "${p.name}"?`)) deleteMutation.mutate(p.id) }}
                    className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                  >Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset() }} title="New project">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Project name</label>
            <input {...register('name')} className="input" placeholder="Home renovation" />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Total budget ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input {...register('budget')} type="number" className="input" min="0" step="0.01" />
              {errors.budget && <p className="text-xs text-red-500 mt-1">{errors.budget.message}</p>}
            </div>
            <div>
              <label className="label">Already spent ({country === 'UAE' ? 'AED' : 'INR'})</label>
              <input {...register('spent')} type="number" className="input" min="0" step="0.01" />
              {errors.spent && <p className="text-xs text-red-500 mt-1">{errors.spent.message}</p>}
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option>Active</option>
              <option>In progress</option>
              <option>Completed</option>
              <option>On hold</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset() }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
