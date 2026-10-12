import type { ActivityEvent, Exercise, GymData, GymDay, GymEntry, GymRecords, GymSet, GymUndo, GroupVolume, MuscleGroup, RecordKind, Routine, WeekBest, WeightUnit } from './types'
import { addDays, clampAmount, dayTotal, mondayOf, undoneIds } from './stats'

export const EMPTY_GYM: GymData = { log: [], exercises: [] }
export const GYM_TRACKER = 'gym'
export const MAX_WEIGHT = 2000
export const STEP: Record<WeightUnit, number> = { kg: 2.5, lbs: 5 }
export const LB_KG = 0.45359237
export const GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: 'chest', label: 'Pecho' },
  { id: 'back', label: 'Espalda' },
  { id: 'legs', label: 'Piernas' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'arms', label: 'Brazos' },
  { id: 'core', label: 'Core' },
]
// Los ids son estables: no se renombran nunca (las series los guardan).
export const EXERCISES: Exercise[] = [
  { id: 'bench-press', name: 'Press banca', group: 'chest', kind: 'load' },
  { id: 'incline-db-press', name: 'Press inclinado con mancuernas', group: 'chest', kind: 'load' },
  { id: 'dips', name: 'Fondos', group: 'chest', kind: 'bodyweight' },
  { id: 'pull-up', name: 'Dominadas', group: 'back', kind: 'bodyweight' },
  { id: 'barbell-row', name: 'Remo con barra', group: 'back', kind: 'load' },
  { id: 'lat-pulldown', name: 'Jalón al pecho', group: 'back', kind: 'load' },
  { id: 'deadlift', name: 'Peso muerto', group: 'back', kind: 'load' },
  { id: 'squat', name: 'Sentadilla', group: 'legs', kind: 'load' },
  { id: 'leg-press', name: 'Prensa', group: 'legs', kind: 'load' },
  { id: 'lunge', name: 'Zancadas', group: 'legs', kind: 'load' },
  { id: 'romanian-deadlift', name: 'Peso muerto rumano', group: 'legs', kind: 'load' },
  { id: 'leg-curl', name: 'Curl femoral', group: 'legs', kind: 'load' },
  { id: 'calf-raise', name: 'Elevación de gemelos', group: 'legs', kind: 'load' },
  { id: 'overhead-press', name: 'Press militar', group: 'shoulders', kind: 'load' },
  { id: 'lateral-raise', name: 'Elevaciones laterales', group: 'shoulders', kind: 'load' },
  { id: 'face-pull', name: 'Face pull', group: 'shoulders', kind: 'load' },
  { id: 'barbell-curl', name: 'Curl de bíceps con barra', group: 'arms', kind: 'load' },
  { id: 'hammer-curl', name: 'Curl martillo', group: 'arms', kind: 'load' },
  { id: 'triceps-pushdown', name: 'Extensión de tríceps en polea', group: 'arms', kind: 'load' },
  { id: 'skull-crusher', name: 'Press francés', group: 'arms', kind: 'load' },
  { id: 'leg-raise', name: 'Elevaciones de piernas', group: 'core', kind: 'bodyweight' },
]
export const allExercises = (custom: Exercise[]) => [...EXERCISES, ...custom]
export const exerciseName = (id: string, custom: Exercise[]) => allExercises(custom).find(x => x.id === id)?.name ?? 'Ejercicio desconocido'

const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100, r3 = (x: number) => Math.round(x * 1000) / 1000
export const toKg = (w: number, u: WeightUnit) => (u === 'kg' ? w : w * LB_KG)
export const convert = (w: number, from: WeightUnit, to: WeightUnit) => (from === to ? w : r1(from === 'kg' ? w / LB_KG : w * LB_KG))
// kg → unidad preferida, a 1 decimal (1RM)
export const fromKg = (kg: number, u: WeightUnit) => r1(u === 'kg' ? kg : kg / LB_KG)
export const kgKey = (s: Pick<GymSet, 'weight' | 'unit'>) => r3(toKg(s.weight, s.unit))

export function parseWeight(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const w = r2(Number(t))
  return w >= 0 && w <= MAX_WEIGHT ? w : null
}
export function parseReps(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 999 ? n : null
}
export const stepWeight = (w: number, u: WeightUnit, dir: 1 | -1) => Math.min(MAX_WEIGHT, Math.max(0, r2(w + dir * STEP[u])))
export const fmtWeight = (w: number, u: WeightUnit) => `${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(w)} ${u}`

