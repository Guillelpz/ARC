import type { ActivityEvent, CustomData, Exercise, Food, FoodData, FoodGoal, FoodLogEntry, GoalLogEntry, Goals, GymData, GymEntry, Limits, Meal, Proposal, Routine, Tracker } from './types'
import { defaultGoal, isFixedVillain } from './trackers'
import { mondayOf } from './stats'
import { EMPTY_GYM } from './gym'
import { EMPTY_FOOD } from './food'
import { readMemo, type Memo } from './memory'

const KEY = 'life-rpg-demo-v1'
const CUSTOM_KEY = 'life-rpg-custom-v1'
export const GYM_KEY = 'life-rpg-gym-v1'
export const FOOD_KEY = 'life-rpg-food-v1'
export const EMPTY_CUSTOM: CustomData = { trackers: [], proposals: [] }
export { EMPTY_GYM, EMPTY_FOOD }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const json = (raw: string): unknown => { try { return JSON.parse(raw) } catch { return undefined } }
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const isEvent = (e: unknown): e is ActivityEvent => isObj(e) && typeof e.id === 'string' && e.id !== '' &&
  typeof e.trackerId === 'string' && typeof e.amount === 'number' && Number.isFinite(e.amount) &&
  typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)

export type Parsed<T> = { data: T; dropped: number; fixed: number } | null // null = ilegible

export function readEvents(v: unknown): Parsed<ActivityEvent[]> {
  if (!Array.isArray(v)) return null
  let dropped = 0, fixedC = 0
  const data: ActivityEvent[] = []
  for (const e of v) {
    if (!isEvent(e)) { dropped++; continue }
    if (e.undoes !== undefined && (typeof e.undoes !== 'string' || e.undoes === '')) {
      const fixed = { ...e }; delete fixed.undoes; data.push(fixed); fixedC++ // reparado: se conserva sin el campo
    } else data.push(e)
  }
  return { data, dropped, fixed: fixedC }
}

// '__proto__' no es un campo: está para que el bucle de claves desconocidas no haga data['__proto__'] = x, que cambiaría el prototipo.
const KNOWN = new Set(['trackers', 'proposals', 'goals', 'goalLog', 'limits', '__proto__'])

