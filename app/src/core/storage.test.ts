import { beforeEach, describe, expect, test } from 'vitest'
import { EMPTY_CUSTOM, loadAll, parseCustom, readCustom, readEvents, saveEvents, unlockStorage } from './storage'
import { SEED_EVENTS } from './seed'

describe('readEvents', () => {
  test('roundtrip de la semilla', () => {
    expect(readEvents(JSON.parse(JSON.stringify(SEED_EVENTS)))).toEqual({ data: SEED_EVENTS, dropped: 0 })
  })
  test('descarta inválidos', () => {
    const ok = { id: 'a', trackerId: 't', amount: 1, occurredAt: '2026-10-07T10:00:00' }
    const r = readEvents([ok, null, { ...ok, id: undefined }, { ...ok, amount: '3' }, { ...ok, amount: null }, { ...ok, occurredAt: '2026-10-07' }])
    expect(r).toEqual({ data: [ok], dropped: 5 })
  })
  test('trackerId desconocido se conserva', () => {
    expect(readEvents([{ id: 'a', trackerId: 'borrado', amount: 1, occurredAt: '2026-10-07T10:00:00' }])?.dropped).toBe(0)
  })
  test('ilegible', () => {
    for (const v of [{}, 'x', undefined]) expect(readEvents(v)).toBeNull()
  })
})

describe('readCustom', () => {
  test('vacío', () => { expect(readCustom({})).toEqual({ data: EMPTY_CUSTOM, dropped: 0 }) })
  test('trackers no array', () => { expect(readCustom({ trackers: 'x' })).toBeNull() })
  test('tracker sin name', () => {
    expect(readCustom({ trackers: [{ id: 'a', branch: 'hero', increment: 1, xpPerUnit: 1 }] })?.dropped).toBe(1)
  })
  test('parseCustom ilegible', () => {
    expect(parseCustom('{roto')).toEqual(EMPTY_CUSTOM)
    expect(parseCustom(null)).toEqual(EMPTY_CUSTOM)
  })
})

const fakeStore = (init: Record<string, string> = {}, failWrites = false) => {
  const m = new Map(Object.entries(init))
  let writes = 0
  return { m, writes: () => writes, getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { if (failWrites) throw new Error('quota'); writes++; m.set(k, v) } }
}
const EV = 'life-rpg-demo-v1', CU = 'life-rpg-custom-v1'
const D = new Date('2026-10-08T12:34:56Z')
const BK = (k: string) => `${k}.backup.20261008T123456`
const good = { id: 'a', trackerId: 't', amount: 1, occurredAt: '2026-10-07T10:00:00' }

describe('loadAll', () => {
  beforeEach(unlockStorage)
  test('store vacío', () => {
    const s = fakeStore()
    expect(loadAll(s, D)).toEqual({ events: SEED_EVENTS, custom: EMPTY_CUSTOM, problems: [] })
    expect(s.writes()).toBe(0)
  })
  test('datos válidos', () => {
    const s = fakeStore({ [EV]: JSON.stringify([good]), [CU]: JSON.stringify(EMPTY_CUSTOM) })
    const r = loadAll(s, D)
    expect(r.events).toEqual([good]); expect(r.problems).toEqual([]); expect(s.writes()).toBe(0)
  })
  test('eventos ilegibles', () => {
    const s = fakeStore({ [EV]: '{roto' })
    const r = loadAll(s, D)
    expect(r.events).toEqual([])
    expect(r.problems[0].dropped).toBeNull()
    expect(s.m.get(BK(EV))).toBe('{roto')
  })
  test('eventos con inválidos', () => {
    const raw = JSON.stringify([good, null])
    const s = fakeStore({ [EV]: raw })
    const r = loadAll(s, D)
    expect(r.events).toEqual([good]); expect(r.problems[0].dropped).toBe(1)
    expect(s.m.get(BK(EV))).toBe(raw)
  })
  test('custom ilegible', () => {
    const s = fakeStore({ [CU]: '{roto' })
    expect(loadAll(s, D).custom).toEqual(EMPTY_CUSTOM)
    expect(s.m.get(BK(CU))).toBe('{roto')
  })
  test('sin poder copiar: bloquea', () => {
    const s = fakeStore({ [EV]: '{roto' }, true)
    expect(loadAll(s, D).problems[0].backupKey).toBeNull()
    saveEvents([good], s)
    expect(s.m.get(EV)).toBe('{roto')
  })
})
