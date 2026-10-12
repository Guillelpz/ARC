import type { ActivityEvent, CustomData, GoalLogEntry, GymData, GymEntry, Proposal, Tracker } from './types'
import { isUndo as isGymUndo } from './gym'
import { EMPTY_GYM } from './storage'
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
  conflicts: string[] // nombres locales donde la copia difiere; se mantiene lo local
  changed: boolean
}
type Side = { events: ActivityEvent[]; custom: CustomData; gym?: GymData }

const same = (a: ActivityEvent, b: ActivityEvent) => a.trackerId === b.trackerId && a.amount === b.amount && a.occurredAt === b.occurredAt
const sameEntry = (a: GymEntry, b: GymEntry) => isGymUndo(a) || isGymUndo(b)
  ? isGymUndo(a) && isGymUndo(b) && a.undoes === b.undoes && a.occurredAt === b.occurredAt
  : a.exerciseId === b.exerciseId && a.weight === b.weight && a.unit === b.unit && a.reps === b.reps && a.occurredAt === b.occurredAt
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
    events, custom, added, existing, renamed, trackersAdded: newTrackers.length, conflicts: [...conflicts, ...exConflicts], gym, setsAdded: gl.added, exercisesAdded: newEx.length,
    changed: added > 0 || gl.added > 0 || newEx.length > 0 || newTrackers.length > 0 || newProps.length > 0 || newLog.length > 0,
  }
}