export function readCustom(v: unknown): Parsed<CustomData> {
  if (!isObj(v)) return null
  if ((v.trackers !== undefined && !Array.isArray(v.trackers)) || (v.proposals !== undefined && !Array.isArray(v.proposals))) return null
  const rawT: unknown[] = v.trackers ?? []
  const rawP: unknown[] = v.proposals ?? []
  let fixedN = 0
  const trackers: Tracker[] = []
  for (const t of rawT) {
    if (!(isObj(t) && typeof t.id === 'string' && typeof t.name === 'string' && (t.branch === 'hero' || t.branch === 'villain') &&
      Number.isFinite(t.increment) && Number.isFinite(t.xpPerUnit))) continue
    const fixed = { ...t } as Tracker
    let bad = false
    if (t.weeklyGoal !== undefined && !(t.branch === 'hero' && typeof t.weeklyGoal === 'number' && Number.isFinite(t.weeklyGoal) && t.weeklyGoal > 0)) { delete fixed.weeklyGoal; bad = true }
    if (t.weeklyLimit !== undefined && !(t.branch === 'villain' && typeof t.weeklyLimit === 'number' && Number.isFinite(t.weeklyLimit) && t.weeklyLimit > 0)) { delete fixed.weeklyLimit; bad = true }
    if (t.archived !== undefined && typeof t.archived !== 'boolean') { delete fixed.archived; bad = true }
    if (bad) fixedN++
    trackers.push(fixed)
  }
  const proposals = rawP.filter((p): p is Proposal => isObj(p) &&
    typeof p.trackerId === 'string' && typeof p.partyId === 'string')
  let gDropped = 0
  const goals: Goals = {}
  if (v.goals !== undefined) {
    if (!isObj(v.goals)) gDropped = 1
    else for (const [id, g] of Object.entries(v.goals)) {
      if (defaultGoal(id) !== undefined && typeof g === 'number' && Number.isInteger(g) && g >= 1) goals[id] = g
      else gDropped++
    }
  }
  const limits: Limits = {}
  if (v.limits !== undefined) {
    if (!isObj(v.limits)) gDropped++
    else for (const [id, l] of Object.entries(v.limits)) {
      if (isFixedVillain(id) && typeof l === 'number' && Number.isInteger(l) && l >= 1) limits[id] = l
      else gDropped++
    }
  }
  const goalLog: GoalLogEntry[] = []
  if (v.goalLog !== undefined) {
    if (!Array.isArray(v.goalLog)) gDropped++
    else for (const e of v.goalLog) {
      if (isObj(e) && typeof e.trackerId === 'string' && e.trackerId !== '' &&
        (e.goal === null || (typeof e.goal === 'number' && Number.isFinite(e.goal) && e.goal > 0)) &&
        typeof e.until === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.until) && mondayOf(e.until) === e.until)
        goalLog.push({ trackerId: e.trackerId, goal: e.goal, until: e.until })
      else gDropped++
    }
  }
  // ponytail: las claves desconocidas se copian sin validar. Una versión anterior conserva p. ej. `goalLog`, pero no lo actualiza
  // si cambia un objetivo. Cuando haga falta una migración real: número de versión de esquema.
  const data = { trackers, proposals } as CustomData
  for (const [k, x] of Object.entries(v)) if (!KNOWN.has(k)) (data as Record<string, unknown>)[k] = x
  if (Object.keys(goals).length > 0) data.goals = goals
  if (goalLog.length > 0) data.goalLog = goalLog
  if (Object.keys(limits).length > 0) data.limits = limits
  return { data, dropped: rawT.length - trackers.length + rawP.length - proposals.length + gDropped, fixed: fixedN }
}

const GROUP_IDS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']
const isStr = (v: unknown): v is string => typeof v === 'string' && v !== ''
const validEntry = (e: unknown): e is GymEntry => {
  if (!isObj(e)) return false
  if ('undoes' in e) return isStr(e.id) && isStr(e.undoes) && typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)
  return isStr(e.id) && isStr(e.exerciseId) && typeof e.weight === 'number' && Number.isFinite(e.weight) && e.weight >= 0 && e.weight <= 2000 &&
    (e.unit === 'kg' || e.unit === 'lbs') && typeof e.reps === 'number' && Number.isInteger(e.reps) && e.reps >= 1 && e.reps <= 999 &&
    typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)
}
const KNOWN_GYM = new Set(['log', 'exercises', 'unit', 'routines', '__proto__'])

// Rutina no válida → null (se descarta); ítems no válidos o repetidos → se quitan (`fixed`); más de 20 → se recorta. exerciseId desconocido: se conserva.
function readRoutine(x: unknown): { r: Routine; fixed: number } | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id.startsWith('routine-') || x.id.length <= 8 || typeof x.name !== 'string' ||
    x.name.trim().length < 1 || x.name.trim().length > 40 || !Array.isArray(x.items)) return null
  const items: Routine['items'] = []
  let fixed = 0
  for (const i of x.items) {
    if (isObj(i) && isStr(i.exerciseId) && typeof i.sets === 'number' && Number.isInteger(i.sets) && i.sets >= 1 && i.sets <= 10 && !items.some(y => y.exerciseId === i.exerciseId)) {
      if (items.length < 20) items.push({ exerciseId: i.exerciseId, sets: i.sets }); else fixed++
    } else fixed++
  }
  return items.length ? { r: { id: x.id, name: x.name, items }, fixed } : null
}

