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

export function parseCustom(raw: string | null): CustomData {
  try {
    const v: unknown = JSON.parse(raw ?? 'null')
    if (!isObj(v)) return EMPTY_CUSTOM
    const trackers = Array.isArray(v.trackers) ? v.trackers.filter((t): t is Tracker => isObj(t) &&
      typeof t.id === 'string' && typeof t.name === 'string' && (t.branch === 'hero' || t.branch === 'villain') &&
      Number.isFinite(t.increment) && Number.isFinite(t.xpPerUnit)) : []
    const proposals = Array.isArray(v.proposals) ? v.proposals.filter((p): p is Proposal => isObj(p) &&
      typeof p.trackerId === 'string' && typeof p.partyId === 'string') : []
    return { trackers, proposals }
  } catch { return EMPTY_CUSTOM }
}

export const loadCustom = (): CustomData => { try { return parseCustom(localStorage.getItem(CUSTOM_KEY)) } catch { return EMPTY_CUSTOM } }
export const saveCustom = (c: CustomData) => { try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(c)) } catch { /* cuota */ } }