// «100 kg × 5»; bodyweight con weight 0: «5 reps»; con lastre: «+10 kg × 5»
export function fmtSet(s: GymSet, pref: WeightUnit, kind: Exercise['kind']): string {
  const w = convert(s.weight, s.unit, pref)
  if (kind === 'bodyweight') return s.weight === 0 ? `${s.reps} reps` : `+${fmtWeight(w, pref)} × ${s.reps}`
  return `${fmtWeight(w, pref)} × ${s.reps}`
}

export const isUndo = (e: GymEntry): e is GymUndo => 'undoes' in e
export function liveSets(log: GymEntry[]): GymSet[] {
  const undone = new Set(log.filter(isUndo).map(u => u.undoes))
  return log.filter((e): e is GymSet => !isUndo(e) && !undone.has(e.id))
}
export const daySets = (log: GymEntry[], day: string) => liveSets(log).filter(s => s.occurredAt.startsWith(day))
export function lastSet(log: GymEntry[], exerciseId?: string): GymSet | undefined {
  let best: GymSet | undefined
  for (const s of liveSets(log)) {
    if (exerciseId !== undefined && s.exerciseId !== exerciseId) continue
    if (!best || s.occurredAt >= best.occurredAt) best = s
  }
  return best
}

export const e1rm = (kg: number, reps: number): number | null => (kg > 0 && reps <= 12 ? (reps === 1 ? kg : kg * (1 + reps / 30)) : null)

export function records(sets: GymSet[]): GymRecords {
  const out: GymRecords = { maxWeight: null, best1rm: null, mostReps: null }
  for (const s of sets) {
    if (s.weight > 0 && (!out.maxWeight || kgKey(s) > kgKey(out.maxWeight))) out.maxWeight = s
    const e = e1rm(toKg(s.weight, s.unit), s.reps)
    if (e !== null && (!out.best1rm || r3(e) > r3(out.best1rm.kg))) out.best1rm = { set: s, kg: e }
    const m = out.mostReps
    if (!m || s.reps > m.reps || (s.reps === m.reps && kgKey(s) > kgKey(m))) out.mostReps = s
  }
  return out
}

export function beaten(prev: GymSet[], s: GymSet): RecordKind[] {
  if (!prev.length) return []
  const out: RecordKind[] = []
  if (s.weight > 0 && kgKey(s) > Math.max(...prev.map(kgKey))) out.push('weight')
  const e = e1rm(toKg(s.weight, s.unit), s.reps), best = records(prev).best1rm
  if (e !== null && best !== null && r3(e) > r3(best.kg)) out.push('1rm')
  const same = prev.filter(p => kgKey(p) === kgKey(s))
  if (same.length && s.reps > Math.max(...same.map(p => p.reps))) out.push('reps')
  return out
}

// «Nuevo récord en Press banca: peso máximo 105 kg · 1RM estimado 122,5 kg · 6 repeticiones con 105 kg»
export function recordText(kinds: RecordKind[], s: GymSet, name: string, pref: WeightUnit, kind: Exercise['kind']): string {
  const w = fmtWeight(convert(s.weight, s.unit, pref), pref)
  const parts = kinds.map(k => {
    if (k === 'weight') return `peso máximo ${w}`
    if (k === '1rm') {
      const kg = e1rm(toKg(s.weight, s.unit), s.reps) ?? 0
      return `1RM estimado ${fmtWeight(fromKg(kg, pref), pref)}`
    }
    return kind === 'bodyweight' && s.weight === 0 ? `${s.reps} repeticiones sin lastre` : `${s.reps} repeticiones con ${w}`
  })
  return `Nuevo récord en ${name}: ${parts.join(' · ')}`
}

// Sesión automática (D1)
export const autoIdRe = (day: string) => new RegExp(`^gym-auto-${day}(-\\d+)?$`)
export function autoSession(events: ActivityEvent[], day: string): ActivityEvent | null {
  if (dayTotal(events, GYM_TRACKER, day) > 0) return null
  const re = autoIdRe(day)
  const n = events.filter(e => re.test(e.id)).length + 1
  return { id: n === 1 ? `gym-auto-${day}` : `gym-auto-${day}-${n}`, trackerId: GYM_TRACKER, amount: 1, occurredAt: `${day}T12:00:00` }
}
export function retractAuto(events: ActivityEvent[], log: GymEntry[], day: string, newId: () => string): ActivityEvent[] {
  if (daySets(log, day).length > 0) return []
  const re = autoIdRe(day), undone = undoneIds(events)
  const autos = events.filter(e => re.test(e.id) && e.amount > 0 && !undone.has(e.id)).reverse()
  const out: ActivityEvent[] = []
  for (const a of autos) {
    if (clampAmount([...events, ...out], GYM_TRACKER, day, -1) === -1)
      out.push({ id: newId(), trackerId: GYM_TRACKER, amount: -1, occurredAt: a.occurredAt, undoes: a.id })
  }
  return out
}

