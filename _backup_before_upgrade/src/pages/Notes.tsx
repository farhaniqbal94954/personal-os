import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Note } from '../types/database'

const schema = z.object({
  title:   z.string().min(1, 'Title required'),
  content: z.string().min(1, 'Content required'),
  tag:     z.enum(['Personal', 'Business', 'Technical', 'Other']),
})
type NoteForm = z.infer<typeof schema>

const TAG_COLORS: Record<string, string> = {
  Personal:  'badge-blue',
  Business:  'badge-indigo',
  Technical: 'badge-amber',
  Other:     'badge-slate',
}

export default function Notes() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewNote, setViewNote] = useState<Note | null>(null)
  const [tagFilter, setTagFilter] = useState<string>('all')

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ['notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NoteForm>({
    resolver: zodResolver(schema),
    defaultValues: { tag: 'Personal' },
  })

  const addMutation = useMutation({
    mutationFn: async (form: NoteForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('notes').insert({ user_id: session.user.id, ...form })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); reset(); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); setViewNote(null) },
  })

  const tags = ['all', ...Array.from(new Set(notes.map(n => n.tag)))]
  const filtered = tagFilter === 'all' ? notes : notes.filter(n => n.tag === tagFilter)

  return (
    <div>
      <PageHeader
        title="Notes"
        subtitle="Ideas, technical references, and personal records."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ New note</button>}
      />

      {/* Tag filter */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {tags.map(t => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors capitalize ${
                tagFilter === t
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {t === 'all' ? `All (${notes.length})` : t}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
          <span className="text-4xl">📝</span>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No notes yet.</p>
          <button className="btn-primary btn-sm" onClick={() => setOpen(true)}>+ New note</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(n => (
            <div
              key={n.id}
              onClick={() => setViewNote(n)}
              className="card p-5 cursor-pointer hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-150 group"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className={`badge ${TAG_COLORS[n.tag] ?? 'badge-slate'}`}>{n.tag}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(n.created_at)}</span>
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                {n.title}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">
                {n.content}
              </p>
              <div className="mt-4 text-xs text-indigo-500 dark:text-indigo-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                Click to open →
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset() }} title="New note" wide>
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input {...register('title')} className="input" placeholder="Network improvement ideas" autoFocus />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <label className="label">Tag</label>
            <select {...register('tag')} className="input">
              <option>Personal</option>
              <option>Business</option>
              <option>Technical</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="label">Content</label>
            <textarea {...register('content')} className="input min-h-[140px] resize-y" placeholder="Write your note here…" />
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset() }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={!!viewNote} onClose={() => setViewNote(null)} title={viewNote?.title ?? ''} wide>
        {viewNote && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className={`badge ${TAG_COLORS[viewNote.tag] ?? 'badge-slate'}`}>{viewNote.tag}</span>
              <span className="text-xs text-slate-400">{formatDate(viewNote.created_at)}</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{viewNote.content}</p>
            <div className="flex justify-between items-center pt-6 mt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => { if (confirm('Delete this note?')) deleteMutation.mutate(viewNote.id) }}
                className="btn-danger btn-sm"
              >Delete note</button>
              <button className="btn" onClick={() => setViewNote(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
