import type { ActivityEvent, CustomData, FoodData, FoodEntry, FoodGoal, FoodLogEntry, GoalLogEntry, GymData, GymEntry, Proposal, Tracker } from './types'
import { EMPTY_GYM, isUndo as isGymUndo } from './gym'
import { EMPTY_FOOD, isFoodUndo } from './food'
import { defaultGoal, isFixedVillain, TRACKERS } from './trackers'

export type MergeResult = {
  events: ActivityEvent[] // local + nuevos (locales primero, luego los entrantes añadidos en el orden del archivo)
  custom: CustomData
  added: number // eventos añadidos (incluye renamed)
  existing: number // entrantes que ya estaban (idénticos o deshacer duplicado)
  renamed: number // añadidos con id `~n` por colisión
  trackersAdded: number
  gym: GymData
  setsAdded: number // entradas de log del gym añadidas (incluye renombradas)
  exercisesAdded: number
  routinesAdded: number
  food: FoodData
  foodAdded: number // entradas de log de comida añadidas (incluye renombradas)
  foodsAdded: number
  mealsAdded: number
  goalsAdded: number
  conflicts: string[] // nombres locales donde la copia difiere; se mantiene lo local
  changed: boolean
}
type Side = { events: ActivityEvent[]; custom: CustomData; gym?: GymData; food?: FoodData | null }

const same = (a: ActivityEvent, b: ActivityEvent) => a.trackerId === b.trackerId && a.amount === b.amount && a.occurredAt === b.occurredAt
const sameEntry = (a: GymEntry, b: GymEntry) => isGymUndo(a) || isGymUndo(b)
  ? isGymUndo(a) && isGymUndo(b) && a.undoes === b.undoes && a.occurredAt === b.occurredAt
  : a.exerciseId === b.exerciseId && a.weight === b.weight && a.unit === b.unit && a.reps === b.reps && a.occurredAt === b.occurredAt
const sameFood = (a: FoodLogEntry, b: FoodLogEntry) => isFoodUndo(a) || isFoodUndo(b)
  ? isFoodUndo(a) && isFoodUndo(b) && a.undoes === b.undoes && a.occurredAt === b.occurredAt
  : JSON.stringify([a.name, a.kcal, a.p, a.c, a.f, a.qty, a.serving, a.foodId, a.occurredAt]) === JSON.stringify([(b as FoodEntry).name, (b as FoodEntry).kcal, (b as FoodEntry).p, (b as FoodEntry).c, (b as FoodEntry).f, (b as FoodEntry).qty, (b as FoodEntry).serving, (b as FoodEntry).foodId, b.occurredAt])
const sig = (t: Tracker) => JSON.stringify([t.name, t.increment, t.weeklyGoal ?? null, t.weeklyLimit ?? null, !!t.archived, t.branch, t.type, t.unit, t.xpPerUnit])

// ponytail: (1) lo borrado con «Borrar todo», importar o restoreLast y que sigue en la copia vuelve: sin servidor ni fecha de
// creación por evento no se distingue; hace falta `createdAt` por evento o un servidor.
// (2) Dos correcciones (negativos sin `undoes`) del mismo registro hechas en los dos dispositivos restan dos veces; se corrige con «+».
// (3) La misma actividad apuntada a mano en los dos dispositivos son dos registros distintos (ids distintos).
// Fusión genérica de un log solo de añadir (eventos y series de gym): ids en conflicto → `id~n` y se reasigna `undoes`.
function mergeLog<T extends { id: string; undoes?: string }>(local: T[], incoming: T[], same: (a: T, b: T) => boolean, isUndo: (e: T) => boolean):
  { list: T[]; added: number; existing: number; renamed: number } {
  const byId = new Map(local.map(e => [e.id, e]))
  const undone = new Set(local.flatMap(e => (isUndo(e) && e.undoes ? [e.undoes] : [])))
  const rename = new Map<string, string>()
  const plan: { e: T; id: string; exists: boolean }[] = []
  for (const e of incoming) {
    let id = e.id, n = 1, exists = false
    for (;;) {
      const l = byId.get(id)
      if (!l) break
      if (same(l, e)) { exists = true; break }
      id = `${e.id}~${++n}`
    }
    if (id !== e.id) rename.set(e.id, id)
    if (!exists) byId.set(id, e)
    plan.push({ e, id, exists })
  }
  const list = [...local]
  let added = 0, existing = 0, renamed = 0
  for (const { e, id, exists } of plan) {
    if (exists) { existing++; continue }
    const u = e.undoes !== undefined ? rename.get(e.undoes) ?? e.undoes : undefined
    if (isUndo(e) && u && undone.has(u)) { existing++; continue }
    list.push({ ...e, id, ...(u && { undoes: u }) })
    added++
    if (id !== e.id) renamed++
    if (isUndo(e) && u) undone.add(u)
  }
  return { list, added, existing, renamed }
}