// Regla: día con series vivas ⇒ al menos 1 sesión de Gym. Devuelve las sesiones automáticas que faltan (idempotente).
export function ensureAuto(events: ActivityEvent[], log: GymEntry[], days: string[]): ActivityEvent[] {
  const out: ActivityEvent[] = []
  for (const day of [...new Set(days)]) {
    if (daySets(log, day).length === 0) continue
    const ev = autoSession([...events, ...out], day)
    if (ev) out.push(ev)
  }
  return out
}
// Días con series vivas, ordenados
export const setDays = (log: GymEntry[]): string[] => [...new Set(liveSets(log).map(s => s.occurredAt.slice(0, 10)))].sort()

// Mejor 1RM estimado por semana (n semanas, la última es la en curso); solo series vivas del ejercicio; sin dato → null
export function weeklyBest1rm(log: GymEntry[], exerciseId: string, today: string, n = 8): WeekBest[] {
  const cur = mondayOf(today), mine = liveSets(log).filter(s => s.exerciseId === exerciseId)
  return Array.from({ length: n }, (_, i) => {
    const monday = addDays(cur, -7 * (n - 1 - i)), end = addDays(monday, 7)
    let kg: number | null = null
    for (const s of mine) {
      const d = s.occurredAt.slice(0, 10)
      if (d < monday || d >= end) continue
      const e = e1rm(toKg(s.weight, s.unit), s.reps)
      if (e !== null && (kg === null || e > kg)) kg = e
    }
    return { monday, kg, current: i === n - 1 }
  })
}

// Series y volumen (Σ kg×reps, kg normalizados) por grupo: semana en curso hasta hoy frente al mismo tramo de la anterior.
// ponytail: un ejercicio que no está en el catálogo ni en los propios (p. ej. de otra copia) no tiene grupo y se ignora.
export function groupVolume(log: GymEntry[], custom: Exercise[], today: string): GroupVolume[] {
  const mon = mondayOf(today), pMon = addDays(mon, -7), pEnd = addDays(today, -7), all = allExercises(custom)
  const out: GroupVolume[] = GROUPS.map(g => ({ group: g.id, label: g.label, sets: 0, kg: 0, prevSets: 0, prevKg: 0 }))
  for (const s of liveSets(log)) {
    const d = s.occurredAt.slice(0, 10), cur = d >= mon && d <= today, prev = d >= pMon && d <= pEnd
    if (!cur && !prev) continue
    const x = all.find(e => e.id === s.exerciseId)
    if (!x) continue
    const row = out.find(r => r.group === x.group)!, kg = toKg(s.weight, s.unit) * s.reps
    if (cur) { row.sets++; row.kg += kg } else { row.prevSets++; row.prevKg += kg }
  }
  return out
}

export function gymDay(log: GymEntry[], day: string): GymDay {
  const sets = daySets(log, day)
  return { sets: sets.length, exercises: new Set(sets.map(s => s.exerciseId)).size }
}

export const MAX_ROUTINES = 20
export const MAX_ROUTINE_ITEMS = 20
export const MAX_ROUTINE_SETS = 10

// Ítems en orden de primera serie viva del día; sets = min(10, nº de series). null si el día no tiene series.
export function routineFromDay(log: GymEntry[], day: string, name: string, id: string): Routine | null {
  const items: Routine['items'] = []
  for (const s of daySets(log, day)) {
    const it = items.find(x => x.exerciseId === s.exerciseId)
    if (it) it.sets = Math.min(MAX_ROUTINE_SETS, it.sets + 1); else items.push({ exerciseId: s.exerciseId, sets: 1 })
  }
  return items.length ? { id, name, items: items.slice(0, MAX_ROUTINE_ITEMS) } : null
}

// done = series vivas de ese ejercicio en `day`; complete = done >= sets
export function routineProgress(r: Routine, log: GymEntry[], day: string): { exerciseId: string; sets: number; done: number; complete: boolean }[] {
  const today = daySets(log, day)
  return r.items.map(i => {
    const done = today.filter(s => s.exerciseId === i.exerciseId).length
    return { exerciseId: i.exerciseId, sets: i.sets, done, complete: done >= i.sets }
  })
}
