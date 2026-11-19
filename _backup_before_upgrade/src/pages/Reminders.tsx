import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Reminder } from '../types/database'

const schema = z.object({
  name:     z.string().min(1, 'Title required'),
  detail:   z.string().min(1, 'Detail required'),
  due_date: z.string().min(1, 'Date required'),
})
type ReminderForm = z.infer<typeof schema>

export default function Reminders() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const { data: reminders = [], isLoading } = useQuery<Reminder[]>({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders').select('*').eq('status', 'Upcoming').order('due_date')
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ReminderForm>({
    resolver: zodResolver(schema),
    defaultValues: { due_date: today },
  })

  const addMutation = useMutation({
    mutationFn: async (form: ReminderForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('reminders').insert({ user_id: session.user.id, status: 'Upcoming', ...form })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reminders'] }); reset({ due_date: today }); setOpen(false) },
  })

  const doneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').update({ status: 'Done' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })

  const overdue  = reminders.filter(r => daysUntil(r.due_date) < 0)
  const dueSoon  = reminders.filter(r => { const d = daysUntil(r.due_date); return d >= 0 && d <= 3 })
  const upcoming = reminders.filter(r => daysUntil(r.due_date) > 3)

  function urgencyBadge(due_date: string) {
    const d = daysUntil(due_date)
    if (d < 0)  return <span className="badge badge-red">Overdue</span>
    if (d === 0) return <span className="badge badge-red">Due today</span>
    if (d <= 3) return <span className="badge badge-amber">Due in {d} days</span>
    return <span className="badge badge-blue">Upcoming</span>
  }

  function ReminderRow({ r }: { r: Reminder }) {
    const d = daysUntil(r.due_date)
    const isOverdue = d < 0
    return (
      <div className={`flex items-center gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-700/40 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors ${isOverdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${d < 0 ? 'bg-red-500' : d <= 3 ? 'bg-amber-500' : 'bg-blue-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{r.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{r.detail} · {formatDate(r.due_date)}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {urgencyBadge(r.due_date)}
          <button
            onClick={() => doneMutation.mutate(r.id)}
            disabled={doneMutation.isPending}
            className="btn btn-sm text-xs"
          >✓ Done</button>
          <button
            onClick={() => { if (confirm('Delete reminder?')) deleteMutation.mutate(r.id) }}
            className="text-xs text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >✕</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Reminders"
        subtitle="Payments, renewals, collections, and upcoming deadlines."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add reminder</button>}
      />

      {/* Stats */}
      <div className="flex flex-wrap gap-3 mb-5">
        {overdue.length  > 0 && <div className="card px-4 py-2.5"><span className="badge badge-red mr-2">{overdue.length}</span><span className="text-xs font-semibold text-slate-500">Overdue</span></div>}
        {dueSoon.length  > 0 && <div className="card px-4 py-2.5"><span className="badge badge-amber mr-2">{dueSoon.length}</span><span className="text-xs font-semibold text-slate-500">Due soon (≤3 days)</span></div>}
        {upcoming.length > 0 && <div className="card px-4 py-2.5"><span className="badge badge-blue mr-2">{upcoming.length}</span><span className="text-xs font-semibold text-slate-500">Upcoming</span></div>}
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
        ) : reminders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">🔔</span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No upcoming reminders.</p>
            <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>+ Add reminder</button>
          </div>
        ) : (
          <>
            {overdue.length > 0 && (
              <div>
                <div className="px-5 py-2 bg-red-50 dark:bg-red-900/10 border-b border-red-100 dark:border-red-900/20">
                  <span className="text-xs font-black text-red-500 uppercase tracking-widest">⚠ Overdue</span>
                </div>
                {overdue.map(r => <ReminderRow key={r.id} r={r} />)}
              </div>
            )}
            {dueSoon.length > 0 && (
              <div>
                <div className="px-5 py-2 bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-900/20">
                  <span className="text-xs font-black text-amber-500 uppercase tracking-widest">Due soon</span>
                </div>
                {dueSoon.map(r => <ReminderRow key={r.id} r={r} />)}
              </div>
            )}
            {upcoming.length > 0 && (
              <div>
                {(overdue.length > 0 || dueSoon.length > 0) && (
                  <div className="px-5 py-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Upcoming</span>
                  </div>
                )}
                {upcoming.map(r => <ReminderRow key={r.id} r={r} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset({ due_date: today }) }} title="Add reminder">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input {...register('name')} className="input" placeholder="Trade licence renewal" autoFocus />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Detail</label>
            <input {...register('detail')} className="input" placeholder="Document expires · AED 2,500 fee" />
            {errors.detail && <p className="text-xs text-red-500 mt-1">{errors.detail.message}</p>}
          </div>
          <div>
            <label className="label">Due date</label>
            <input {...register('due_date')} type="date" className="input" />
            {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset({ due_date: today }) }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save reminder'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
