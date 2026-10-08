import type { ActivityEvent, CustomData, Proposal, Tracker } from './types'

const KEY = 'life-rpg-demo-v1'
const CUSTOM_KEY = 'life-rpg-custom-v1'
export const EMPTY_CUSTOM: CustomData = { trackers: [], proposals: [] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const json = (raw: string): unknown => { try { return JSON.parse(raw) } catch { return undefined } }
const STAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const isEvent = (e: unknown): e is ActivityEvent => isObj(e) && typeof e.id === 'string' && e.id !== '' &&
  typeof e.trackerId === 'string' && typeof e.amount === 'number' && Number.isFinite(e.amount) &&
  typeof e.occurredAt === 'string' && STAMP.test(e.occurredAt)

export type Parsed<T> = { data: T; dropped: number } | null // null = ilegible

export function readEvents(v: unknown): Parsed<ActivityEvent[]> {
  if (!Array.isArray(v)) return null
  const data = v.filter(isEvent)
  return { data, dropped: v.length - data.length }
}

export function readCustom(v: unknown): Parsed<CustomData> {
  if (!isObj(v)) return null
  if ((v.trackers !== undefined && !Array.isArray(v.trackers)) || (v.proposals !== undefined && !Array.isArray(v.proposals))) return null
  const rawT: unknown[] = v.trackers ?? []
  const rawP: unknown[] = v.proposals ?? []
  const trackers = rawT.filter((t): t is Tracker => isObj(t) &&
    typeof t.id === 'string' && typeof t.name === 'string' && (t.branch === 'hero' || t.branch === 'villain') &&
    Number.isFinite(t.increment) && Number.isFinite(t.xpPerUnit))
  const proposals = rawP.filter((p): p is Proposal => isObj(p) &&
    typeof p.trackerId === 'string' && typeof p.partyId === 'string')
  return { data: { trackers, proposals }, dropped: rawT.length - trackers.length + rawP.length - proposals.length }
}

export const parseCustom = (raw: string | null): CustomData => readCustom(json(raw ?? 'null'))?.data ?? EMPTY_CUSTOM

type Store = Pick<Storage, 'getItem' | 'setItem'>
export type LoadProblem = { key: string; dropped: number | null; backupKey: string | null } // dropped null = ilegible; backupKey null = no se pudo copiar → clave bloqueada
export type Loaded = { events: ActivityEvent[]; custom: CustomData; problems: LoadProblem[] }

const locked = new Set<string>() // claves que no se pueden escribir en esta sesión
export const unlockStorage = () => locked.clear()

// ponytail: restaurar un backup interno es manual (DevTools → Local Storage). Añadir UI cuando un usuario real lo necesite.
export function loadAll(store: Store = localStorage, now = new Date()): Loaded {
  const problems: LoadProblem[] = []
  function load<T>(key: string, read: (v: unknown) => Parsed<T>, ifMissing: T, ifUnreadable: T): T {
    let raw: string | null
    try { raw = store.getItem(key) } catch { return ifMissing }
    if (raw === null) return ifMissing
    const r = read(json(raw))
    if (r && r.dropped === 0) return r.data
    let backupKey: string | null = `${key}.backup.${now.toISOString().replace(/[-:]/g, '').slice(0, 15)}`
    try { store.setItem(backupKey, raw) } catch { locked.add(key); backupKey = null }
    problems.push({ key, dropped: r ? r.dropped : null, backupKey })
    return r ? r.data : ifUnreadable
  }
  const events = load(KEY, readEvents, [], [])
  const custom = load(CUSTOM_KEY, readCustom, EMPTY_CUSTOM, EMPTY_CUSTOM)
  return { events, custom, problems }
}

export const saveEvents = (e: ActivityEvent[], store: Store = localStorage) => {
  if (locked.has(KEY)) return
  try { store.setItem(KEY, JSON.stringify(e)) } catch { /* cuota / modo privado */ }
}
export const saveCustom = (c: CustomData, store: Store = localStorage) => {
  if (locked.has(CUSTOM_KEY)) return
  try { store.setItem(CUSTOM_KEY, JSON.stringify(c)) } catch { /* cuota */ }
}

export type Backup = { app: 'rpg-life-tracker'; version: 1; exportedAt: string; events: ActivityEvent[]; custom: CustomData }

export const exportBackup = (events: ActivityEvent[], custom: CustomData, exportedAt: string): string =>
  JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt, events, custom } satisfies Backup, null, 2)

export function parseBackup(raw: string): { events: ActivityEvent[]; custom: CustomData; dropped: number } | null {
  const v = json(raw)
  if (!isObj(v) || v.app !== 'rpg-life-tracker' || v.version !== 1) return null
  const e = readEvents(v.events), c = readCustom(v.custom)
  return e && c ? { events: e.data, custom: c.data, dropped: e.dropped + c.dropped } : null
}

export type Meta = { lastExportAt: string } // ISO 8601 (Date.toISOString())
export type CopyStatus = { days: number | null; due: boolean } // days null = nunca exportado

const META_KEY = 'life-rpg-meta-v1'
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

// ponytail: una sola copia interna por clave (`.backup.last`), sobrescrita en cada import/borrado y restaurable a mano; si falla la escritura, se sigue.
export function backupCurrent(store: Store = localStorage): void {
  for (const k of [KEY, CUSTOM_KEY]) {
    try {
      const raw = store.getItem(k)
      if (raw !== null) store.setItem(`${k}.backup.last`, raw)
    } catch { /* se sigue */ }
  }
}

// ponytail: persist() es una petición; el navegador puede ignorarla (Safari borra tras 7 días sin uso). La garantía real es exportar.
export function requestPersist(): void {
  navigator.storage?.persisted?.().then(p => p || navigator.storage.persist()).catch(() => {})
}
