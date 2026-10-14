import type { Food, FoodData, FoodDay, FoodEntry, FoodGoal, FoodLogEntry, FoodUndo, Nutrients, Portion } from './types'
import { CATALOG } from './foodCatalog'
import { addDays } from './stats'

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
