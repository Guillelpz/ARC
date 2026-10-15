import type { ActivityEvent, DietChange, Food, FoodBase, FoodData, FoodDay, FoodEntry, FoodGoal, FoodLogEntry, FoodUndo, FoodWeek, Meal, Nutrients, Portion } from './types'
import { CATALOG } from './foodCatalog'
import { addDays, clampAmount, dayTotal, mondayOf, undoneIds } from './stats'
import type { Tracker } from './types'

export const EMPTY_FOOD: FoodData = { log: [], foods: [] }
export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ')
export const allFoods = (custom: Food[]) => [...custom, ...CATALOG] // propios primero
export const foodById = (id: string, custom: Food[]) => allFoods(custom).find(f => f.id === id)

const r0 = (x: number) => Math.round(x), r1 = (x: number) => Math.round(x * 10 + 1e-9) / 10
export const portion = (food: Food, qty: number): Nutrients => ({ kcal: r1(food.kcal * qty / 100), p: r1(food.p * qty / 100), c: r1(food.c * qty / 100), f: r1(food.f * qty / 100) })

export const isFoodUndo = (e: FoodLogEntry): e is FoodUndo => 'undoes' in e
export function liveEntries(log: FoodLogEntry[]): FoodEntry[] {
  const undone = new Set(log.filter(isFoodUndo).map(u => u.undoes))
  return log.filter((e): e is FoodEntry => !isFoodUndo(e) && !undone.has(e.id))
}
export const dayEntries = (log: FoodLogEntry[], day: string) => liveEntries(log).filter(e => e.occurredAt.startsWith(day))
export function dayTotals(log: FoodLogEntry[], day: string): FoodDay {
  const es = dayEntries(log, day)
  const s = (k: 'kcal' | 'p' | 'c' | 'f') => r1(es.reduce((a, e) => a + (e[k] ?? 0), 0))
  return { kcal: s('kcal'), p: s('p'), c: s('c'), f: s('f'), entries: es.length }
}

// FoodUndo de las entradas vivas de `ids` (sin repetir; las ya deshechas o desconocidas se ignoran). occurredAt = el de la entrada.
export function undoEntries(log: FoodLogEntry[], ids: string[], newId: () => string): FoodUndo[] {
  const live = new Map(liveEntries(log).map(e => [e.id, e]))
  return [...new Set(ids)].flatMap(id => { const e = live.get(id); return e ? [{ id: newId(), undoes: e.id, occurredAt: e.occurredAt }] : [] })
}

export function makeEntry(food: Food, p: Portion, id: string, occurredAt: string, via?: string): FoodEntry {
  const n = portion(food, p.qty)
  return { id, occurredAt, name: food.name, kcal: n.kcal, p: n.p, c: n.c, f: n.f, foodId: food.id, base: food.base, qty: p.qty, ...(p.serving ? { serving: p.serving } : {}), ...(via ? { via } : {}) }
}
export function quickEntry(i: { kcal: number; p?: number; c?: number; f?: number; name?: string }, id: string, occurredAt: string): FoodEntry {
  return { id, occurredAt, name: i.name?.trim() || 'Añadido rápido', kcal: i.kcal, qty: 0, ...(i.p !== undefined ? { p: i.p } : {}), ...(i.c !== undefined ? { c: i.c } : {}), ...(i.f !== undefined ? { f: i.f } : {}) }
}
export const fmtKcal = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// Parsers: coma o punto decimal, trim; null si no vale
const num = (t: string): number | null => { const s = t.trim().replace(',', '.'); return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null }
export function parseQty(t: string): number | null { const n = num(t); if (n === null) return null; const q = r1(n); return q > 0 && q <= 2000 ? q : null }
export function parseServings(t: string): number | null { const n = num(t); if (n === null) return null; const q = Math.round(n * 4) / 4; return q >= 0.25 && q <= 50 ? q : null }
export function parseKcal(t: string): number | null { const n = num(t); if (n === null) return null; const k = r0(n); return k >= 1 && k <= 10000 ? k : null }
// vacío → undefined; no válido → null
export function parseMacro(t: string): number | undefined | null { if (!t.trim()) return undefined; const n = num(t); if (n === null) return null; const m = r1(n); return m <= 1000 ? m : null }
export function parsePct(t: string): number | null { const s = t.trim(); if (!/^\d+$/.test(s)) return null; const n = Number(s); return n <= 100 ? n : null }

