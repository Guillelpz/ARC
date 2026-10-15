import { useMemo, useRef, useState } from 'react'
import { CircleAlert, Plus } from 'lucide-react'
import type { DietChange, FoodData, Meal } from '../core/types'
import { MAX_MEALS, allFoods, dayEntries, dietNote, fmtKcal, fmtPortion, mealNameTaken, portion } from '../core/food'
import { card, field, primary, secondary } from './foodStyle'

type Props = {
  food: FoodData
  day: string
  onSave: (name: string, ids: string[]) => boolean
  onDelete: (id: string) => void
  onAdd: (id: string, day: string) => { ids: string[]; missing: number; diet: DietChange; gone?: true }
  onUndo: (ids: string[]) => { undone: number; diet: DietChange }
}

const small = 'inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2'

// Platos guardados: «Añadir» apunta todos sus alimentos al día elegido de un toque; «Deshacer» los retira juntos.
export function FoodMeals({ food, day, onSave, onDelete, onAdd, onUndo }: Props) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ text: string; ids: string[] }>({ text: '', ids: [] })
  const headRef = useRef<HTMLHeadingElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)

  const meals = food.meals ?? []
  const foods = useMemo(() => allFoods(food.foods), [food.foods])
  const entries = useMemo(() => dayEntries(food.log, day).filter(e => e.foodId).map((e, i) => ({ e, i })).sort((a, b) => (a.e.occurredAt < b.e.occurredAt ? -1 : a.e.occurredAt > b.e.occurredAt ? 1 : a.i - b.i)).map(x => x.e), [food.log, day])
  const full = meals.length >= MAX_MEALS

  const kcalOf = (m: Meal) => m.items.reduce((a, it) => { const f = foods.find(x => x.id === it.foodId); return a + (f ? portion(f, it.qty).kcal : 0) }, 0)
  const label = (it: Meal['items'][number]) => { const f = foods.find(x => x.id === it.foodId); return f ? `${f.name} ${fmtPortion(it, f.base)}` : 'Alimento desconocido' }

  const toggle = (id: string) => setPicked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const close = () => { setOpen(false); setPicked(new Set()); setName(''); setError(''); setTimeout(() => openRef.current?.focus(), 0) }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (picked.size === 0) return setError('Marca al menos un alimento.')
    if (!n || n.length > 40) return setError('El nombre tiene entre 1 y 40 caracteres.')
    if (mealNameTaken(n, meals)) return setError('Ya tienes un plato con ese nombre.')
    if (!onSave(n, entries.filter(x => picked.has(x.id)).map(x => x.id))) return setError('No se ha podido guardar el plato.')
    setNotice({ text: `Plato guardado: ${n}`, ids: [] })
    close()
  }
  const add = (m: Meal) => {
    const r = onAdd(m.id, day)
    if (r.gone) return setNotice({ text: 'Ese plato ya no existe.', ids: [] })
    const miss = r.missing > 0 ? `. ${r.missing} ${r.missing === 1 ? 'alimento del plato ya no existe y no se ha añadido' : 'alimentos del plato ya no existen y no se han añadido'}` : ''
    setNotice({ text: r.ids.length ? `Añadido: ${m.name} (${r.ids.length} ${r.ids.length === 1 ? 'alimento' : 'alimentos'})${dietNote(r.diet)}${miss}` : `No se ha añadido nada${miss}`, ids: r.ids })
  }
  const undo = () => { const r = onUndo(notice.ids); setNotice({ text: `Deshecho: ${r.undone} ${r.undone === 1 ? 'entrada' : 'entradas'} del plato${dietNote(r.diet)}`, ids: [] }) }
  const del = (m: Meal) => { if (!window.confirm(`¿Borrar el plato «${m.name}»? Lo que ya has apuntado no cambia.`)) return; onDelete(m.id); setNotice({ text: `Plato borrado: ${m.name}`, ids: [] }); headRef.current?.focus() }

  return (
    <section aria-labelledby="food-meals" className={card}>
      <h2 id="food-meals" ref={headRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Platos</h2>
      {meals.length === 0 && <p className="text-sm text-hero-muted">Guarda las comidas que repites y apúntalas de un toque.</p>}
      {meals.length > 0 && (
        <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
          {meals.map(m => (
            <li key={m.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 font-semibold">{m.name}</span>
                <span className="shrink-0 text-sm tabular-nums">{fmtKcal(kcalOf(m))} kcal</span>
              </div>
              <p className="text-sm text-hero-muted">{m.items.map(label).join(' · ')}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => add(m)} aria-label={`Añadir plato ${m.name}`} className={primary}>Añadir</button>
                <button type="button" onClick={() => del(m)} aria-label={`Borrar plato ${m.name}`} className={small}>Borrar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-hero-muted empty:hidden">
        {notice.text}
        {notice.ids.length > 0 && <button type="button" onClick={undo} className={small}>Deshacer</button>}
      </p>
      {!open && <button ref={openRef} type="button" onClick={() => setOpen(true)} disabled={full || entries.length === 0} aria-describedby="food-meals-hint" className={`${secondary} self-start`}><Plus className="size-4" aria-hidden />Guardar como plato</button>}
      {!open && (full || entries.length === 0) && <p id="food-meals-hint" className="text-sm text-hero-muted">{full ? `Máximo ${MAX_MEALS} platos: borra alguno para guardar otro.` : 'Apunta alimentos este día para guardarlos como plato.'}</p>}
      {open && (
        <form onSubmit={submit} noValidate aria-labelledby="food-meals-form" className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
          <h3 id="food-meals-form" className="text-sm font-semibold">Guardar como plato</h3>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs font-medium">Alimentos del día</legend>
            {entries.map(e => (
              <label key={e.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" checked={picked.has(e.id)} onChange={() => { toggle(e.id); setError('') }} className="size-5 accent-hero" />
                <span className="min-w-0 flex-1">{e.name} <span className="text-hero-muted tabular-nums">{fmtPortion(e, e.base)}</span></span>
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1">
            <label htmlFor="food-meal-name" className="text-xs font-medium">Nombre del plato</label>
            <input id="food-meal-name" type="text" autoComplete="off" maxLength={40} value={name} onChange={e => { setName(e.target.value); setError('') }} className={field} />
          </div>
          {error && <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary}>Guardar</button>
            <button type="button" onClick={close} className={secondary}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  )
}
