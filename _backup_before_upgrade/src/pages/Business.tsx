import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import { formatDate } from '../lib/formatters'
import Modal from '../components/Modal'
import PageHeader from '../components/PageHeader'
import type { Business } from '../types/database'

const schema = z.object({
  name:        z.string().min(1, 'Business name required'),
  type:        z.string().min(1, 'Type required'),
  description: z.string().optional(),
})
type BusinessForm = z.infer<typeof schema>

const BUSINESS_TYPES = [
  'IT & Networking', 'Trading', 'Retail', 'Real Estate', 'Freelance / Consulting',
  'Manufacturing', 'Services', 'E-commerce', 'F&B', 'Other',
]

export default function Business() {
  const { country } = useAppStore()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: businesses = [], isLoading } = useQuery<Business[]>({
    queryKey: ['businesses', country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses').select('*').eq('country', country).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BusinessForm>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'IT & Networking' },
  })

  const addMutation = useMutation({
    mutationFn: async (form: BusinessForm) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) throw new Error('Not authenticated')
      const { error } = await supabase.from('businesses').insert({
        user_id: session.user.id, country,
        name: form.name, type: form.type, description: form.description ?? '',
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['businesses'] }); reset(); setOpen(false) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Also delete all items for this business
      await supabase.from('business_items').delete().eq('business_id', id)
      const { error } = await supabase.from('businesses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['businesses'] }),
  })

  return (
    <div>
      <PageHeader
        title="Business Hub"
        subtitle="All your businesses in one place. Add any business you operate."
        action={<button className="btn-primary" onClick={() => setOpen(true)}>+ Add business</button>}
      />

      {/* Info notice */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl px-5 py-4 mb-6 text-sm text-indigo-700 dark:text-indigo-300">
        <strong>How it works:</strong> Add each business you own. Click a business to open its detail page where you can track revenue, expenses, contracts, invoices — anything.
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : businesses.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center gap-4">
          <span className="text-5xl">🏢</span>
          <div>
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">No businesses yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Add your first business to start tracking it.</p>
          </div>
          <button className="btn-primary" onClick={() => setOpen(true)}>+ Add business</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {businesses.map(b => (
            <Link
              key={b.id}
              to={`/business/${b.id}`}
              className="card p-6 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-150 group block"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-2xl shrink-0">
                  🏢
                </div>
                <span className="badge badge-indigo">{b.type}</span>
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                {b.name}
              </h3>
              {b.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{b.description}</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <span className="text-xs text-slate-400">{formatDate(b.created_at)}</span>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                  Open →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Delete buttons — rendered separately to avoid Link conflict */}
      {businesses.length > 0 && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 mb-3 uppercase tracking-wide">Manage businesses</p>
          <div className="flex flex-wrap gap-2">
            {businesses.map(b => (
              <button
                key={b.id}
                onClick={() => { if (confirm(`Delete "${b.name}" and all its records?`)) deleteMutation.mutate(b.id) }}
                className="btn btn-sm text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-200 dark:hover:border-red-800"
              >
                Delete "{b.name}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add modal */}
      <Modal open={open} onClose={() => { setOpen(false); reset() }} title="Add business">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
          <div>
            <label className="label">Business name</label>
            <input {...register('name')} className="input" placeholder="Cloud Computers" autoFocus />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Business type</label>
            <select {...register('type')} className="input">
              {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea {...register('description')} className="input min-h-[80px] resize-y" placeholder="Brief description of what this business does…" />
          </div>
          {addMutation.isError && <p className="text-xs text-red-500">Failed to save. Try again.</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn" onClick={() => { setOpen(false); reset() }}>Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="btn-primary">
              {addMutation.isPending ? 'Saving…' : 'Add business'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