// Objetivo: el último con from ≤ día; si ninguno, el primero; sin objetivos → null
export function goalOn(goals: FoodGoal[] = [], day: string): FoodGoal | null {
  const s = [...goals].sort((a, b) => a.from.localeCompare(b.from))
  let g: FoodGoal | null = null
  for (const x of s) if (x.from <= day) g = x
  return g ?? s[0] ?? null
}
export function setFoodGoal(goals: FoodGoal[] = [], g: Omit<FoodGoal, 'from'>, today: string): FoodGoal[] {
  return [...goals.filter(x => x.from !== today), { ...g, from: today }].sort((a, b) => a.from.localeCompare(b.from))
}
export const macroGrams = (g: FoodGoal) => ({ p: r0(g.kcal * g.p / 100 / 4), c: r0(g.kcal * g.c / 100 / 4), f: r0(g.kcal * g.f / 100 / 9) })
export const kcalRange = (kcal: number) => ({ min: Math.ceil(kcal * 0.9 - 1e-9), max: Math.floor(kcal * 1.1 + 1e-9) })
export function inRange(food: FoodData, day: string): boolean {
  const g = goalOn(food.goals, day)
  if (!g) return false
  const { min, max } = kcalRange(g.kcal), k = r0(dayTotals(food.log, day).kcal)
  return k >= min && k <= max
}

export function searchFoods(q: string, foods: Food[], n = 20): Food[] {
  const fq = fold(q)
  if (!fq) return []
  const qw = fq.split(' ')
  const score = (f: Food): number => {
    if (f.archived) return -1
    const texts = [fold(f.name), ...(f.aliases ?? []).map(fold)]
    if (texts.includes(fq)) return 0
    if (texts[0].startsWith(fq)) return 1
    if (texts.some(t => { const w = t.split(' '); return qw.every(x => w.some(y => y.startsWith(x))) })) return 2
    if (texts.some(t => t.includes(fq))) return 3
    return -1
  }
  return foods.map((f, i) => ({ f, i, s: score(f) })).filter(x => x.s >= 0).sort((a, b) => a.s - b.s || a.i - b.i).slice(0, n).map(x => x.f)
}

// Entradas vivas con alimento, de la más reciente a la más antigua (empate: la posterior en el log)
const newestFirst = (log: FoodLogEntry[]) => liveEntries(log).map((e, i) => ({ e, i })).filter(x => x.e.foodId).sort((a, b) => (a.e.occurredAt < b.e.occurredAt ? 1 : a.e.occurredAt > b.e.occurredAt ? -1 : b.i - a.i)).map(x => x.e)
const portionOf = (e: FoodEntry): Portion => ({ qty: e.qty, ...(e.serving ? { serving: e.serving } : {}) })
export function lastPortion(log: FoodLogEntry[], foodId: string): Portion | null {
  const e = newestFirst(log).find(x => x.foodId === foodId)
  return e ? portionOf(e) : null
}
export function recentFoods(log: FoodLogEntry[], n = 8): { foodId: string; last: Portion }[] {
  const seen = new Set<string>(), out: { foodId: string; last: Portion }[] = []
  for (const e of newestFirst(log)) {
    if (seen.has(e.foodId!)) continue
    seen.add(e.foodId!); out.push({ foodId: e.foodId!, last: portionOf(e) })
  }
  return out.slice(0, n)
}
// entradas vivas en [today−27, today]; nº desc, empate: la más reciente
export function frequentFoods(log: FoodLogEntry[], today: string, n = 8): { foodId: string; last: Portion }[] {
  const from = addDays(today, -27), count = new Map<string, number>(), first = new Map<string, FoodEntry>()
  for (const e of newestFirst(log)) {
    const d = e.occurredAt.slice(0, 10)
    if (d < from || d > today) continue
    count.set(e.foodId!, (count.get(e.foodId!) ?? 0) + 1)
    if (!first.has(e.foodId!)) first.set(e.foodId!, e)
  }
  const order = [...first.keys()]
  return order.sort((a, b) => count.get(b)! - count.get(a)! || order.indexOf(a) - order.indexOf(b)).slice(0, n).map(id => ({ foodId: id, last: portionOf(first.get(id)!) }))
}

// Dieta (F8): día con kcal entre el 90 % y el 110 % del objetivo ⇒ +1 automático. Como `ensureAuto`/`retractAuto` del gym, pero propio.
export const DIET_TRACKER = 'dieta'
export const dietAutoRe = (day: string) => new RegExp(`^dieta-auto-${day}(-\\d+)?$`)
export function dietSync(events: ActivityEvent[], food: FoodData, days: string[], today: string, newId: () => string): ActivityEvent[] {
  const out: ActivityEvent[] = []
  for (const day of [...new Set(days)].filter(d => d <= today).sort()) {
    const re = dietAutoRe(day), acc = () => [...events, ...out]
    if (inRange(food, day)) {
      if (dayTotal(acc(), DIET_TRACKER, day) !== 0) continue
      const n = acc().filter(e => re.test(e.id)).length + 1
      out.push({ id: n === 1 ? `dieta-auto-${day}` : `dieta-auto-${day}-${n}`, trackerId: DIET_TRACKER, amount: 1, occurredAt: `${day}T12:00:00` })
    } else {
      const undone = undoneIds(acc()), autos = acc().filter(e => re.test(e.id) && e.amount > 0 && !undone.has(e.id)).reverse()
      for (const a of autos)
        if (clampAmount(acc(), DIET_TRACKER, day, -1) === -1) out.push({ id: newId(), trackerId: DIET_TRACKER, amount: -1, occurredAt: a.occurredAt, undoes: a.id })
    }
  }
  return out
}
// días con alguna entrada del log (vivas o no) o con eventos dieta-auto-*; ordenados
export const dietDays = (food: FoodData, events: ActivityEvent[]): string[] =>
  [...new Set([...food.log.map(e => e.occurredAt.slice(0, 10)), ...events.flatMap(e => { const m = /^dieta-auto-(\d{4}-\d{2}-\d{2})/.exec(e.id); return m ? [m[1]] : [] })])].sort()
