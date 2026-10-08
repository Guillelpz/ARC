import type { ActivityEvent, CustomData, Proposal, Tracker } from './types'
import { SEED_EVENTS } from './seed'

const KEY = 'life-rpg-demo-v1'

export function loadEvents(): ActivityEvent[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? 'null'); if (Array.isArray(v)) return v } catch { /* corrupto: seed */ }
  return SEED_EVENTS
}

export const saveEvents = (e: ActivityEvent[]) => { try { localStorage.setItem(KEY, JSON.stringify(e)) } catch { /* cuota / modo privado */ } }

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

export const loadCustom = (): CustomData => { try { return parseCustom(localStorage.getItem(CUSTOM_KEY)) } catch { return EMPTY_CUSTOM } }
export const saveCustom = (c: CustomData) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)) } catch { /* cuota */ } }
