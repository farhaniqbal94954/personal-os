import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Task } from '../types/database'

const schema = z.object({
  name:     z.string().min(1, 'Task name required'),
  due_date: z.string().min(1, 'Due date required'),
  priority: z.enum(['Low', 'Medium', 'High']),
})
type TaskForm = z.infer<typeof schema>

type Filter = 'all' | 'pending' | 'completed'

export default function Tasks() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const today = new Date().toISOString().split('T')[0]

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').order('due_date').order('created_at')
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<TaskForm>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'Medium', due_date: today },
  })

  const addMutation = useMutation({
    mutationFn: async (form: TaskForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('tasks').insert({ user_id: session.user.id, done: false, ...form })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks'] }); reset({ priority: 'Medium', due_date: today }); setOpen(false) },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from('tasks').update({ done }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const filtered = tasks.filter(t => {
    if (filter === 'pending')   return !t.done
    if (filter === 'completed') return t.done
    return true
  })

  const pending   = tasks.filter(t => !t.done).length
  const completed = tasks.filter(t =>  t.done).length

  const priorityBadge = (p: string) =>
    p === 'High' ? 'badge-red' : p === 'Medium' ? 'badge-amber' : 'badge-slate'

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Your personal and professional to-do list."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add task</button>}
      />

      {/* Stats strip */}
      <div className="flex flex-wrap gap-3 mb-5">
        {(['all','pending','completed'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {f === 'all' ? `All (${tasks.length})` : f === 'pending' ? `Pending (${pending})` : `Completed (${completed})`}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="card">
        {isLoading ? (
          <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <span className="text-4xl">{filter === 'completed' ? '🎉' : '✅'}</span>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {filter === 'completed' ? 'No completed tasks yet.' : filter === 'pending' ? 'All done! No pending tasks.' : 'No tasks yet.'}
            </p>
            {filter !== 'completed' && (
              <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>+ Add task</button>
            )}
          </div>
        ) : (
          <div>
            {filtered.map(t => (
              <div
                key={t.id}
                className={`flex items-start gap-4 px-5 py-4 border-b border-slate-50 dark:border-slate-700/40 last:border-0 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-700/20 ${t.done ? 'opacity-60' : ''}`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleMutation.mutate({ id: t.id, done: !t.done })}
                  className="mt-1 w-4 h-4 rounded accent-indigo-600 cursor-pointer shrink-0"
                />
                {/* Priority dot */}
                <div className={`mt-2 w-2 h-2 rounded-full shrink-0 ${
                  t.priority === 'High' ? 'bg-red-500' :
                  t.priority === 'Medium' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
                }`} />
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold text-slate-800 dark:text-slate-200 ${t.done ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                    {t.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{formatDate(t.due_date)}</div>
                </div>
                {/* Badge + delete */}
                <div className="flex items-center gap-2 shrink-0">
                  {t.done
                    ? <span className="badge badge-blue">Done</span>
                    : <span className={`badge ${priorityBadge(t.priority)}`}>{t.priority}</span>
                  }
                  <button
                    onClick={() => { if (confirm('Delete this task?')) deleteMutation.mutate(t.id) }}
                    className="text-xs text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors ml-1"
                  >✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset({ priority: 'Medium', due_date: today }) }} title="Add task">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Task name</label>
            <input {...register('name')} className="input" placeholder="Follow up with client" autoFocus />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Due date</label>
              <input {...register('due_date')} type="date" className="input" />
              {errors.due_date && <p className="text-xs text-red-500 mt-1">{errors.due_date.message}</p>}
            </div>
            <div>
              <label className="label">Priority</label>
              <select {...register('priority')} className="input">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset({ priority: 'Medium', due_date: today }) }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
