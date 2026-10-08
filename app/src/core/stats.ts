import type { ActivityEvent, HistoryRow, Tracker } from './types'

export const addDays = (d: string, n: number): string => {
  const t = new Date(d + 'T00:00:00Z')
  t.setUTCDate(t.getUTCDate() + n)
  return t.toISOString().slice(0, 10)
}

// fecha local del navegador; no usar toISOString (UTC: desfasa el día cerca de medianoche)
export const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const mondayOf = (d: string): string =>
  addDays(d, -((new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7))

// [start, end) con strings YYYY-MM-DD; la comparación lexicográfica es correcta con el formato fijo
export const total = (events: ActivityEvent[], trackerId: string, start = '', end = '9999') =>
  events
    .filter(e => e.trackerId === trackerId && e.occurredAt >= start && e.occurredAt < end)
    .reduce((s, e) => s + e.amount, 0)

// total neto de un día [day, day+1)
export const dayTotal = (events: ActivityEvent[], trackerId: string, day: string) =>
  total(events, trackerId, day, addDays(day, 1))

// redondea; una corrección no deja el día por debajo de 0 (si ya lo está, no resta nada)
export const clampAmount = (events: ActivityEvent[], trackerId: string, day: string, amount: number) =>
  Math.max(Math.round(amount), -Math.max(0, dayTotal(events, trackerId, day)))

// ponytail: recorre todos los eventos por tarjeta y render (O(n·tarjetas)); indexar por trackerId si se nota.
export function history(events: ActivityEvent[], trackerId: string, limit = 10): HistoryRow[] {
  const undone = new Set(events.flatMap(e => (e.undoes ? [e.undoes] : [])))
  return events.filter(e => e.trackerId === trackerId).reverse() // empate: último insertado primero
    .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : a.occurredAt > b.occurredAt ? -1 : 0)) // sort estable
    .slice(0, limit)
    .map(e => ({
      event: e,
      undone: undone.has(e.id),
      canUndo: e.amount > 0 && !undone.has(e.id) && dayTotal(events, trackerId, e.occurredAt.slice(0, 10)) >= e.amount,
    }))
}

export const dayLabel = (day: string, today: string) =>
  day === today ? 'Hoy' : day === addDays(today, -1) ? 'Ayer'
    : new Date(day + 'T00:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

export function trackerStats(t: Tracker, events: ActivityEvent[], today: string) {
  const thisStart = mondayOf(today)
  const thisEnd = addDays(today, 1) // exclusivo
  const week = total(events, t.id, thisStart, thisEnd)
  const prev = total(events, t.id, addDays(thisStart, -7), addDays(thisEnd, -7))
  const allTime = total(events, t.id)
  return {
    week, prev, diff: week - prev, allTime,
    goalPct: t.weeklyGoal ? (week / t.weeklyGoal) * 100 : null,
  }
}

// orden por último uso (solo eventos positivos: una corrección no es uso); sin uso primero, así
// una misión recién creada no queda al fondo; empates en el orden original (sort estable)
export function byRecent(trackers: Tracker[], events: ActivityEvent[]): Tracker[] {
  const last = new Map<string, string>()
  for (const e of events) if (e.amount > 0 && e.occurredAt > (last.get(e.trackerId) ?? '')) last.set(e.trackerId, e.occurredAt)
  const key = (t: Tracker) => last.get(t.id) ?? '￿'
  return [...trackers].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0))
}
