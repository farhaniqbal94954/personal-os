import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import { Kpi, TxnTable, usePage } from '../components/ui'
import { openForm } from '../components/FormModal'
import { accLabel, csvNum, download, expenseCats, guessCat, incomeCats, normDate, parseCSV, sortTx, txCsvRows, toCSV, wsTxns } from '../lib/finance'
import { txnForm } from '../lib/forms'
import { cents, monthLabel, r2, sum, thisMonth } from '../lib/formatters'
import { toast } from '../store/useAppStore'

export default function Transactions() {
  const { d, db, ws, money } = usePage()
  const [params, setParams] = useSearchParams()
  const accParam = params.get('account') || ''
  const [month, setMonth] = useState(accParam ? '' : thisMonth())
  const [type, setType] = useState('all')
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(200)
  const fileRef = useRef<HTMLInputElement>(null)

  const all = useMemo(() => wsTxns(d, ws).sort(sortTx), [d, ws])
  const months = useMemo(() => { const s = new Set(all.map((t) => t.date.slice(0, 7))); s.add(thisMonth()); return [...s].sort().reverse() }, [all])
  const cats = useMemo(() => [...new Set(all.map((t) => t.category).filter(Boolean) as string[])].sort(), [all])
  const list = all.filter((t) => (!month || t.date.startsWith(month)) && (type === 'all' || t.type === type) && (!accParam || t.account_id === accParam || t.to_account_id === accParam) && (!cat || t.category === cat)
    && (!q || `${t.description} ${t.category} ${accLabel(d, t.account_id)} ${t.amount}`.toLowerCase().includes(q.toLowerCase())))
  const inc = sum(list.filter((t) => t.type === 'Income' && t.country === ws), (t) => t.amount)
  const exp = sum(list.filter((t) => t.type === 'Expense' && t.country === ws), (t) => t.amount)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    f.text().then(importCsv); e.target.value = ''
  }
  function importCsv(txt: string) {
    const rows = parseCSV(txt); if (rows.length < 2) return toast('CSV looks empty', 'err')
    const H = rows[0].map((h) => h.trim().toLowerCase()); const col = (...n: string[]) => H.findIndex((h) => n.some((x) => h === x || h.includes(x)))
    const ci = { date: col('date'), desc: col('description', 'details', 'narration', 'particulars', 'memo'), amt: col('amount'), deb: col('debit', 'withdrawal'), cred: col('credit', 'deposit'), type: col('type'), cat: col('category'), acc: col('account') }
    if (ci.date < 0 || ci.desc < 0 || (ci.amt < 0 && ci.deb < 0 && ci.cred < 0)) return toast('CSV needs columns: date, description, amount (or debit/credit). Found: ' + rows[0].join(', '), 'err')
    const parsed: { date: string; desc: string; amount: number; type: 'Income' | 'Expense'; category: string; acc: string }[] = []; const bad: number[] = []
    rows.slice(1).forEach((r, i) => {
      const date = normDate(r[ci.date]); let amt = NaN; let tp = ci.type >= 0 ? String(r[ci.type]).trim() : ''
      if (ci.amt >= 0) amt = csvNum(r[ci.amt]); else { const db_ = csvNum(r[ci.deb]), cr = csvNum(r[ci.cred]); if (db_ > 0) { amt = db_; tp = tp || 'Expense' } else if (cr > 0) { amt = cr; tp = tp || 'Income' } }
      if (!date || isNaN(amt) || !amt) { bad.push(i + 2); return }
      const type: 'Income' | 'Expense' = /^income$/i.test(tp) ? 'Income' : /^expense$/i.test(tp) ? 'Expense' : amt < 0 ? 'Expense' : 'Income'
      parsed.push({ date, desc: String(r[ci.desc] || '').trim(), amount: r2(Math.abs(amt)), type, category: ci.cat >= 0 ? String(r[ci.cat]).trim() : '', acc: ci.acc >= 0 ? String(r[ci.acc]).trim().toLowerCase() : '' })
    })
    if (!parsed.length) return toast('No valid rows found in the CSV.', 'err')
    const accs = d.accounts.filter((a) => a.country === ws && !a.archived)
    if (!accs.length) return toast('Add a bank account first.', 'err')
    openForm({
      title: `Import ${parsed.length} transactions`, submitLabel: 'Import',
      initial: { account_id: accParam || accs[0].id, skip: true },
      info: () => <>{parsed.length} valid rows{bad.length ? `, ${bad.length} skipped (rows ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''})` : ''}. Income {money(sum(parsed.filter((p) => p.type === 'Income'), (p) => p.amount))} · Expenses {money(sum(parsed.filter((p) => p.type === 'Expense'), (p) => p.amount))}. Categories are guessed from the description — edit later if needed.</>,
      fields: () => [
        { k: 'account_id', l: 'Import into account (if the CSV has no matching account column)', t: 'select', req: true, full: true, opts: accs.map((a) => [a.id, `${a.bank} · ${a.name}`]) },
        { k: 'skip', l: 'Skip rows that already exist (same date, amount & description)', t: 'check' },
      ],
      onSubmit: async (v) => {
        const rowsOut: Record<string, unknown>[] = []; let skipped = 0
        for (const p of parsed) {
          const a = (p.acc && accs.find((x) => `${x.bank} · ${x.name}`.toLowerCase() === p.acc || x.bank.toLowerCase() === p.acc || x.name.toLowerCase() === p.acc)) || accs.find((x) => x.id === v.account_id)!
          const list = p.type === 'Income' ? incomeCats(d) : expenseCats(d)
          const category = list.find((c) => c.toLowerCase() === p.category.toLowerCase()) || p.category || guessCat(d, p.desc, p.type)
          const dup = d.transactions.some((t) => t.account_id === a.id && t.date === p.date && cents(t.amount) === cents(p.amount) && (t.description || '').toLowerCase() === p.desc.toLowerCase())
            || rowsOut.some((t) => t.account_id === a.id && t.date === p.date && cents(t.amount) === cents(p.amount) && String(t.description).toLowerCase() === p.desc.toLowerCase())
          if (v.skip && dup) { skipped++; continue }
          rowsOut.push({ country: a.country, type: p.type, date: p.date, account_id: a.id, amount: p.amount, category, description: p.desc })
        }
        if (rowsOut.length) await db.insert('transactions', rowsOut)
        toast(`Imported ${rowsOut.length}${skipped ? `, skipped ${skipped} duplicates` : ''}`)
      },
    })
  }

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every income, expense, transfer and adjustment."
        action={<div className="flex gap-2"><button className="btn" onClick={() => fileRef.current?.click()}>Import CSV</button><button className="btn" onClick={() => download(`transactions-${ws}-${month || 'all'}.csv`, toCSV(txCsvRows(d, list)))}>Export CSV</button><button className="btn-primary" onClick={() => txnForm(d, db, ws, undefined, accParam ? { account_id: accParam } : {})}>+ Add</button></div>} />
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} data-testid="csv-input" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <Kpi label="Income" value={money(inc)} foot="In current filter" tone="pos" />
        <Kpi label="Expenses" value={money(exp)} foot="In current filter" tone="neg" />
        <Kpi label="Net" value={money(inc - exp)} foot="Transfers excluded" tone={inc - exp >= 0 ? 'pos' : 'neg'} />
        <Kpi label="Entries" value={String(list.length)} foot={month ? monthLabel(month) : 'All time'} />
      </div>
      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input text-sm max-w-[220px]" placeholder="Search…" />
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="input text-sm w-36"><option value="">All months</option>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input text-sm w-36">{['all', 'Income', 'Expense', 'Transfer', 'Adjustment'].map((x) => <option key={x} value={x}>{x === 'all' ? 'All types' : x}</option>)}</select>
          <select value={accParam} onChange={(e) => { const v = e.target.value; setParams(v ? { account: v } : {}) }} className="input text-sm w-52"><option value="">All accounts</option>{d.accounts.filter((a) => a.country === ws).map((a) => <option key={a.id} value={a.id}>{a.bank} · {a.name}</option>)}</select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="input text-sm w-44"><option value="">All categories</option>{cats.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <TxnTable list={list.slice(0, limit)} empty={all.length ? 'No transactions match these filters.' : 'No transactions yet.'} />
        {list.length > limit && <div className="p-4 text-center"><button className="btn" onClick={() => setLimit(limit + 300)}>Show more ({list.length - limit} left)</button></div>}
      </div>
    </div>
  )
}
