import { beforeEach, describe, expect, test } from 'vitest'
import { EMPTY_CUSTOM, backupCurrent, backupDue, exportAge, exportBackup, loadAll, loadLastExport, parseBackup, parseCustom, readCustom, readEvents, saveEvents, saveLastExport, unlockStorage } from './storage'
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
    expect(loadAll(s, D)).toEqual({ events: [], custom: EMPTY_CUSTOM, problems: [] })
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

describe('exportBackup / parseBackup', () => {
  const custom = {
    trackers: [{ id: 'c1', name: 'X', branch: 'hero' as const, increment: 1, xpPerUnit: 2 }],
    proposals: [{ trackerId: 'c1', partyId: 'p1' }],
  }
  const exp = (o: object = {}) => JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: [], custom: EMPTY_CUSTOM, ...o })
  test('roundtrip', () => {
    const r = parseBackup(exportBackup(SEED_EVENTS, custom as never, '2026-10-08T00:00:00Z'))
    expect(r).toEqual({ events: SEED_EVENTS, custom, dropped: 0 })
  })
  test('rechaza ajenos', () => {
    expect(parseBackup(exp({ app: 'otro' }))).toBeNull()
    expect(parseBackup(exp({ version: 2 }))).toBeNull()
    expect(parseBackup('{roto')).toBeNull()
    expect(parseBackup(exp({ events: undefined }))).toBeNull()
  })
  test('evento inválido', () => { expect(parseBackup(exp({ events: [null] }))?.dropped).toBe(1) })
})

describe('meta de exportación', () => {
  const M = 'life-rpg-meta-v1'
  test('loadLastExport', () => {
    expect(loadLastExport(fakeStore())).toBeNull()
    for (const v of ['{roto', '{"lastExportAt":"x"}', '[]']) expect(loadLastExport(fakeStore({ [M]: v }))).toBeNull()
    expect(loadLastExport(fakeStore({ [M]: '{"lastExportAt":"2026-10-08T10:00:00.000Z"}' }))).toBe('2026-10-08T10:00:00.000Z')
    expect(loadLastExport({ getItem: () => { throw new Error('x') } })).toBeNull()
  })
  test('roundtrip y fallo de escritura', () => {
    const s = fakeStore()
    saveLastExport('2026-10-08T10:00:00.000Z', s)
    expect(loadLastExport(s)).toBe('2026-10-08T10:00:00.000Z')
    expect(() => saveLastExport('2026-10-08T10:00:00.000Z', fakeStore({}, true))).not.toThrow()
  })
  const t0 = '2026-10-01T10:00:00.000Z', at = (ms: number) => new Date(Date.parse(t0) + ms)
  const D = 86_400_000
  test('exportAge', () => {
    expect(exportAge(null, at(0))).toBeNull()
    expect(exportAge(t0, at(0))).toBe(0)
    expect(exportAge(t0, at(14 * D - 3_600_000))).toBe(13)
    expect(exportAge(t0, at(14 * D))).toBe(14)
    expect(exportAge(t0, at(-D))).toBe(0)
  })
  test('backupDue', () => {
    expect(backupDue(null, at(0), false)).toEqual({ days: null, due: false })
    expect(backupDue(null, at(0), true).due).toBe(true)
    expect(backupDue(t0, at(13 * D), true).due).toBe(false)
    expect(backupDue(t0, at(14 * D), true).due).toBe(true)
  })
})

describe('backupCurrent', () => {
  test('copia, omite ausentes y sobrescribe', () => {
    const s = fakeStore({ [EV]: 'a', [CU]: 'b' })
    backupCurrent(s)
    expect(s.m.get(`${EV}.backup.last`)).toBe('a')
    expect(s.m.get(`${CU}.backup.last`)).toBe('b')
    s.m.set(EV, 'c'); backupCurrent(s)
    expect(s.m.get(`${EV}.backup.last`)).toBe('c')
    const s2 = fakeStore({ [EV]: 'a' }); backupCurrent(s2)
    expect(s2.m.has(`${CU}.backup.last`)).toBe(false)
  })
  test('escrituras fallidas: false y no lanza', () => {
    expect(backupCurrent(fakeStore({ [EV]: 'a' }, true))).toBe(false)
  })
  test('atómico: si falla la segunda escritura, revierte la primera', () => {
    const s = fakeStore({ [EV]: 'a2', [CU]: 'b2', [`${EV}.backup.last`]: 'a1' })
    let n = 0
    const store = { getItem: s.getItem, removeItem: (k: string) => { s.m.delete(k) },
      setItem: (k: string, v: string) => { if (++n === 3) throw new Error('quota'); s.setItem(k, v) } }
    expect(backupCurrent(store)).toBe(false)
    expect(s.m.get(`${EV}.backup.last`)).toBe('a1')
    expect(s.m.has(`${EV}.backup.prev`)).toBe(false)
    expect(s.m.has(`${CU}.backup.last`)).toBe(false)
  })
  test('rota last a prev', () => {
    const s = fakeStore({ [EV]: 'a2', [`${EV}.backup.last`]: 'a1' })
    expect(backupCurrent(s)).toBe(true)
    expect(s.m.get(`${EV}.backup.prev`)).toBe('a1')
    expect(s.m.get(`${EV}.backup.last`)).toBe('a2')
  })
})