export const dietActive = (food: FoodData, events: ActivityEvent[]) => (food.goals?.length ?? 0) > 0 || events.some(e => e.trackerId === DIET_TRACKER)
// B1: Dieta oculta (archivada solo en lo derivado, sin persistir) mientras no haya objetivo ni eventos
export const withDiet = (ts: Tracker[], active: boolean): Tracker[] => (active ? ts : ts.map(t => (t.id === DIET_TRACKER ? { ...t, archived: true } : t)))

export const dietNote = (d: DietChange) => (d > 0 ? ' · Día dentro del objetivo: +1 Dieta' : d < 0 ? ' · Fuera del rango: se retira el +1 de Dieta' : '')

// Texto de una cantidad: «150 g», «2 Huevo (100 g)»; añadido rápido (qty 0): vacío
export const fmtNum = (n: number) => String(n).replace('.', ',')
export function fmtPortion(p: Portion, base: FoodBase | undefined): string {
  if (!(p.qty > 0)) return ''
  const q = `${fmtNum(p.qty)} ${base ?? 'g'}`
  return p.serving ? `${fmtNum(p.serving.n)} ${p.serving.name} (${q})` : q
}

// Ciclo 30 — platos, nombres de alimentos propios y resumen semanal
export const MAX_MEALS = 20
// Entradas de un plato para `occurredAt`; los ítems con alimento desconocido o archivado cuentan en `missing`
export function mealEntries(m: Meal, foods: Food[], newId: () => string, occurredAt: string): { entries: FoodEntry[]; missing: number } {
  const entries: FoodEntry[] = []
  let missing = 0
  for (const it of m.items) {
    const f = foods.find(x => x.id === it.foodId)
    if (!f || f.archived) { missing++; continue }
    entries.push(makeEntry(f, { qty: it.qty, ...(it.serving ? { serving: it.serving } : {}) }, newId(), occurredAt, 'meal'))
  }
  return { entries, missing }
}
// Plato desde entradas con alimento (en el orden dado, máx. 20 ítems); null si no queda ninguna
export function mealFromEntries(entries: FoodEntry[], name: string, id: string): Meal | null {
  const items = entries.filter(e => e.foodId).slice(0, 20).map(e => ({ foodId: e.foodId!, qty: e.qty, ...(e.serving ? { serving: e.serving } : {}) }))
  return items.length ? { id, name: name.trim(), items } : null
}
// El propio con ese nombre (archivado → «Reactivar»), 'catalog' si ya existe en el catálogo, o null
export function nameTaken(name: string, custom: Food[]): Food | 'catalog' | null {
  const k = fold(name)
  return custom.find(f => fold(f.name) === k) ?? (CATALOG.some(f => fold(f.name) === k) ? 'catalog' : null)
}
// Últimas n semanas lun–dom (la última es la en curso, hasta hoy). E1: la media es sobre los días con registros.
export function foodWeekly(food: FoodData, today: string, n = 8): FoodWeek[] {
  const cur = mondayOf(today), live = liveEntries(food.log)
  return Array.from({ length: n }, (_, i) => {
    const monday = addDays(cur, -7 * (n - 1 - i)), end = addDays(monday, 7), last = addDays(monday, 6)
    const days = [...new Set(live.map(e => e.occurredAt.slice(0, 10)).filter(d => d >= monday && d < end && d <= today))].sort()
    const sum = (k: 'kcal' | 'p' | 'c' | 'f') => r1(days.reduce((a, d) => a + dayTotals(food.log, d)[k], 0) / days.length)
    return {
      monday, days: days.length, current: i === n - 1,
      avg: days.length ? { kcal: sum('kcal'), p: sum('p'), c: sum('c'), f: sum('f') } : null,
      goal: goalOn(food.goals, last < today ? last : today)?.kcal ?? null,
      inRange: days.filter(d => inRange(food, d)).length,
    }
  })
}
