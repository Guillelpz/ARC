import type { ActivityEvent, HistoryRow, TodaySummary, Tracker, TrackerStats } from './types'

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

// solo un negativo con undoes anula; un positivo con undoes (datos importados/editados) no
export const undoneIds = (events: ActivityEvent[]) =>
  new Set(events.flatMap(e => (e.undoes && e.amount < 0 ? [e.undoes] : [])))

// ponytail: recorre todos los eventos por tarjeta y render (O(n·tarjetas)); indexar por trackerId si se nota.
export function history(events: ActivityEvent[], trackerId: string, limit = 10): HistoryRow[] {
  const undone = undoneIds(events)
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

// ponytail: usa el weeklyGoal actual también para semanas pasadas (si baja el objetivo, la racha
// crece hacia atrás); guardar el histórico de objetivos si importa. O(semanas · eventos del tracker).
export function streak(events: ActivityEvent[], t: Tracker, today: string): number {
  const goal = t.weeklyGoal
  if (!goal) return 0
  const own = events.filter(e => e.trackerId === t.id)
  if (!own.length) return 0
  const first = mondayOf(own.reduce((m, e) => (e.occurredAt < m ? e.occurredAt : m), own[0].occurredAt).slice(0, 10))
  const cur = mondayOf(today)
  let n = total(own, t.id, cur, addDays(today, 1)) >= goal ? 1 : 0 // la semana en curso suma, no rompe
  for (let w = addDays(cur, -7); w >= first; w = addDays(w, -7)) {
    if (total(own, t.id, w, addDays(w, 7)) < goal) break
    n++
  }
  return n
}

export function trackerStats(t: Tracker, events: ActivityEvent[], today: string) {
  const thisStart = mondayOf(today)
  const thisEnd = addDays(today, 1) // exclusivo
  const week = total(events, t.id, thisStart, thisEnd)
  const prev = total(events, t.id, addDays(thisStart, -7), addDays(thisEnd, -7))
  const allTime = total(events, t.id)
  return {
    week, prev, diff: week - prev, allTime,
    goalPct: t.weeklyGoal ? (week / t.weeklyGoal) * 100 : null,
    streak: streak(events, t, today),
  }
}

// lunes = 7 … domingo = 1
export const daysLeftInWeek = (today: string) => 7 - ((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7)

// archivadas fuera; XP neto por rama de hoy, registrado hoy, objetivos pendientes
export function todaySummary(events: ActivityEvent[], stats: TrackerStats[], today: string): TodaySummary {
  const live = stats.filter(s => !s.tracker.archived)
  const todays = events.filter(e => e.occurredAt.slice(0, 10) === today)
  const xp: TodaySummary['xp'] = { hero: 0, villain: 0 }
  const done: TodaySummary['done'] = []
  for (const { tracker: t } of live) {
    const net = todays.reduce((n, e) => (e.trackerId === t.id ? n + e.amount : n), 0)
    xp[t.branch] += net * t.xpPerUnit
    if (net > 0) done.push({ tracker: t, amount: net })
  }
  const missing = live.flatMap(s => s.tracker.weeklyGoal && s.week < s.tracker.weeklyGoal
    ? [{ tracker: s.tracker, left: s.tracker.weeklyGoal - s.week }] : [])
  const top = live.reduce<TrackerStats | null>((m, s) => (s.streak > (m?.streak ?? 0) ? s : m), null) // empate: el primero
  return { xp, done, missing, daysLeft: daysLeftInWeek(today), best: top && { tracker: top.tracker, weeks: top.streak } }
}

// orden por último uso (solo eventos positivos: una corrección no es uso); sin uso primero, así
// una misión recién creada no queda al fondo; empates en el orden original (sort estable)
export function byRecent(trackers: Tracker[], events: ActivityEvent[]): Tracker[] {
  const last = new Map<string, string>()
  for (const e of events) if (e.amount > 0 && e.occurredAt > (last.get(e.trackerId) ?? '')) last.set(e.trackerId, e.occurredAt)
  const key = (t: Tracker) => last.get(t.id) ?? '￿'
  return [...trackers].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0))
}