export function readGym(v: unknown): Parsed<GymData> {
  if (!isObj(v)) return null
  if ((v.log !== undefined && !Array.isArray(v.log)) || (v.exercises !== undefined && !Array.isArray(v.exercises))) return null
  const rawL: unknown[] = v.log ?? [], rawE: unknown[] = v.exercises ?? []
  const log = rawL.filter(validEntry)
  let fixedN = 0
  const exercises: Exercise[] = []
  for (const x of rawE) {
    if (!(isObj(x) && typeof x.id === 'string' && x.id.startsWith('custom-') && typeof x.name === 'string' && x.name.trim().length >= 1 && x.name.trim().length <= 40 &&
      typeof x.group === 'string' && GROUP_IDS.includes(x.group) && (x.kind === 'load' || x.kind === 'bodyweight'))) continue
    const e = { ...x } as Exercise
    if (x.archived !== undefined && typeof x.archived !== 'boolean') { delete e.archived; fixedN++ }
    exercises.push(e)
  }
  const data = { log, exercises } as GymData
  for (const [k, x] of Object.entries(v)) if (!KNOWN_GYM.has(k)) (data as unknown as Record<string, unknown>)[k] = x
  if (v.unit !== undefined) { if (v.unit === 'kg' || v.unit === 'lbs') data.unit = v.unit; else fixedN++ }
  let rDropped = 0
  if (v.routines !== undefined) {
    if (!Array.isArray(v.routines)) rDropped++
    else {
      const routines: Routine[] = []
      for (const x of v.routines) {
        const r = readRoutine(x)
        if (r && !routines.some(y => y.id === r.r.id)) { routines.push(r.r); fixedN += r.fixed } else rDropped++ // id repetido: gana la primera
      }
      if (routines.length) data.routines = routines
    }
  }
  return { data, dropped: rawL.length - log.length + rawE.length - exercises.length + rDropped, fixed: fixedN }
}

const KNOWN_FOOD = new Set(['log', 'foods', 'goals', 'meals', '__proto__'])
const inRange = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
const strLen = (v: unknown, lo: number, hi: number): v is string => typeof v === 'string' && v.trim().length >= lo && v.length <= hi
const validServing = (x: unknown) => isObj(x) && strLen(x.name, 1, 30) && typeof x.qty === 'number' && x.qty > 0 && x.qty <= 2000
const validPortionServing = (x: unknown) => isObj(x) && strLen(x.name, 1, 30) && inRange(x.n, 0.25, 50)

// Entradas no válidas → se descartan (`dropped`); la válida se guarda tal cual, con sus campos desconocidos.
const validFoodEntry = (e: unknown): e is FoodLogEntry => {
  if (!isObj(e)) return false
  if ('undoes' in e) return isStr(e.id) && isStr(e.undoes) && typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)
  if (!(isStr(e.id) && typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt) && strLen(e.name, 1, 60) && inRange(e.kcal, 0, 20000) && inRange(e.qty, 0, 2000))) return false
  if (e.qty === 0 && e.foodId !== undefined) return false
  for (const k of ['p', 'c', 'f'] as const) if (e[k] !== undefined && !inRange(e[k], 0, 2000)) return false
  if (e.foodId !== undefined && !isStr(e.foodId)) return false
  if ((e.foodId !== undefined || e.base !== undefined) && e.base !== 'g' && e.base !== 'ml') return false
  return e.serving === undefined || validPortionServing(e.serving)
}

