import { useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleAlert } from 'lucide-react'
import type { DietChange, Food, FoodData, FoodGoal, Portion } from '../core/types'
import { dayEntries, dayTotals, dietNote, fmtKcal, fmtPortion, goalOn, kcalRange, macroGrams } from '../core/food'
import { dayLabel } from '../core/stats'
import { DayPicker } from './DayPicker'
import { ProgressBar } from './ProgressBar'
import { SaveFailBanner } from './SaveFailBanner'
import { FoodAdd } from './FoodAdd'
import { FoodGoalCard } from './FoodGoalCard'
import { card, secondary } from './foodStyle'

type Props = {
  food: FoodData
  today: string
  onAddEntry: (f: Food, p: Portion, day: string) => { diet: DietChange }
  onAddQuick: (i: { kcal: number; p?: number; c?: number; f?: number; name?: string }, day: string) => { diet: DietChange }
  onUndo: (ids: string[]) => { undone: number; diet: DietChange }
  onCreateFood: (f: Omit<Food, 'id'>) => Food
  onArchiveFood: (id: string, archived: boolean) => void
  onSaveGoal: (g: Omit<FoodGoal, 'from'>) => unknown
  onBack: () => void
  saveFailed: boolean
  onExport: () => void
}

export function FoodView({ food, today, onAddEntry, onAddQuick, onUndo, onCreateFood, onArchiveFood, onSaveGoal, onBack, saveFailed, onExport }: Props) {
  const [day, setDay] = useState(today)
  const [status, setStatus] = useState('')
  const diaryRef = useRef<HTMLHeadingElement>(null)
  const rows = useRef(new Map<string, HTMLButtonElement>())

  const totals = useMemo(() => dayTotals(food.log, day), [food.log, day])
  const entries = useMemo(() => dayEntries(food.log, day).map((e, i) => ({ e, i })).sort((a, b) => (a.e.occurredAt < b.e.occurredAt ? -1 : a.e.occurredAt > b.e.occurredAt ? 1 : a.i - b.i)).map(x => x.e), [food.log, day])
  const goal = goalOn(food.goals, day), todayGoal = goalOn(food.goals, today)
  const kcal = Math.round(totals.kcal)
  const range = goal ? kcalRange(goal.kcal) : null
  const grams = goal ? macroGrams(goal) : null
  const g = (n: number) => Math.round(n)
  const state = !goal || !range ? { text: 'Sin objetivo de calorías', ok: false }
    : kcal < range.min ? { text: `Te faltan ${fmtKcal(range.min - kcal)} kcal para el rango (${fmtKcal(range.min)}–${fmtKcal(range.max)})`, ok: false }
    : kcal <= range.max ? { text: 'Dentro del objetivo: cuenta en Dieta', ok: true }
    : { text: `Te has pasado ${fmtKcal(kcal - range.max)} kcal del rango`, ok: false }
  const title = dayLabel(day, today) === 'Hoy' ? 'Hoy' : dayLabel(day, today).toLowerCase()

  const undo = (id: string, name: string, k: number) => {
    const i = entries.findIndex(e => e.id === id), next = entries[i + 1] ?? entries[i - 1]
    const target = next ? rows.current.get(next.id) : null
    ;(target ?? diaryRef.current)?.focus() // la fila pulsada desaparece: el foco pasa a la siguiente o al encabezado
    const r = onUndo([id])
    setStatus(`Deshecho: ${name} (${fmtKcal(k)} kcal)${dietNote(r.diet)}`)
  }

  return (
    <div className="min-h-dvh bg-hero-bg text-hero-text">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pt-6 pb-28 sm:max-w-2xl lg:max-w-4xl">
        <header className="flex flex-col items-start gap-1">
          <button type="button" onClick={onBack} className={`${secondary} mb-2`}>
            <ArrowLeft className="size-4" aria-hidden />Volver
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-hero">HERO</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Comida</h1>
          <p className="text-sm text-hero-muted">Cada día dentro del 90–110 % de tu objetivo cuenta en Dieta.</p>
        </header>
        {saveFailed && <SaveFailBanner tone="hero" onExport={onExport} />}
        <DayPicker day={day} today={today} onChange={setDay} tone="hero" />

        <section aria-labelledby="food-totals" className={card}>
          <h2 id="food-totals" className="text-base font-semibold">Total · {title}</h2>
          <p className="text-2xl font-semibold tabular-nums">{fmtKcal(kcal)}{goal ? ` / ${fmtKcal(goal.kcal)}` : ''} kcal</p>
          {goal && <ProgressBar value={kcal / goal.kcal} tone="hero" label="Calorías del día" />}
          <p className="flex items-start gap-2 text-sm text-hero-text">
            {state.ok ? <Check className="mt-0.5 size-4 shrink-0 text-hero" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>{state.text}</span>
          </p>
          <p className="text-sm text-hero-muted tabular-nums">
            {grams ? `P ${g(totals.p)}/${grams.p} g · C ${g(totals.c)}/${grams.c} g · G ${g(totals.f)}/${grams.f} g` : `P ${g(totals.p)} g · C ${g(totals.c)} g · G ${g(totals.f)} g`}
          </p>
        </section>

        <FoodGoalCard goal={todayGoal} onSave={onSaveGoal} />
        <FoodAdd food={food} day={day} today={today} onAdd={onAddEntry} onQuick={onAddQuick} onCreate={onCreateFood} onArchive={onArchiveFood} onStatus={setStatus} />
        <p role="status" className="text-sm text-hero-muted empty:sr-only">{status}</p>

        <section aria-labelledby="food-diary" className={card}>
          <h2 id="food-diary" ref={diaryRef} tabIndex={-1} className="text-base font-semibold outline-hero focus-visible:outline-2">Diario</h2>
          {entries.length === 0 ? <p className="text-sm text-hero-muted">Nada apuntado este día.</p> : (
            <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
              {entries.map(e => {
                const portion = fmtPortion(e, e.base)
                return (
                  <li key={e.id} className="flex items-center justify-between gap-2 pl-3">
                    <span className="flex min-w-0 flex-1 flex-col py-2 text-sm">
                      <span className="font-semibold">{e.name}</span>
                      {portion && <span className="text-hero-muted tabular-nums">{portion}</span>}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">{fmtKcal(e.kcal)} kcal</span>
                    <button type="button" ref={el => { if (el) rows.current.set(e.id, el); else rows.current.delete(e.id) }} onClick={() => undo(e.id, e.name, e.kcal)} aria-label={`Deshacer ${e.name} ${fmtKcal(e.kcal)} kcal`}
                      className="m-1 inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2">
                      Deshacer
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