export function mergeBackup(local: Side, incoming: Side): MergeResult {
  const { list: events, added, existing, renamed } = mergeLog(local.events, incoming.events, same, e => e.amount < 0 && !!e.undoes)
  const lg = local.gym ?? EMPTY_GYM, ig = incoming.gym ?? EMPTY_GYM
  const gl = mergeLog<GymEntry>(lg.log, ig.log, sameEntry, isGymUndo)
  const lex = new Map(lg.exercises.map(x => [x.id, x]))
  const newEx = ig.exercises.filter(x => !lex.has(x.id))
  const exConflicts: string[] = []
  for (const x of ig.exercises) {
    const l = lex.get(x.id)
    if (l && JSON.stringify([l.name, l.group, l.kind, !!l.archived]) !== JSON.stringify([x.name, x.group, x.kind, !!x.archived])) exConflicts.push(l.name)
  }
  const gym: GymData = { ...lg, log: gl.list, exercises: [...lg.exercises, ...newEx] }
  // rutinas: se añaden las de la copia con id nuevo; mismo id y otro contenido → se mantiene la local y su nombre sale en conflictos
  const lr = new Map((lg.routines ?? []).map(r => [r.id, r]))
  const newRt = (ig.routines ?? []).filter(r => !lr.has(r.id))
  const rtConflicts: string[] = []
  for (const r of ig.routines ?? []) {
    const l = lr.get(r.id)
    if (l && JSON.stringify([l.name, l.items]) !== JSON.stringify([r.name, r.items])) rtConflicts.push(l.name)
  }
  const routines = [...(lg.routines ?? []), ...newRt]
  if (routines.length > 0) gym.routines = routines
  else delete gym.routines

  // comida: log como el gym; alimentos y platos por id (conflicto → gana el local); objetivos por `from`
  const lf = local.food ?? EMPTY_FOOD, inf = incoming.food ?? EMPTY_FOOD
  const fl = mergeLog<FoodLogEntry>(lf.log, inf.log, sameFood, isFoodUndo)
  const lfo = new Map(lf.foods.map(x => [x.id, x])), newFoods = inf.foods.filter(x => !lfo.has(x.id))
  const foodConflicts: string[] = []
  const fsig = (x: FoodData['foods'][number]) => JSON.stringify([x.name, x.base, x.kcal, x.p, x.c, x.f, !!x.archived])
  for (const x of inf.foods) { const l = lfo.get(x.id); if (l && fsig(l) !== fsig(x)) foodConflicts.push(l.name) }
  const lm = new Map((lf.meals ?? []).map(m => [m.id, m])), newMeals = (inf.meals ?? []).filter(m => !lm.has(m.id))
  for (const m of inf.meals ?? []) { const l = lm.get(m.id); if (l && JSON.stringify([l.name, l.items]) !== JSON.stringify([m.name, m.items])) foodConflicts.push(l.name) }
  const lgo = new Map((lf.goals ?? []).map(g => [g.from, g])), newGoals: FoodGoal[] = (inf.goals ?? []).filter(g => !lgo.has(g.from))
  const gsig = (g: FoodGoal) => JSON.stringify([g.kcal, g.p, g.c, g.f])
  if ((inf.goals ?? []).some(g => { const l = lgo.get(g.from); return l && gsig(l) !== gsig(g) })) foodConflicts.push('Objetivo de calorías')
  const food: FoodData = { ...lf, log: fl.list, foods: [...lf.foods, ...newFoods] }
  const goals = [...(lf.goals ?? []), ...newGoals].sort((a, b) => a.from.localeCompare(b.from))
  if (goals.length > 0) food.goals = goals; else delete food.goals
  const meals = [...(lf.meals ?? []), ...newMeals]
  if (meals.length > 0) food.meals = meals; else delete food.meals

  const lc = local.custom, ic = incoming.custom
  const localById = new Map(lc.trackers.map(t => [t.id, t]))
  const conflicts: string[] = []
  const newTrackers = ic.trackers.filter(t => !localById.has(t.id))
  for (const t of ic.trackers) {
    const l = localById.get(t.id)
    if (l && sig(l) !== sig(t)) conflicts.push(l.name)
  }
  for (const t of TRACKERS) {
    const def = defaultGoal(t.id)
    if (def !== undefined && (lc.goals?.[t.id] ?? def) !== (ic.goals?.[t.id] ?? def)) conflicts.push(t.name)
  }
  for (const t of TRACKERS) if (isFixedVillain(t.id) && (lc.limits?.[t.id] ?? null) !== (ic.limits?.[t.id] ?? null)) conflicts.push(t.name)
  const addedIds = new Set(newTrackers.map(t => t.id))
  const newLog: GoalLogEntry[] = (ic.goalLog ?? []).filter(e => addedIds.has(e.trackerId))
  const goalLog = [...(lc.goalLog ?? []), ...newLog]
  const has = new Set(lc.proposals.map(p => `${p.trackerId}|${p.partyId}`))
  const newProps: Proposal[] = []
  for (const p of ic.proposals) {
    const k = `${p.trackerId}|${p.partyId}`
    if (!has.has(k)) { has.add(k); newProps.push(p) }
  }
  const custom: CustomData = { ...lc, trackers: [...lc.trackers, ...newTrackers], proposals: [...lc.proposals, ...newProps] }
  if (goalLog.length > 0) custom.goalLog = goalLog
  else delete custom.goalLog
  if (custom.goals && Object.keys(custom.goals).length === 0) delete custom.goals
  if (custom.limits && Object.keys(custom.limits).length === 0) delete custom.limits
  return {
    events, custom, added, existing, renamed, trackersAdded: newTrackers.length, conflicts: [...conflicts, ...exConflicts, ...rtConflicts, ...foodConflicts], gym, setsAdded: gl.added, exercisesAdded: newEx.length, routinesAdded: newRt.length,
    food, foodAdded: fl.added, foodsAdded: newFoods.length, mealsAdded: newMeals.length, goalsAdded: newGoals.length,
    changed: fl.added > 0 || newFoods.length > 0 || newMeals.length > 0 || newGoals.length > 0 || added > 0 || gl.added > 0 || newEx.length > 0 || newRt.length > 0 || newTrackers.length > 0 || newProps.length > 0 || newLog.length > 0,
  }
}