// Alimento propio no válido → null; servings/aliases con elementos no válidos → se quitan (`fixed`); campos de tipo incorrecto → se quitan.
function readFoodItem(x: unknown): { f: Food; fixed: number } | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id.startsWith('food-') || x.id.length <= 5 || !strLen(x.name, 1, 40) || (x.base !== 'g' && x.base !== 'ml') ||
    !inRange(x.kcal, 0, 900) || !inRange(x.p, 0, 100) || !inRange(x.c, 0, 100) || !inRange(x.f, 0, 100)) return null
  const f = { ...x } as Record<string, unknown>
  let fixed = 0
  const clean = (k: 'servings' | 'aliases', ok: (v: unknown) => boolean, max: number) => {
    if (f[k] === undefined) return
    const arr = Array.isArray(f[k]) ? (f[k] as unknown[]) : null
    if (!arr) { delete f[k]; fixed++; return }
    const good = arr.filter(ok).slice(0, max)
    if (good.length !== arr.length) fixed++
    if (good.length) f[k] = good; else delete f[k]
  }
  clean('servings', validServing, 5)
  clean('aliases', v => strLen(v, 1, 40), 10)
  if (f.archived !== undefined && typeof f.archived !== 'boolean') { delete f.archived; fixed++ }
  if (f.source !== undefined && !(typeof f.source === 'string' && f.source.length <= 20)) { delete f.source; fixed++ }
  if (f.ref !== undefined && !(typeof f.ref === 'string' && f.ref.length <= 100)) { delete f.ref; fixed++ }
  return { f: f as unknown as Food, fixed }
}

const validGoal = (g: unknown): g is FoodGoal => isObj(g) && typeof g.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.from) && Number.isInteger(g.kcal) && inRange(g.kcal, 800, 10000) &&
  [g.p, g.c, g.f].every(v => Number.isInteger(v) && inRange(v, 0, 100)) && (g.p as number) + (g.c as number) + (g.f as number) === 100

function readMeal(x: unknown): { m: Meal; fixed: number } | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id.startsWith('meal-') || x.id.length <= 5 || !strLen(x.name, 1, 40) || !Array.isArray(x.items)) return null
  const items: Meal['items'] = []
  let fixed = 0
  for (const i of x.items) {
    if (isObj(i) && isStr(i.foodId) && typeof i.qty === 'number' && i.qty > 0 && i.qty <= 2000 && (i.serving === undefined || validPortionServing(i.serving)) && items.length < 20) items.push(i as Meal['items'][number])
    else fixed++
  }
  return items.length ? { m: { ...x, items } as Meal, fixed } : null
}

export function readFood(v: unknown): Parsed<FoodData> {
  if (!isObj(v)) return null
  if ((v.log !== undefined && !Array.isArray(v.log)) || (v.foods !== undefined && !Array.isArray(v.foods))) return null
  const rawL: unknown[] = v.log ?? [], rawF: unknown[] = v.foods ?? []
  const log = rawL.filter(validFoodEntry)
  let dropped = rawL.length - log.length, fixed = 0
  const foods: Food[] = []
  for (const x of rawF) {
    const r = readFoodItem(x)
    if (r && !foods.some(y => y.id === r.f.id)) { foods.push(r.f); fixed += r.fixed } else dropped++
  }
  const data = { log, foods } as FoodData
  for (const [k, x] of Object.entries(v)) if (!KNOWN_FOOD.has(k)) (data as unknown as Record<string, unknown>)[k] = x
  if (v.goals !== undefined) {
    if (!Array.isArray(v.goals)) dropped++
    else {
      const goals: FoodGoal[] = []
      for (const g of v.goals) {
        if (!validGoal(g)) { dropped++; continue }
        const at = goals.findIndex(y => y.from === g.from)
        if (at >= 0) { goals[at] = g; fixed++ } else goals.push(g) // from repetido: gana el último
      }
      if (goals.length) data.goals = goals
    }
  }
  if (v.meals !== undefined) {
    if (!Array.isArray(v.meals)) dropped++
    else {
      const meals: Meal[] = []
      for (const x of v.meals) {
        const r = readMeal(x)
        if (r && !meals.some(y => y.id === r.m.id)) { meals.push(r.m); fixed += r.fixed } else dropped++
      }
      if (meals.length) data.meals = meals
    }
  }
  return { data, dropped, fixed }
}

export const parseCustom = (raw: string | null): CustomData => readCustom(json(raw ?? 'null'))?.data ?? EMPTY_CUSTOM

