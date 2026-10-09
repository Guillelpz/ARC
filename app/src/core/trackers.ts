import type { GoalLogEntry, Goals, PastGoal, Tracker } from './types'
import { mondayOf } from './stats'

export const TRACKERS: Tracker[] = [
  { id: 'gym', name: 'Gym', branch: 'hero', type: 'count', unit: 'sesiones', increment: 1, buttonLabel: '+1 sesión', xpPerUnit: 30, weeklyGoal: 4 },
  { id: 'bjj', name: 'BJJ', branch: 'hero', type: 'count', unit: 'clases', increment: 1, buttonLabel: '+1 clase', xpPerUnit: 30, weeklyGoal: 3 },
  { id: 'running', name: 'Running', branch: 'hero', type: 'distance', unit: 'km', increment: 5, buttonLabel: '+5 km', xpPerUnit: 5, weeklyGoal: 20 },
  { id: 'reading', name: 'Reading', branch: 'hero', type: 'duration', unit: 'min', increment: 30, buttonLabel: '+30 min', xpPerUnit: 1, weeklyGoal: 120 },
  { id: 'beer', name: 'Beer', branch: 'villain', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 15 },
  { id: 'burgers', name: 'Burgers', branch: 'villain', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 20 },
]

// ponytail: singular solo para las unidades de las fijas y por defecto; las unidades propias se quedan como están. Ampliar el Map si hace falta.
const SINGULAR = new Map([['sesiones', 'sesión'], ['clases', 'clase'], ['unidades', 'unidad']])
export const unitFor = (n: number, unit: string) => (Math.abs(n) === 1 ? SINGULAR.get(unit) ?? unit : unit)

export const defaultGoal = (id: string): number | undefined => TRACKERS.find(t => t.id === id)?.weeklyGoal

// Devuelve `log` (misma referencia) si no hay cambio o ya hay apunte de esta semana (cuenta el primero).
// ponytail: crece como mucho una entrada por actividad y semana con cambio; sin compactar. Compactar si algún día pesa.
export function logGoal(log: GoalLogEntry[] = [], trackerId: string, old: number | null, next: number | null, today: string): GoalLogEntry[] {
  if (old === next) return log
  const until = mondayOf(today)
  if (log.some(e => e.trackerId === trackerId && e.until === until)) return log
  return [...log, { trackerId, goal: old, until }]
}

export function allTrackers(custom: Tracker[], goals: Goals = {}, goalLog: GoalLogEntry[] = []): Tracker[] {
  const past = new Map<string, PastGoal[]>()
  for (const { trackerId, goal, until } of [...goalLog].sort((a, b) => a.until.localeCompare(b.until))) // estable: empate → el primero apuntado
    past.set(trackerId, [...(past.get(trackerId) ?? []), { goal, until }])
  const withPast = (t: Tracker): Tracker => {
    const p = past.get(t.id)
    if (!p && !t.pastGoals) return t // mantiene la identidad de TRACKERS
    const { pastGoals: _, ...b } = t
    return p ? { ...b, pastGoals: p } : b
  }
  return [...TRACKERS.map(t => (goals[t.id] && t.weeklyGoal ? { ...t, weeklyGoal: goals[t.id] } : t)), ...custom].map(withPast)
}

// Devuelve un objeto nuevo. Sin la clave `id` si: goal null o redondeado < 1, igual al valor por defecto,
// o `id` no es una fija con objetivo (en ese caso devuelve `goals` sin tocar).
export function setGoal(goals: Goals = {}, id: string, goal: number | null): Goals {
  const def = defaultGoal(id)
  if (def === undefined) return goals
  const { [id]: _old, ...rest } = goals
  const g = goal === null ? 0 : Math.round(goal)
  return g < 1 || g === def ? rest : { ...rest, [id]: g }
}
