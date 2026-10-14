import { useEffect, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import type { Food, Portion } from '../core/types'
import { fmtKcal, fmtNum, parseQty, parseServings, portion } from '../core/food'
import { field, primary, secondary } from './foodStyle'

type Props = { food: Food; initial: Portion; onAdd: (p: Portion) => void; onCancel: () => void }

// Panel de cantidad: g/ml o raciones del alimento; con ración, la cantidad es el nº de raciones.
export function FoodQty({ food, initial, onAdd, onCancel }: Props) {
  const start = initial.serving && food.servings?.some(s => s.name === initial.serving!.name) ? initial.serving : null
  const [unit, setUnit] = useState(start?.name ?? '') // '' = g/ml de la base
  const [text, setText] = useState(fmtNum(start ? start.n : initial.qty))
  const [error, setError] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])

  const serving = food.servings?.find(s => s.name === unit)
  const n = serving ? parseServings(text) : parseQty(text)
  const qty = n === null ? null : serving ? Math.round(n * serving.qty * 100) / 100 : n
  const valid = qty !== null && qty > 0 && qty <= 2000
  const pv = valid ? portion(food, qty) : null

  const changeUnit = (u: string) => {
    setUnit(u); setError('')
    setText(u ? '1' : fmtNum(qty !== null && valid ? qty : 100))
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || n === null || qty === null) return setError(serving ? 'Indica entre 0,25 y 50 raciones (hasta 2.000 en total).' : 'Indica una cantidad entre 0,1 y 2.000.')
    onAdd(serving ? { qty, serving: { name: serving.name, n } } : { qty })
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-hero-border p-3" noValidate aria-label={`Cantidad de ${food.name}`}>
      <h3 className="text-sm font-semibold">{food.name}</h3>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="food-qty" className="text-xs font-medium">Cantidad</label>
          <input id="food-qty" ref={ref} type="text" inputMode="decimal" autoComplete="off" value={text} onChange={e => { setText(e.target.value); setError('') }}
            aria-invalid={!!error} aria-describedby={error ? 'food-qty-err' : undefined} className={`${field} tabular-nums`} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="food-unit" className="text-xs font-medium">Unidad</label>
          <select id="food-unit" value={unit} onChange={e => changeUnit(e.target.value)} className={field}>
            <option value="">{food.base}</option>
            {food.servings?.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>
      {serving && valid && <p className="text-sm text-hero-muted tabular-nums">= {fmtNum(qty)} {food.base}</p>}
      {pv && <p className="text-sm font-semibold tabular-nums">{fmtKcal(pv.kcal)} kcal · P {fmtNum(pv.p)} · C {fmtNum(pv.c)} · G {fmtNum(pv.f)}</p>}
      {error && <p id="food-qty-err" role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primary}>Añadir</button>
        <button type="button" onClick={onCancel} className={secondary}>Cancelar</button>
      </div>
    </form>
  )
}