type Store = Pick<Storage, 'getItem' | 'setItem'>
export type LoadProblem = { key: string; dropped: number | null; fixed: number; backupKey: string | null } // dropped null = ilegible (fixed 0); backupKey null = no se pudo copiar → clave bloqueada
export type Loaded = { events: ActivityEvent[]; custom: CustomData; gym: GymData; food: FoodData; problems: LoadProblem[] }

const locked = new Set<string>() // claves que no se pueden escribir en esta sesión
export const unlockStorage = () => locked.clear()
// Solo desde onStorage: otra pestaña guardó datos que esta no ha podido leer. Al arrancar no se usa (bloquearía para siempre).
export const lockStorage = (keys: readonly string[] = [KEY, CUSTOM_KEY, GYM_KEY, FOOD_KEY]) => keys.forEach(k => locked.add(k))

// ponytail: restaurar `.backup.<stamp>` es manual (DevTools); no se purgan; uno por incidente de datos dañados.
export function loadAll(store: Store = localStorage, now = new Date()): Loaded {
  const problems: LoadProblem[] = []
  function load<T>(key: string, read: (v: unknown) => Parsed<T>, ifMissing: T, ifUnreadable: T): T {
    let raw: string | null
    try { raw = store.getItem(key) } catch { return ifMissing }
    if (raw === null) return ifMissing
    const r = read(json(raw))
    if (r && r.dropped === 0 && r.fixed === 0) return r.data
    let backupKey: string | null = `${key}.backup.${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}`
    try { store.setItem(backupKey, raw) } catch { locked.add(key); backupKey = null }
    problems.push({ key, dropped: r ? r.dropped : null, fixed: r ? r.fixed : 0, backupKey })
    return r ? r.data : ifUnreadable
  }
  const events = load(KEY, readEvents, [], [])
  const custom = load(CUSTOM_KEY, readCustom, EMPTY_CUSTOM, EMPTY_CUSTOM)
  const gym = load(GYM_KEY, readGym, EMPTY_GYM, EMPTY_GYM)
  const food = load(FOOD_KEY, readFood, EMPTY_FOOD, EMPTY_FOOD)
  return { events, custom, gym, food, problems }
}

// true = escrito; false = setItem lanzó (cuota, modo privado…); null = clave bloqueada, no se intenta (lo avisa noticeFor)
export const saveEvents = (e: ActivityEvent[], store: Store = localStorage): boolean | null => {
  if (locked.has(KEY)) return null
  try { store.setItem(KEY, JSON.stringify(e)); return true } catch { return false }
}
export const saveCustom = (c: CustomData, store: Store = localStorage): boolean | null => {
  if (locked.has(CUSTOM_KEY)) return null
  try { store.setItem(CUSTOM_KEY, JSON.stringify(c)); return true } catch { return false }
}

export const saveGym = (g: GymData, store: Store = localStorage): boolean | null => {
  if (locked.has(GYM_KEY)) return null
  try { store.setItem(GYM_KEY, JSON.stringify(g)); return true } catch { return false }
}

// ponytail: ~200 B por entrada y ~10 al día → ~0,7 MB al año; con el resto de claves, el límite de localStorage (~5 MB) llega a los ~5 años. El fallo se avisa con SaveFailBanner.
export const saveFood = (d: FoodData, store: Store = localStorage): boolean | null => {
  if (locked.has(FOOD_KEY)) return null
  try { store.setItem(FOOD_KEY, JSON.stringify(d)); return true } catch { return false }
}

export type Backup = { app: 'rpg-life-tracker'; version: 1; exportedAt: string; events: ActivityEvent[]; custom: CustomData; gym?: GymData; food?: FoodData }

export const exportBackup = (events: ActivityEvent[], custom: CustomData, exportedAt: string, gym?: GymData, food?: FoodData): string =>
  JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt, events, custom, ...(gym && { gym }), ...(food && { food }) } satisfies Backup, null, 2)

