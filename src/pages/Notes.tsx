import { useState } from 'react'
import PageHeader from '../components/PageHeader'
import { Empty, usePage } from '../components/ui'
import { noteForm } from '../lib/forms'
import { formatDate, ymd } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Notes() {
  const { d, db } = usePage()
  const [q, setQ] = useState(''); const [tag, setTag] = useState('')
  const tags = [...new Set(d.notes.map((n) => n.tag))]
  const ns = d.notes.filter((n) => (!tag || n.tag === tag) && `${n.title} ${n.content}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at))
  return (
    <div>
      <PageHeader title="Notes" subtitle="Ideas and information." action={<button className="btn-primary" onClick={() => noteForm(db)}>+ New note</button>} />
      <div className="flex flex-wrap gap-2 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input max-w-xs text-sm" placeholder="Search notes…" />
        {['', ...tags].map((t) => <button key={t} onClick={() => setTag(t)} className={`btn btn-sm ${tag === t ? '!bg-indigo-50 !text-indigo-700 dark:!bg-indigo-900/30 dark:!text-indigo-300' : ''}`}>{t || 'All'}</button>)}
      </div>
      {ns.length === 0 ? <div className="card"><Empty action={<button className="btn-primary btn-sm" onClick={() => noteForm(db)}>+ New note</button>}>{d.notes.length ? 'No notes match.' : 'No notes yet.'}</Empty></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {ns.map((n) => (
            <div key={n.id} className="card p-5 flex flex-col">
              <div className="flex justify-between gap-2 mb-2"><h3 className="font-bold">{n.pinned ? '📌 ' : ''}{n.title}</h3><span className="badge-slate shrink-0">{n.tag}</span></div>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap flex-1 max-h-48 overflow-y-auto">{n.content}</p>
              <div className="flex justify-between items-center mt-3 text-xs text-slate-400"><span>{formatDate(ymd(new Date(n.updated_at || n.created_at)))}</span>
                <span><button className="hover:text-indigo-600 mr-3" onClick={() => noteForm(db, n)}>Edit</button><button className="hover:text-red-500" onClick={async () => { if (confirm('Delete this note?')) { await db.remove('notes', n.id); toast('Deleted') } }}>Delete</button></span></div>
            </div>))}
        </div>)}
    </div>
  )
}
