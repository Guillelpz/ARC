import { useEffect, useMemo, useState } from 'react'
import type { ActivityEvent, DietChange, Food, FoodData, FoodEntry, FoodGoal, Portion } from './core/types'
import { MAX_MEALS, allFoods, nameTaken, dayTotals, dietDays, dietSync, goalOn, liveEntries, makeEntry, mealEntries, mealFromEntries, quickEntry, setFoodGoal, undoEntries } from './core/food'
import { saveFood } from './core/storage'
import { estimateEntry, type VoiceAdd } from './core/foodVoice'

const uuid = () => crypto.randomUUID()

export const foodCount = (f: FoodData) => liveEntries(f.log).length

type Deps = {
  events: ActivityEvent[]
  today: string
  stamp: (day?: string) => string // `nowStamp` de App
  pushDiet: (evs: ActivityEvent[]) => void // guarda los eventos de Dieta con el XP, toast y adelantamientos de `push`
}

// Estado de Comida y sus handlers. Cada handler que puede mover Dieta guarda la comida y su `dietSync` juntos (§7.3):
// `syncDiet` hace setFood(next) y pushDiet(evs) en el mismo manejador, así que React los agrupa en un único render.
export function useFood(initial: FoodData, { events, today, stamp, pushDiet }: Deps) {
  const [food, setFood] = useState<FoodData>(initial)
  const [unsaved, setUnsaved] = useState(false) // false con el siguiente guardado correcto
  // ponytail: setState dentro del efecto de guardado (aviso de lint aceptado); guardar en cada handler evitaría el render extra
  // oxlint-disable-next-line react/set-state-in-effect -- ver ponytail
  useEffect(() => { const ok = saveFood(food); if (ok !== null) setUnsaved(u => (u === !ok ? u : !ok)) }, [food])

  const foodToday = useMemo(() => {
    const goal = goalOn(food.goals, today), kcal = dayTotals(food.log, today)
    return goal || kcal.entries > 0 ? { kcal: Math.round(kcal.kcal), goal: goal?.kcal ?? null } : null
  }, [food.log, food.goals, today])

  // días ya apuntados: Dieta puede sumar o restar; `diet` = signo del neto (+1 entra en rango, −1 sale, 0 nada)
  function syncDiet(next: FoodData, days: string[]): DietChange {
    setFood(next)
    const evs = dietSync(events, next, days, today, uuid)
    if (!evs.length) return 0
    pushDiet(evs)
    const net = evs.reduce((n, e) => n + e.amount, 0)
    return net > 0 ? 1 : net < 0 ? -1 : 0
  }
  function addFoodEntry(f: Food, p: Portion, day: string): { id: string; diet: DietChange } {
    if (day > today) day = today
    const e = makeEntry(f, p, uuid(), stamp(day))
    return { id: e.id, diet: syncDiet({ ...food, log: [...food.log, e] }, [day]) }
  }
  function addQuick(input: { kcal: number; p?: number; c?: number; f?: number; name?: string }, day: string): { id: string; diet: DietChange } {
    if (day > today) day = today
    const e: FoodEntry = quickEntry(input, uuid(), stamp(day))
    return { id: e.id, diet: syncDiet({ ...food, log: [...food.log, e] }, [day]) }
  }
  // Varias entradas de una frase (voz): un solo setFood y un solo dietSync (nunca dos push en el mismo manejador).
  // `created` = propios creados desde una estimación confirmada (A4/A5); si el nombre ya existe, la estimación se apunta sin crearlo.
  function addVoice(adds: VoiceAdd[], day: string): { ids: string[]; created: string[]; diet: DietChange } {
    if (!adds.length) return { ids: [], created: [], diet: 0 }
    if (day > today) day = today
    const at = stamp(day)
    const created: Food[] = []
    const entries = adds.map(a => {
      if ('quick' in a) return quickEntry(a.quick, uuid(), at, 'voice')
      if ('food' in a) return makeEntry(a.food, a.portion, uuid(), at, 'voice')
      if (!a.own || nameTaken(a.estimate.name, [...food.foods, ...created])) return estimateEntry(a.estimate, a.portion, uuid(), at)
      const f: Food = { id: `food-${uuid()}`, ...a.estimate }
      created.push(f)
      return makeEntry(f, a.portion, uuid(), at, 'voice')
    })
    return { ids: entries.map(e => e.id), created: created.map(f => f.id), diet: syncDiet({ ...food, foods: [...food.foods, ...created], log: [...food.log, ...entries] }, [day]) }
  }
  // Deshace varias entradas y archiva `archive` (propios creados por la frase) en el mismo guardado
  function undoVoice(ids: string[], archive: string[]): { undone: number; diet: DietChange } {
    const us = undoEntries(food.log, ids, uuid)
    const foods = food.foods.map(f => (archive.includes(f.id) ? { ...f, archived: true } : f))
    if (!us.length && foods.every((f, i) => f === food.foods[i])) return { undone: 0, diet: 0 }
    return { undone: us.length, diet: syncDiet({ ...food, foods, log: [...food.log, ...us] }, us.map(u => u.occurredAt.slice(0, 10))) }
  }
  // Alimentos propios: las entradas guardan su instantánea (T1), así que crear o archivar no toca Dieta
  function createFood(input: Omit<Food, 'id'>): Food {
    const f: Food = { id: `food-${uuid()}`, ...input }
    setFood({ ...food, foods: [...food.foods, f] })
    return f
  }
  function setFoodArchived(id: string, archived: boolean) {
    setFood({ ...food, foods: food.foods.map(f => { if (f.id !== id) return f; const { archived: _a, ...rest } = f; return archived ? { ...rest, archived: true } : rest }) })
  }
  // Platos: guardar desde entradas vivas del día, borrar y añadir al día elegido (con su dietSync)
  function saveMeal(name: string, ids: string[]): boolean {
    const meals = food.meals ?? []
    if (meals.length >= MAX_MEALS) return false
    const live = liveEntries(food.log), m = mealFromEntries(ids.flatMap(id => live.filter(e => e.id === id)), name, `meal-${uuid()}`)
    if (!m) return false
    setFood({ ...food, meals: [...meals, m] })
    return true
  }
  function deleteMeal(id: string) {
    const meals = (food.meals ?? []).filter(m => m.id !== id)
    const { meals: _m, ...rest } = food
    setFood(meals.length ? { ...rest, meals } : rest)
  }
  function addMeal(id: string, day: string): { ids: string[]; missing: number; diet: DietChange } {
    if (day > today) day = today
    const m = (food.meals ?? []).find(x => x.id === id)
    if (!m) return { ids: [], missing: 0, diet: 0 }
    const { entries, missing } = mealEntries(m, allFoods(food.foods), uuid, stamp(day))
    if (!entries.length) return { ids: [], missing, diet: 0 }
    return { ids: entries.map(e => e.id), missing, diet: syncDiet({ ...food, log: [...food.log, ...entries] }, [day]) }
  }
  function undoFood(ids: string[]): { undone: number; diet: DietChange } {
    const us = undoEntries(food.log, ids, uuid)
    if (!us.length) return { undone: 0, diet: 0 }
    return { undone: us.length, diet: syncDiet({ ...food, log: [...food.log, ...us] }, us.map(u => u.occurredAt.slice(0, 10))) }
  }
  // El objetivo rige desde hoy; los días pasados conservan el suyo (con el primer objetivo rige hacia atrás: T3 de la spec)
  function saveFoodGoal(g: Omit<FoodGoal, 'from'>): DietChange {
    const next = { ...food, goals: setFoodGoal(food.goals, g, today) }
    return syncDiet(next, dietDays(next, events))
  }

  // `setFood` y `unsaved` quedan fuera para App: sincronía entre pestañas, importar, fusionar, recuperar y «Borrar todo»
  return { food, setFood, unsaved, foodToday, handlers: { addFoodEntry, addQuick, addVoice, undoVoice, undoFood, createFood, setFoodArchived, saveMeal, deleteMeal, addMeal, saveFoodGoal } }
}