export function parseBackup(raw: string): { events: ActivityEvent[]; custom: CustomData; gym: GymData | null; food: FoodData | null; dropped: number; fixed: number } | null {
  const v = json(raw)
  if (!isObj(v) || v.app !== 'rpg-life-tracker' || v.version !== 1) return null
  const e = readEvents(v.events), c = readCustom(v.custom)
  const g = v.gym === undefined ? undefined : readGym(v.gym) // sin campo = copia anterior al módulo Gym (null); ilegible = copia inválida
  if (g === null) return null
  const fo = v.food === undefined ? undefined : readFood(v.food) // sin campo = copia anterior al módulo Comida (null); ilegible = copia inválida
  if (fo === null) return null
  return e && c ? { events: e.data, custom: c.data, gym: g?.data ?? null, food: fo?.data ?? null, dropped: e.dropped + c.dropped + (g?.dropped ?? 0) + (fo?.dropped ?? 0), fixed: e.fixed + c.fixed + (g?.fixed ?? 0) + (fo?.fixed ?? 0) } : null
}

export type Meta = { lastExportAt: string } // ISO 8601 (Date.toISOString())
export type CopyStatus = { days: number | null; due: boolean } // days null = nunca exportado

export const META_KEY = 'life-rpg-meta-v1'
// null = localStorage.clear() en otra pestaña
export const isDataKey = (k: string | null) => k === null || k === KEY || k === CUSTOM_KEY || k === GYM_KEY || k === FOOD_KEY
// ponytail: recordatorio fijo a 14 días; hacerlo configurable si alguien lo pide o cuando haya copias automáticas.
export const EXPORT_REMIND_DAYS = 14

export function loadLastExport(store: Pick<Storage, 'getItem'> = localStorage): string | null {
  try {
    const raw = store.getItem(META_KEY)
    if (raw === null) return null
    const v = json(raw)
    return isObj(v) && typeof v.lastExportAt === 'string' && !Number.isNaN(Date.parse(v.lastExportAt)) ? v.lastExportAt : null
  } catch { return null }
}

export function saveLastExport(iso: string, store: Pick<Storage, 'setItem'> = localStorage): void {
  try { store.setItem(META_KEY, JSON.stringify({ lastExportAt: iso } satisfies Meta)) } catch { /* cuota */ }
}

export const exportAge = (lastExportAt: string | null, now: Date): number | null =>
  lastExportAt === null ? null : Math.max(0, Math.floor((now.getTime() - Date.parse(lastExportAt)) / 86_400_000))

export const backupDue = (lastExportAt: string | null, now: Date, hasData: boolean): CopyStatus => {
  const days = exportAge(lastExportAt, now)
  return { days, due: hasData && (days === null || days >= EXPORT_REMIND_DAYS) }
}

const EMPTY_RAW: Record<string, string> = { [KEY]: '[]', [CUSTOM_KEY]: JSON.stringify(EMPTY_CUSTOM), [GYM_KEY]: JSON.stringify(EMPTY_GYM), [FOOD_KEY]: JSON.stringify(EMPTY_FOOD) }
type WStore = Store & Partial<Pick<Storage, 'removeItem'>>

// Escribe todo o revierte lo escrito (removeItem si no existía). false si algo falla. No lanza.
function writeAll(store: WStore, writes: [string, string][]): boolean {
  const done: [string, string | null][] = [] // [clave, valor anterior]
  try {
    for (const [k, v] of writes) { const old = store.getItem(k); store.setItem(k, v); done.push([k, old]) }
    return true
  } catch {
    for (const [k, old] of done.reverse()) {
      try { if (old === null) store.removeItem?.(k); else store.setItem(k, old) } catch { /* mejor esfuerzo */ }
    }
    return false
  }
}

