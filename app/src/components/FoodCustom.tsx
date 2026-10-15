import { useEffect, useRef, useState } from 'react'
import { CircleAlert, Plus } from 'lucide-react'
import type { Food, FoodBase, Serving } from '../core/types'
import { fmtNum, fold, nameTaken, parseMacro, parseQty } from '../core/food'
import { kcalCoherent, type FoodDraft } from '../core/off'
import { FoodOffCredit } from './FoodOffCredit'
import { field, primary, secondary } from './foodStyle'

type Props = {
  initialName: string
  custom: Food[] // alimentos propios (también archivados) para el nombre único
  onCreate: (f: Omit<Food, 'id'>) => void
  onReactivate: (f: Food) => void
  onCancel: () => void
  draft?: FoodDraft // prerrelleno desde Open Food Facts o la etiqueta: modo «Revisar alimento»
  manualRef?: string // «Crear a mano» desde el flujo del EAN: se guarda el ref (sin source)
}
type Row = { name: string; qty: string }

// Formulario «Crear alimento»: valores por 100 g/ml (§5), hasta 5 raciones. Nombre único frente al catálogo y los propios.
export function FoodCustom({ initialName, custom, onCreate, onReactivate, onCancel, draft, manualRef }: Props) {
  const [name, setName] = useState(draft ? draft.name : initialName)
  const [base, setBase] = useState<FoodBase>(draft?.base ?? 'g')
  const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : fmtNum(n))
  const [v, setV] = useState({ kcal: txt(draft?.kcal), p: txt(draft?.p), c: txt(draft?.c), f: txt(draft?.f) })
  const [rows, setRows] = useState<Row[]>(() => (draft?.servings ?? []).map(s => ({ name: s.name, qty: fmtNum(s.qty) })))
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const taken = name.trim() ? nameTaken(name, custom) : null
  const archivedHit = taken && taken !== 'catalog' && taken.archived ? taken : null

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n || n.length > 40) return setError('El nombre tiene entre 1 y 40 caracteres.')
    if (taken) return setError(archivedHit ? 'Ya existe, pero está archivado: pulsa «Reactivar».' : 'Ya existe un alimento con ese nombre.')
    const kcal = parseMacro(v.kcal), p = parseMacro(v.p), c = parseMacro(v.c), f = parseMacro(v.f)
    if (kcal === undefined || kcal === null || kcal > 900) return setError('Las kcal por 100 son un número de 0 a 900.')
    if (p === null || c === null || f === null || (p ?? 0) > 100 || (c ?? 0) > 100 || (f ?? 0) > 100) return setError('Proteína, carbohidratos y grasa son números de 0 a 100 g por 100.')
    if ((p ?? 0) + (c ?? 0) + (f ?? 0) > 100) return setError('Los macros suman más de 100 g por 100 g.')
    const servings: Serving[] = []
    for (const r of rows) {
      if (!r.name.trim() && !r.qty.trim()) continue
      const q = parseQty(r.qty), sn = r.name.trim()
      if (!sn || sn.length > 30 || q === null) return setError('Cada ración lleva un nombre (hasta 30 caracteres) y una cantidad entre 0,1 y 2.000.')
      if (servings.some(s => fold(s.name) === fold(sn))) return setError('Los nombres de las raciones no se pueden repetir.')
      servings.push({ name: sn, qty: q })
    }
    const origin = draft ? { source: draft.source, ...(draft.ref ? { ref: draft.ref } : {}) } : manualRef ? { ref: manualRef } : {}
    onCreate({ name: n, base, kcal, p: p ?? 0, c: c ?? 0, f: f ?? 0, ...(servings.length ? { servings } : {}), ...origin })
  }
  const [kk, pp, cc, ff] = [parseMacro(v.kcal), parseMacro(v.p), parseMacro(v.c), parseMacro(v.f)]
  const incoherent = draft !== undefined && [kk, pp, cc, ff].every(x => typeof x === 'number') && !kcalCoherent({ kcal: kk as number, p: pp as number, c: cc as number, f: ff as number })
  const num = (key: 'kcal' | 'p' | 'c' | 'f', label: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`food-c-${key}`} className="text-xs font-medium">{label}</label>
      <input id={`food-c-${key}`} type="text" inputMode="decimal" autoComplete="off" value={v[key]} onChange={e => { setV(x => ({ ...x, [key]: e.target.value })); setError('') }} aria-invalid={draft !== undefined && draft[key] === null && !v[key].trim() ? true : undefined} className={`${field} tabular-nums`} />
    </div>
  )
  return (
    <form onSubmit={submit} noValidate aria-labelledby="food-c-title" className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
      <h3 id="food-c-title" className="text-sm font-semibold">{draft ? 'Revisar alimento' : 'Crear alimento'}</h3>
      {draft?.source === 'off' && draft.ref && <FoodOffCredit ean={draft.ref} />}
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="food-c-name" className="text-xs font-medium">Nombre</label>
          <input id="food-c-name" ref={ref} type="text" autoComplete="off" maxLength={40} value={name} onChange={e => { setName(e.target.value); setError('') }} className={field} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="food-c-base" className="text-xs font-medium">Medido en</label>
          <select id="food-c-base" value={base} onChange={e => setBase(e.target.value as FoodBase)} className={field}><option value="g">g</option><option value="ml">ml</option></select>
        </div>
      </div>
      {taken && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-hero-text">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span>{taken === 'catalog' ? 'Ya existe en el catálogo.' : archivedHit ? 'Ya existe, archivado.' : 'Ya existe.'}</span>
          {archivedHit && <button type="button" onClick={() => onReactivate(archivedHit)} className={secondary}>Reactivar</button>}
        </p>
      )}
      <p className="text-xs text-hero-muted">Valores por 100 {base}.</p>
      <div className="flex gap-2">{num('kcal', 'Calorías (kcal)')}{num('p', 'Proteína (g)')}{num('c', 'Carbohidratos (g)')}{num('f', 'Grasa (g)')}</div>
      {incoherent && <p role="status" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />Las kcal no cuadran con los macros. Revisa la etiqueta.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <label htmlFor={`food-c-sn-${i}`} className="text-xs font-medium">Ración {i + 1}</label>
            <input id={`food-c-sn-${i}`} type="text" autoComplete="off" maxLength={30} value={r.name} onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={field} />
          </div>
          <div className="flex w-28 flex-col gap-1">
            <label htmlFor={`food-c-sq-${i}`} className="text-xs font-medium">{`Cantidad (${base})`}</label>
            <input id={`food-c-sq-${i}`} type="text" inputMode="decimal" autoComplete="off" value={r.qty} onChange={e => setRows(rs => rs.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className={`${field} tabular-nums`} />
          </div>
        </div>
      ))}
      {rows.length < 5 && <button type="button" onClick={() => setRows(rs => [...rs, { name: '', qty: '' }])} className={`${secondary} self-start`}><Plus className="size-4" aria-hidden />Añadir ración</button>}
      {error && <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary}>Guardar</button>
        <button type="button" onClick={onCancel} className={secondary}>Cancelar</button>
      </div>
    </form>
  )
}
