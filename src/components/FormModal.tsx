import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import Modal from './Modal'
import { r2 } from '../lib/formatters'
import { toast } from '../store/useAppStore'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Vals = Record<string, any>
export interface Field {
  k: string; l: string
  t?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'check'
  req?: boolean
  opts?: [string, string][]
  blank?: string            // adds an empty first option ("— None —")
  show?: boolean            // false = hidden
  hint?: ReactNode
  ph?: string; max?: number; full?: boolean; rows?: number; step?: string
  resets?: string[]         // when this field changes, clear these
}
export interface FormSpec {
  title: string
  initial: Vals
  fields: (v: Vals) => Field[]
  info?: (v: Vals) => ReactNode
  validate?: (v: Vals) => string | null
  onSubmit: (v: Vals) => Promise<unknown> | unknown
  submitLabel?: string
  success?: string
  wide?: boolean
}

interface FormStore { spec: FormSpec | null; key: number; open: (s: FormSpec) => void; close: () => void }
export const useFormStore = create<FormStore>((set) => ({
  spec: null, key: 0,
  open: (spec) => set((s) => ({ spec, key: s.key + 1 })),
  close: () => set({ spec: null }),
}))
export const openForm = (s: FormSpec) => useFormStore.getState().open(s)

/** fills required selects that have no valid value with their first option (2 passes: options can depend on other values) */
function normalize(spec: FormSpec, v: Vals): Vals {
  const out = { ...v }
  for (let pass = 0; pass < 2; pass++) {
    spec.fields(out).filter((f) => f.show !== false).forEach((f) => {
      if (f.t === 'select' && f.req && f.blank === undefined && f.opts?.length && !f.opts.find((o) => o[0] === String(out[f.k] ?? ''))) out[f.k] = f.opts[0][0]
    })
  }
  return out
}

export function FormHost() {
  const { spec, key, close } = useFormStore()
  if (!spec) return null
  return <FormBody key={key} spec={spec} onClose={close} />
}

function FormBody({ spec, onClose }: { spec: FormSpec; onClose: () => void }) {
  const [raw, setRaw] = useState<Vals>(() => {
    const v: Vals = {}
    for (const [k, val] of Object.entries(spec.initial)) v[k] = val === null || val === undefined ? '' : typeof val === 'number' ? String(val) : val
    return v
  })
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const vals = useMemo(() => normalize(spec, raw), [spec, raw])
  const fields = spec.fields(vals).filter((f) => f.show !== false)

  useEffect(() => { setErr(null) }, [raw])

  function set(f: Field, value: unknown) {
    setRaw((r) => { const n = { ...normalize(spec, r), [f.k]: value }; f.resets?.forEach((k) => (n[k] = '')); return n })
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    const out: Vals = { ...vals }
    const all = spec.fields(vals)
    for (const f of all) {
      if (f.t === 'number') { const s = String(out[f.k] ?? '').trim(); out[f.k] = s === '' ? null : f.step === 'any' ? Number(s) : r2(s); if (s !== '' && isNaN(Number(s))) return setErr(`${f.l} must be a number.`) }
      if (f.t === 'check') out[f.k] = !!out[f.k]
      if ((f.t === 'select' || f.t === 'date') && out[f.k] === '') out[f.k] = null
      if ((!f.t || f.t === 'text' || f.t === 'textarea') && typeof out[f.k] === 'string') out[f.k] = out[f.k].trim()
    }
    for (const f of fields) if (f.req && (out[f.k] === null || out[f.k] === '' || out[f.k] === undefined)) return setErr(`${f.l} is required.`)
    const v = spec.validate?.(out); if (v) return setErr(v)
    setBusy(true)
    try { await spec.onSubmit(out); onClose(); if (spec.success) toast(spec.success) }
    catch (ex) { setErr((ex as Error).message || 'Save failed') }
    finally { setBusy(false) }
  }

  return (
    <Modal open onClose={onClose} title={spec.title} wide={spec.wide}>
      <form onSubmit={submit} className="space-y-4">
        {spec.info && <div className="text-xs font-semibold px-3 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/25 text-indigo-700 dark:text-indigo-300">{spec.info(vals)}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => {
            const full = f.full || f.t === 'textarea' || f.t === 'check'
            const val = vals[f.k] ?? ''
            return (
              <div key={f.k} className={full ? 'sm:col-span-2' : ''}>
                {f.t === 'check' ? (
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" data-k={f.k} checked={!!val} onChange={(e) => set(f, e.target.checked)} className="w-4 h-4 accent-indigo-600" /> {f.l}
                  </label>
                ) : (
                  <>
                    <label className="label">{f.l}{f.req ? ' *' : ''}</label>
                    {f.t === 'select' ? (
                      <select data-k={f.k} className="input" value={String(val)} onChange={(e) => set(f, e.target.value)}>
                        {f.blank !== undefined && <option value="">{f.blank}</option>}
                        {(f.opts || []).map(([ov, ol]) => <option key={ov} value={ov}>{ol}</option>)}
                      </select>
                    ) : f.t === 'textarea' ? (
                      <textarea data-k={f.k} className="input" rows={f.rows || 4} value={String(val)} placeholder={f.ph} onChange={(e) => set(f, e.target.value)} />
                    ) : (
                      <input data-k={f.k} className="input" type={f.t === 'number' ? 'number' : f.t || 'text'} step={f.t === 'number' ? f.step || '0.01' : undefined}
                        maxLength={f.max} value={String(val)} placeholder={f.ph} onChange={(e) => set(f, e.target.value)} />
                    )}
                  </>
                )}
                {f.hint && <p className="text-[11px] text-slate-400 mt-1">{f.hint}</p>}
              </div>
            )
          })}
        </div>
        {err && <p className="text-xs text-red-500 font-semibold break-words" data-testid="form-error">{err}</p>}
        <div className="grid grid-cols-2 sm:flex sm:justify-end gap-3 pt-1 sticky bottom-0 bg-white dark:bg-slate-800 -mx-5 px-5 sm:mx-0 sm:px-0 pb-1">
          <button type="button" className="btn justify-center" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={busy} className="btn-primary justify-center" data-testid="form-submit">{busy ? 'Saving…' : spec.submitLabel || 'Save'}</button>
        </div>
      </form>
    </Modal>
  )
}