// ponytail: dos niveles (`.backup.last` y `.backup.prev`); tres operaciones destructivas seguidas pierden la más antigua; la app solo restaura `.backup.last`; `.backup.prev`, por DevTools.
// Atómico: escribe todo o revierte lo escrito y devuelve false.
export function backupCurrent(store: WStore = localStorage): boolean {
  const writes: [string, string][] = []
  try {
    for (const k of [KEY, CUSTOM_KEY, GYM_KEY, FOOD_KEY]) {
      const raw = store.getItem(k)
      if (raw === null) continue
      const last = store.getItem(`${k}.backup.last`)
      if (last !== null) writes.push([`${k}.backup.prev`, last])
      writes.push([`${k}.backup.last`, raw])
    }
  } catch { return false }
  return writeAll(store, writes)
}

// null en una rama = esa clave no tiene .backup.last
export type LastBackup = { events: ActivityEvent[] | null; custom: CustomData | null; gym: GymData | null; food: FoodData | null; dropped: number; fixed: number }

export function hasLastBackup(store: Pick<Storage, 'getItem'> = localStorage): boolean {
  try { return [KEY, CUSTOM_KEY, GYM_KEY, FOOD_KEY].some(k => store.getItem(`${k}.backup.last`) !== null) } catch { return false }
}

export function readLast(store: Pick<Storage, 'getItem'> = localStorage): LastBackup | 'none' | 'unreadable' {
  const out: LastBackup = { events: null, custom: null, gym: null, food: null, dropped: 0, fixed: 0 }
  try {
    const ev = store.getItem(`${KEY}.backup.last`), cu = store.getItem(`${CUSTOM_KEY}.backup.last`), gy = store.getItem(`${GYM_KEY}.backup.last`), fd = store.getItem(`${FOOD_KEY}.backup.last`)
    if (ev !== null) { const r = readEvents(json(ev)); if (!r) return 'unreadable'; out.events = r.data; out.dropped += r.dropped; out.fixed += r.fixed }
    if (cu !== null) { const r = readCustom(json(cu)); if (!r) return 'unreadable'; out.custom = r.data; out.dropped += r.dropped; out.fixed += r.fixed }
    if (gy !== null) { const r = readGym(json(gy)); if (!r) return 'unreadable'; out.gym = r.data; out.dropped += r.dropped; out.fixed += r.fixed }
    if (fd !== null) { const r = readFood(json(fd)); if (!r) return 'unreadable'; out.food = r.data; out.dropped += r.dropped; out.fixed += r.fixed }
  } catch { return 'unreadable' }
  return out.events === null && out.custom === null && out.gym === null && out.food === null ? 'none' : out
}

// Intercambia `.backup.last` con el estado actual. No usa backupCurrent: machacaría la copia.
// ponytail: cada clave se trata por separado; si solo una tiene copia, la otra no cambia (no pasa con el flujo normal, App guarda ambas).
export function restoreLast(r: LastBackup, store: WStore = localStorage): boolean {
  const writes: [string, string][] = [], keys: string[] = []
  try {
    for (const [k, v] of [[KEY, r.events], [CUSTOM_KEY, r.custom], [GYM_KEY, r.gym], [FOOD_KEY, r.food]] as const) {
      if (v === null) continue
      writes.push([`${k}.backup.last`, store.getItem(k) ?? EMPTY_RAW[k]], [k, JSON.stringify(v)])
      keys.push(k)
    }
  } catch { return false }
  const ok = writeAll(store, writes)
  if (ok) keys.forEach(k => locked.delete(k))
  return ok
}

// Ajustes de voz de este dispositivo: fuera de las copias, de la fusión y de «Borrar todo» (no son datos del juego).
export const VOICE_KEY = 'life-rpg-voice-v1'
export type VoiceLang = 'es-ES' | 'en-US'
// privacyAck: ISO de cuándo se aceptó el aviso de privacidad; lang: idioma del dictado (sin él, español)
export type VoicePrefs = { privacyAck?: string; lang?: VoiceLang }

