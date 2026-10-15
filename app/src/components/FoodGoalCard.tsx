import { useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import type { FoodGoal } from '../core/types'
import { fmtKcal, kcalRange, macroGrams, parseKcal, parsePct } from '../core/food'
import { card, field, primary, secondary } from './foodStyle'

type Props = { goal: FoodGoal | null; onSave: (g: Omit<FoodGoal, 'from'>) => void }

// Objetivo de calorías + % de macros. Sin objetivo se abre en modo edición. Los % que propone la primera vez: P 20 / C 50 / G 30.
export function FoodGoalCard({ goal, onSave }: Props) {
  const [editing, setEditing] = useState(goal === null)
  const [kcal, setKcal] = useState(goal ? String(goal.kcal) : '2000')
  const [pct, setPct] = useState({ p: String(goal?.p ?? 20), c: String(goal?.c ?? 50), f: String(goal?.f ?? 30) })
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  const k = parseKcal(kcal), ps = [pct.p, pct.c, pct.f].map(parsePct)
  const derived = k !== null && ps.every(x => x !== null) ? macroGrams({ from: '', kcal: k, p: ps[0]!, c: ps[1]!, f: ps[2]! }) : null

  const open = () => {
    if (goal) { setKcal(String(goal.kcal)); setPct({ p: String(goal.p), c: String(goal.c), f: String(goal.f) }) }
    setError(''); setNote(''); setEditing(true)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (k === null || k < 800 || k > 10000) return setError('Entre 800 y 10.000 kcal.')
    if (ps.some(x => x === null)) return setError('Los porcentajes tienen que ser enteros de 0 a 100.')
    const [p, c, f] = ps as number[], sum = p + c + f
    if (sum !== 100) return setError(`Los porcentajes suman ${sum} %; tienen que sumar 100.`)
    onSave({ kcal: k, p, c, f })
    setError(''); setEditing(false)
    setNote(goal ? 'El nuevo objetivo rige desde hoy; los días anteriores conservan el suyo.' : '')
    setTimeout(() => headingRef.current?.focus(), 0) // el formulario desaparece: el foco va al encabezado
  }

  const pctField = (key: 'p' | 'c' | 'f', label: string, grams: number | undefined) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={`food-goal-${key}`} className="text-xs font-medium">{label} (%)</label>
      <input id={`food-goal-${key}`} type="text" inputMode="numeric" autoComplete="off" value={pct[key]} onChange={e => setPct(x => ({ ...x, [key]: e.target.value }))} className={`${field} tabular-nums`} />
      <span className="text-xs text-hero-muted tabular-nums">{grams === undefined ? '— g' : `${grams} g`}</span>
    </div>
  )

  if (!editing && goal) {
    const g = macroGrams(goal), r = kcalRange(goal.kcal)
    return (
      <section aria-labelledby="food-goal" className={card}>
        <h2 id="food-goal" ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Objetivo</h2>
        <p className="text-sm tabular-nums"><span className="font-semibold">{fmtKcal(goal.kcal)} kcal</span> · P {g.p} g ({goal.p} %) · C {g.c} g ({goal.c} %) · G {g.f} g ({goal.f} %)</p>
        <p className="text-sm text-hero-muted tabular-nums">Cuenta en Dieta entre {fmtKcal(r.min)} y {fmtKcal(r.max)} kcal (90–110 %).</p>
        {note && <p role="status" className="text-sm text-hero-muted">{note}</p>}
        <button type="button" onClick={open} className={`${secondary} self-start`}>Cambiar objetivo</button>
      </section>
    )
  }
  return (
    <form onSubmit={submit} className={card} noValidate aria-labelledby="food-goal">
      <h2 id="food-goal" ref={headingRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Objetivo</h2>
      {goal === null && <p className="text-sm text-hero-muted">Fija tu objetivo de calorías: los días dentro del 90–110 % cuentan en Dieta.</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="food-goal-kcal" className="text-xs font-medium">Calorías al día (kcal)</label>
        <input id="food-goal-kcal" type="text" inputMode="numeric" autoComplete="off" value={kcal} onChange={e => setKcal(e.target.value)} className={`${field} tabular-nums`} />
      </div>
      <div className="flex gap-2">
        {pctField('p', 'Proteína', derived?.p)}
        {pctField('c', 'Carbohidratos', derived?.c)}
        {pctField('f', 'Grasa', derived?.f)}
      </div>
      {error && <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary}>Guardar objetivo</button>
        {goal && <button type="button" onClick={() => { setEditing(false); setError('') }} className={secondary}>Cancelar</button>}
      </div>
    </form>
  )
}
