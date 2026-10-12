import type { ActivityEvent, Exercise, GymEntry, GymRecords, GymSet, GymUndo, MuscleGroup, RecordKind, WeightUnit } from './types'
import { clampAmount, dayTotal, undoneIds } from './stats'

export const GYM_TRACKER = 'gym'
export const MAX_WEIGHT = 2000
export const STEP: Record<WeightUnit, number> = { kg: 2.5, lbs: 5 }
export const LB_KG = 0.45359237
export const GROUPS: { id: MuscleGroup; label: string }[] = []
export const EXERCISES: Exercise[] = []
export const allExercises = (custom: Exercise[]) => [...EXERCISES, ...custom]
export const exerciseName = (id: string, custom: Exercise[]) => allExercises(custom).find(x => x.id === id)?.name ?? 'Ejercicio desconocido'

const r1 = (x: number) => Math.round(x * 10) / 10, r2 = (x: number) => Math.round(x * 100) / 100, r3 = (x: number) => Math.round(x * 1000) / 1000
export const toKg = (w: number, u: WeightUnit) => (u === 'kg' ? w : w * LB_KG)
export const convert = (w: number, from: WeightUnit, to: WeightUnit) => (from === to ? w : r1(from === 'kg' ? w / LB_KG : w * LB_KG))
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
      return `1RM estimado ${fmtWeight(r1(pref === 'kg' ? kg : kg / LB_KG), pref)}`
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