export function loadVoicePrefs(store: Pick<Storage, 'getItem'> = localStorage): VoicePrefs {
  try {
    const raw = store.getItem(VOICE_KEY)
    if (raw === null) return {}
    const v = json(raw)
    if (!isObj(v)) return {}
    return { ...(typeof v.privacyAck === 'string' && { privacyAck: v.privacyAck }), ...((v.lang === 'es-ES' || v.lang === 'en-US') && { lang: v.lang }) }
  } catch { return {} }
}

export function saveVoicePrefs(p: VoicePrefs, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(VOICE_KEY, JSON.stringify(p)); return true } catch { return false }
}

// Avisos de privacidad de las integraciones de Comida (ISO de aceptación): fuera de copias, fusión, `backupCurrent`, «Recuperar» y «Borrar todo».
export const FOOD_PRIVACY_KEY = 'life-rpg-food-privacy-v1'
export type FoodPrivacy = { off?: string; label?: string }

export function loadFoodPrivacy(store: Pick<Storage, 'getItem'> = localStorage): FoodPrivacy {
  try {
    const raw = store.getItem(FOOD_PRIVACY_KEY)
    if (raw === null) return {}
    const v = json(raw)
    if (!isObj(v)) return {}
    return { ...(typeof v.off === 'string' && { off: v.off }), ...(typeof v.label === 'string' && { label: v.label }) }
  } catch { return {} }
}

export function saveFoodPrivacy(p: FoodPrivacy, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(FOOD_PRIVACY_KEY, JSON.stringify(p)); return true } catch { return false }
}

// Clave de Anthropic del usuario (texto sin JSON), solo de este dispositivo: fuera de copias, fusión, `backupCurrent` y «Borrar todo».
// Nunca se escribe en consola ni se muestra entera. `isDataKey` la ignora (se lee en el momento de usarla).
export const AI_KEY = 'life-rpg-ai-key-v1'
export function readAiKey(raw: string | null): string | null {
  if (raw === null) return null
  const k = raw.trim()
  return k.startsWith('sk-ant-') && k.length >= 20 && k.length <= 300 && !/\s/.test(k) ? k : null
}
export function loadAiKey(store: Pick<Storage, 'getItem'> = localStorage): string | null {
  try { return readAiKey(store.getItem(AI_KEY)) } catch { return null }
}
// ¿hay algo guardado aunque no sea una clave válida? (Ajustes ofrece «Borrar clave»)
export function hasAiKeyEntry(store: Pick<Storage, 'getItem'> = localStorage): boolean {
  try { return store.getItem(AI_KEY) !== null } catch { return false }
}
export function saveAiKey(key: string, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(AI_KEY, key.trim()); return true } catch { return false }
}
export function clearAiKey(store: Pick<Storage, 'removeItem'> = localStorage): boolean {
  try { store.removeItem(AI_KEY); return true } catch { return false }
}

// Memoria de frases de la captura (caché de este dispositivo, M-B): fuera de copias, fusión, backupCurrent y «Recuperar»; «Borrar todo» la vacía.
export const MEMO_KEY = 'life-rpg-capture-memo-v1'
export function loadMemo(store: Pick<Storage, 'getItem'> = localStorage): Memo {
  try {
    const raw = store.getItem(MEMO_KEY)
    return raw === null ? [] : readMemo(JSON.parse(raw))
  } catch { return [] }
}
// Si falla (cuota) devuelve false y no se avisa: es una caché.
export function saveMemo(m: Memo, store: Pick<Storage, 'setItem'> = localStorage): boolean {
  try { store.setItem(MEMO_KEY, JSON.stringify({ v: 1, entries: m })); return true } catch { return false }
}
export function clearMemo(store: Pick<Storage, 'removeItem'> = localStorage): boolean {
  try { store.removeItem(MEMO_KEY); return true } catch { return false }
}

// ponytail: persist() es una petición; el navegador puede ignorarla (Safari borra tras 7 días sin uso). La garantía real es exportar.
export function requestPersist(): void {
  navigator.storage?.persisted?.().then(p => p || navigator.storage.persist()).catch(() => {})
}
