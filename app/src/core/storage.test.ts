import { beforeEach, describe, expect, test } from 'vitest'
import { storageUsage, usageWarn, FOOD_PRIVACY_KEY, loadFoodPrivacy, saveFoodPrivacy, MEMO_KEY, loadMemo, saveMemo, clearMemo, AI_KEY, VOICE_KEY, loadAiKey, loadVoicePrefs, readAiKey, saveAiKey, clearAiKey, saveVoicePrefs, EMPTY_CUSTOM, EMPTY_GYM, EMPTY_FOOD, FOOD_KEY, GYM_KEY, readFood, saveFood, isDataKey, readGym, saveGym, backupCurrent, backupDue, exportAge, exportBackup, hasLastBackup, loadAll, loadLastExport, parseBackup, parseCustom, readCustom, readEvents, readLast, restoreLast, saveCustom, saveEvents, saveLastExport, unlockStorage } from './storage'
import { SEED_EVENTS } from './seed'

describe('readEvents', () => {
  test('roundtrip de la semilla', () => {
    expect(readEvents(JSON.parse(JSON.stringify(SEED_EVENTS)))).toEqual({ data: SEED_EVENTS, dropped: 0, fixed: 0 })
  })
  test('descarta inválidos', () => {
    const ok = { id: 'a', trackerId: 't', amount: 1, occurredAt: '2026-10-07T10:00:00' }
    const r = readEvents([ok, null, { ...ok, id: undefined }, { ...ok, amount: '3' }, { ...ok, amount: null }, { ...ok, occurredAt: '2026-10-07' }])
    expect(r).toEqual({ data: [ok], dropped: 5, fixed: 0 })
  })
  test('trackerId desconocido se conserva', () => {
    expect(readEvents([{ id: 'a', trackerId: 'borrado', amount: 1, occurredAt: '2026-10-07T10:00:00' }])?.dropped).toBe(0)
  })
  test('ilegible', () => {
    for (const v of [{}, 'x', undefined]) expect(readEvents(v)).toBeNull()
  })
})

describe('undoes', () => {
  const g = { id: 'a', trackerId: 't', amount: -1, occurredAt: '2026-10-07T10:00:00' }
  test('S1: válido se conserva', () => {
    expect(readEvents([{ ...g, undoes: 'a' }])).toEqual({ data: [{ ...g, undoes: 'a' }], dropped: 0, fixed: 0 })
  })
  test('S2: inválido se repara', () => {
    expect(readEvents([{ ...g, undoes: 3 }, { ...g, id: 'b', undoes: '' }])).toEqual({ data: [g, { ...g, id: 'b' }], dropped: 0, fixed: 2 })
  })
  test('S3: sobrevive a export/import', () => {
    const e = { ...g, undoes: 'x' }
    expect(parseBackup(exportBackup([e], EMPTY_CUSTOM, 'x'))?.events).toEqual([e])
  })
})

describe('readCustom', () => {
  test('vacío', () => { expect(readCustom({})).toEqual({ data: EMPTY_CUSTOM, dropped: 0, fixed: 0 }) })
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
    expect(loadAll(s, D)).toEqual({ events: [], custom: EMPTY_CUSTOM, gym: EMPTY_GYM, food: EMPTY_FOOD, problems: [] })
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
  test('solo reparados', () => {
    const raw = JSON.stringify([{ ...good, undoes: 3 }])
    const s = fakeStore({ [EV]: raw })
    const r = loadAll(s, D)
    expect(r.events).toEqual([good])
    expect(r.problems[0]).toMatchObject({ dropped: 0, fixed: 1 })
    expect(s.m.get(BK(EV))).toBe(raw)
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
    expect(saveEvents([good], s)).toBeNull() // W2
    expect(s.m.get(EV)).toBe('{roto')
  })
  test('W1 resultado de guardar', () => {
    expect(saveEvents([good], fakeStore())).toBe(true)
    expect(saveCustom(EMPTY_CUSTOM, fakeStore())).toBe(true)
    expect(saveEvents([good], fakeStore({}, true))).toBe(false)
    expect(saveCustom(EMPTY_CUSTOM, fakeStore({}, true))).toBe(false)
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
    expect(r).toEqual({ events: SEED_EVENTS, custom, gym: null, food: null, dropped: 0, fixed: 0 })
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

describe('restaurar copia', () => {
  const L = (k: string) => `${k}.backup.last`
  beforeEach(unlockStorage)
  test('R1 readLast', () => {
    expect(readLast(fakeStore())).toBe('none')
    expect(readLast(fakeStore({ [L(EV)]: JSON.stringify([good]) }))).toEqual({ events: [good], custom: null, gym: null, food: null, dropped: 0, fixed: 0 })
    expect(readLast(fakeStore({ [L(EV)]: '{roto' }))).toBe('unreadable')
    expect(readLast(fakeStore({ [L(EV)]: JSON.stringify([good, null]) }))).toMatchObject({ dropped: 1 })
  })
  test('R2 intercambio', () => {
    const s = fakeStore({ [EV]: 'cur', [L(EV)]: JSON.stringify([good]), [`${EV}.backup.prev`]: 'p', [CU]: 'c' })
    expect(restoreLast(readLast(s) as never, s)).toBe(true)
    expect(s.m.get(EV)).toBe(JSON.stringify([good]))
    expect(s.m.get(L(EV))).toBe('cur')
    expect(s.m.get(`${EV}.backup.prev`)).toBe('p')
    expect(s.m.get(CU)).toBe('c'); expect(s.m.has(L(CU))).toBe(false)
  })
  test('R3 doble restauración', () => {
    const init = { [EV]: JSON.stringify([good]), [L(EV)]: '[]', [CU]: JSON.stringify(EMPTY_CUSTOM), [L(CU)]: JSON.stringify({ trackers: [], proposals: [] }) }
    const s = fakeStore(init)
    for (let i = 0; i < 2; i++) expect(restoreLast(readLast(s) as never, s)).toBe(true)
    expect(Object.fromEntries(s.m)).toEqual(init)
  })
  test('R4 atómico', () => {
    const init = { [EV]: 'a', [L(EV)]: JSON.stringify([good]), [CU]: 'b', [L(CU)]: JSON.stringify(EMPTY_CUSTOM) }
    const s = fakeStore(init)
    let n = 0
    const store = { getItem: s.getItem, removeItem: (k: string) => { s.m.delete(k) },
      setItem: (k: string, v: string) => { if (++n === 3) throw new Error('quota'); s.setItem(k, v) } }
    expect(restoreLast(readLast(s) as never, store)).toBe(false)
    expect(Object.fromEntries(s.m)).toEqual(init)
  })
  test('R5 actual ausente', () => {
    const s = fakeStore({ [L(EV)]: JSON.stringify([good]) })
    expect(restoreLast(readLast(s) as never, s)).toBe(true)
    expect(s.m.get(L(EV))).toBe('[]')
  })
  test('R6 desbloqueo', () => {
    const m = new Map([[EV, '{roto']]); let fail = true
    const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { if (fail) throw new Error('quota'); m.set(k, v) } }
    loadAll(s, D)
    m.set(L(EV), JSON.stringify([good])); fail = false
    expect(restoreLast(readLast(s) as never, s)).toBe(true)
    saveEvents([{ ...good, id: 'z' }], s)
    expect(m.get(EV)).toBe(JSON.stringify([{ ...good, id: 'z' }]))
  })
  test('R7 hasLastBackup', () => {
    expect(hasLastBackup(fakeStore())).toBe(false)
    expect(hasLastBackup(fakeStore({ [L(EV)]: 'x' }))).toBe(true)
    expect(hasLastBackup(fakeStore({ [L(CU)]: 'x' }))).toBe(true)
  })
})

describe('readCustom: campos de P4.3', () => {
  const base = { id: 'c', name: 'X', branch: 'hero', type: 'count', unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 20, custom: true }
  test('C1 formato antiguo', () => { expect(readCustom({ trackers: [base] })).toEqual({ data: { trackers: [base], proposals: [] }, dropped: 0, fixed: 0 }) })
  test('C2 weeklyGoal inválido', () => {
    const r = readCustom({ trackers: ['x', null, 0, -1].map(w => ({ ...base, weeklyGoal: w })) })
    expect(r?.data.trackers).toEqual([base, base, base, base]); expect(r?.dropped).toBe(0); expect(r?.fixed).toBe(4)
  })
  test('C3 villain con objetivo y archived no booleano', () => {
    const r = readCustom({ trackers: [{ ...base, branch: 'villain', weeklyGoal: 3 }, { ...base, archived: 'yes' }] })
    expect(r?.data.trackers).toEqual([{ ...base, branch: 'villain' }, base]); expect(r?.dropped).toBe(0); expect(r?.fixed).toBe(2)
  })
  test('C4 campos válidos', () => {
    const ts = [{ ...base, weeklyGoal: 5, archived: true }, { ...base, archived: false }]
    expect(readCustom({ trackers: ts })).toEqual({ data: { trackers: ts, proposals: [] }, dropped: 0, fixed: 0 })
  })
  test('C5 export/import', () => {
    const t = { ...base, weeklyGoal: 5, archived: true }
    expect(parseBackup(exportBackup([], { trackers: [t] as never, proposals: [] }, 'x'))?.custom.trackers).toEqual([t])
  })
})

describe('readCustom: goals', () => {
  test('C6 sin goals', () => {
    const r = readCustom({ trackers: [], proposals: [] })
    expect(r).toEqual({ data: { trackers: [], proposals: [] }, dropped: 0, fixed: 0 })
    expect(r!.data).not.toHaveProperty('goals')
  })
  test('C7 válidos', () => {
    expect(readCustom({ goals: { gym: 2, reading: 60 } })).toEqual({ data: { trackers: [], proposals: [], goals: { gym: 2, reading: 60 } }, dropped: 0, fixed: 0 })
  })
  test('C8 inválidos', () => {
    const t = { id: 'c', name: 'C', branch: 'hero', increment: 1, xpPerUnit: 1 }
    const a = readCustom({ trackers: [t], goals: 'x' })
    expect(a!.data.goals).toBeUndefined()
    expect(a!.dropped).toBe(1)
    expect(a!.data.trackers).toHaveLength(1)
    const b = readCustom({ goals: { beer: 3, 'custom-x': 3, nope: 3, gym: 0, bjj: 2.5, running: '5', reading: 90 } })
    expect(b!.data.goals).toEqual({ reading: 90 })
    expect(b!.dropped).toBe(6)
  })
  test('C9 export/import', () => {
    expect(parseBackup(exportBackup([], { trackers: [], proposals: [], goals: { gym: 2 } }, 'x'))?.custom.goals).toEqual({ gym: 2 })
  })
})

describe('readCustom: goalLog', () => {
  const e = { trackerId: 'gym', goal: 4, until: '2026-10-05' }
  test('C10 válidos', () => {
    const log = [e, { trackerId: 'custom-x', goal: null, until: '2026-09-28' }]
    const r = readCustom({ goalLog: log })
    expect(r?.data.goalLog).toEqual(log); expect(r?.dropped).toBe(0); expect(r?.fixed).toBe(0)
    expect(readCustom({})!.data).not.toHaveProperty('goalLog')
  })
  test('C11 inválidos', () => {
    const a = readCustom({ goalLog: 'x' })
    expect(a!.data).not.toHaveProperty('goalLog'); expect(a!.dropped).toBe(1)
    const b = readCustom({ goalLog: [null, { ...e, trackerId: '' }, { ...e, goal: 0 }, { ...e, goal: '3' }, { ...e, until: '2026-10-06' }, { ...e, until: '5/10' }, e] })
    expect(b!.data.goalLog).toEqual([e]); expect(b!.dropped).toBe(6)
  })
  test('C12 round-trip', () => {
    expect(parseBackup(exportBackup([], { trackers: [], proposals: [], goalLog: [e] }, 'x'))?.custom.goalLog).toEqual([e])
    const s = fakeStore({ [CU]: JSON.stringify({ trackers: [], proposals: [], goalLog: [e] }) })
    backupCurrent(s)
    const r = readLast(s)
    expect(r !== 'none' && r !== 'unreadable' && r.custom?.goalLog).toEqual([e])
  })
})

describe('readCustom: claves desconocidas', () => {
  test('C13 se conservan', () => {
    const raw = { trackers: [], proposals: [], futuro: { a: 1 }, n: 3 }
    const r = readCustom(raw)
    expect(r!.data).toEqual(raw); expect(r!.dropped).toBe(0); expect(r!.fixed).toBe(0)
    const g = readCustom({ goals: 'x', otro: 1 })!.data
    expect(g).not.toHaveProperty('goals'); expect(g).toHaveProperty('otro', 1)
  })
  test('C14 viaje completo', () => {
    const s = fakeStore({ [CU]: JSON.stringify({ trackers: [], proposals: [], futuro: [1] }) })
    const { custom, problems } = loadAll(s)
    expect(problems).toEqual([]); expect(s.writes()).toBe(0)
    saveCustom({ ...custom }, s)
    expect(JSON.parse(s.m.get(CU)!).futuro).toEqual([1])
    expect(parseBackup(exportBackup([], custom, 'x'))?.custom).toHaveProperty('futuro')
  })
  test('C15 __proto__', () => {
    const r = readCustom(JSON.parse('{"__proto__":{"x":1}}'))!.data
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype)
    expect((r as any).x).toBeUndefined() // eslint-disable-line
    expect(r).toEqual(EMPTY_CUSTOM)
  })
})

describe('readCustom: límite VILLAIN', () => {
  test('C18 limits válidos', () => {
    const r = readCustom({ limits: { beer: 2, burgers: 5 } })
    expect(r?.data.limits).toEqual({ beer: 2, burgers: 5 }); expect(r?.dropped).toBe(0)
    expect(readCustom({})!.data).not.toHaveProperty('limits')
  })
  test('C19 inválidos', () => {
    expect(readCustom({ limits: 'x' })?.dropped).toBe(1)
    const a = readCustom({ limits: { beer: 0, burgers: 2.5, gym: 3, 'custom-x': 2, nope: 1 } })
    expect(a!.data).not.toHaveProperty('limits'); expect(a!.dropped).toBe(5)
    const t = { id: 'x', name: 'X', increment: 1, xpPerUnit: 1 }
    const r = readCustom({ trackers: [
      { ...t, id: 'a', branch: 'villain', weeklyLimit: 3 }, { ...t, id: 'b', branch: 'hero', weeklyLimit: 3 },
      { ...t, id: 'c', branch: 'villain', weeklyLimit: -1 }, { ...t, id: 'd', branch: 'villain', weeklyLimit: 'x' },
    ] })!
    expect(r.data.trackers.map(x => x.weeklyLimit)).toEqual([3, undefined, undefined, undefined])
    expect(r.data.trackers.slice(1).every(x => !('weeklyLimit' in x))).toBe(true); expect(r.fixed).toBe(3)
  })
  test('C20 round-trip', () => {
    const custom = { trackers: [{ id: 'c1', name: 'P', branch: 'villain' as const, type: 'count' as const, unit: 'unidades', increment: 1, buttonLabel: '+1', xpPerUnit: 2, weeklyLimit: 3 }], proposals: [], limits: { beer: 2 } }
    expect(parseBackup(exportBackup([], custom, 'x'))?.custom).toEqual(custom)
    const s = fakeStore({ [CU]: JSON.stringify(custom) })
    backupCurrent(s)
    const r = readLast(s)
    expect(r !== 'none' && r !== 'unreadable' && r.custom).toEqual(custom)
  })
})

describe('módulo Gym', () => {
  const GY = GYM_KEY
  const set = { id: 's1', exerciseId: 'bench-press', weight: 100, unit: 'kg', reps: 5, occurredAt: '2026-10-07T10:00:00' }
  const undo = { id: 'u1', undoes: 's1', occurredAt: '2026-10-07T10:00:00' }
  const ex = { id: 'custom-1', name: 'Remo Pendlay', group: 'back', kind: 'load' }
  beforeEach(unlockStorage)
  test('GS1 readGym: roundtrip, inválidos, archived y claves desconocidas', () => {
    const data = { log: [set, undo, { ...set, id: 's2', extra: 1 }], exercises: [{ ...ex, archived: true }], unit: 'lbs', futuro: { a: 1 } }
    expect(readGym(JSON.parse(JSON.stringify(data)))).toEqual({ data, dropped: 0, fixed: 0 })
    const bad = [{ ...set, id: 'a', weight: -1 }, { ...set, id: 'b', reps: 1.5 }, { ...set, id: 'c', unit: 'st' }, { id: 'd', exerciseId: 'x', weight: 1, unit: 'kg', reps: 1 }]
    const r = readGym({ log: [set, ...bad], exercises: [{ ...ex, archived: 'si' }, { ...ex, id: 'otro' }], unit: 'st' })!
    expect(r.data.log).toEqual([set]); expect(r.dropped).toBe(5)
    expect(r.fixed).toBe(2); expect(r.data.exercises).toEqual([ex]); expect(r.data).not.toHaveProperty('unit')
    expect(readGym({ log: 'x' })).toBeNull(); expect(readGym([])).toBeNull()
    expect(readGym({ log: [{ ...set, exerciseId: 'desconocido' }] })?.dropped).toBe(0)
  })
  test('GS6 readGym con rutinas: roundtrip, reparación y descarte', () => {
    const rt = { id: 'routine-a', name: 'Push', items: [{ exerciseId: 'bench-press', sets: 3 }, { exerciseId: 'desconocido', sets: 10 }] }
    expect(readGym(JSON.parse(JSON.stringify({ log: [], exercises: [], routines: [rt] })))).toEqual({ data: { log: [], exercises: [], routines: [rt] }, dropped: 0, fixed: 0 })
    expect(readGym({ log: [] })!.data).not.toHaveProperty('routines')
    const items = [{ exerciseId: 'a', sets: 0 }, { exerciseId: '', sets: 2 }, { exerciseId: 'b', sets: 1.5 }, { exerciseId: 'c', sets: 11 }, { exerciseId: 'd', sets: 2 }, { exerciseId: 'd', sets: 3 }, 'x']
    const r = readGym({ routines: [{ ...rt, items }, { ...rt, id: 'routine-b', items: [{ exerciseId: 'a', sets: 0 }] }, { ...rt, id: 'x-1' }, { ...rt, id: 'routine-c', name: '  ' },
      { ...rt, id: 'routine-d', items: 'no' }, null, { ...rt, id: 'routine-e', name: 'a'.repeat(41) }] })!
    expect(r.data.routines).toEqual([{ id: 'routine-a', name: 'Push', items: [{ exerciseId: 'd', sets: 2 }] }])
    expect(r.fixed).toBe(6); expect(r.dropped).toBe(6)
    const many = Array.from({ length: 25 }, (_, i) => ({ exerciseId: `e${i}`, sets: 1 }))
    const m = readGym({ routines: [{ ...rt, items: many }] })!
    expect(m.data.routines![0].items).toHaveLength(20); expect(m.fixed).toBe(5)
    const lots = readGym({ routines: Array.from({ length: 22 }, (_, i) => ({ ...rt, id: `routine-${i}` })) })!
    expect(lots.data.routines).toHaveLength(22); expect(lots.dropped).toBe(0)
    const bad = readGym({ routines: 5 })!
    expect(bad.dropped).toBe(1); expect(bad.data).not.toHaveProperty('routines')
  })
  test('GS2 loadAll con gym corrupto: backup y lo demás intacto', () => {
    const s = fakeStore({ [EV]: JSON.stringify([good]), [CU]: JSON.stringify(EMPTY_CUSTOM), [GY]: '{roto' })
    const r = loadAll(s, D)
    expect(r.gym).toEqual(EMPTY_GYM); expect(r.events).toEqual([good]); expect(r.custom).toEqual(EMPTY_CUSTOM)
    expect(r.problems).toEqual([{ key: GY, dropped: null, fixed: 0, backupKey: BK(GY) }])
    expect(s.m.get(BK(GY))).toBe('{roto')
  })
  test('GS3 si falla el backup, saveGym devuelve null', () => {
    const s = fakeStore({ [GY]: '{roto' }, true)
    expect(loadAll(s, D).problems[0].backupKey).toBeNull()
    expect(saveGym(EMPTY_GYM, s)).toBeNull()
    unlockStorage(); expect(saveGym(EMPTY_GYM, fakeStore())).toBe(true)
  })
  test('GS4 backupCurrent / readLast / restoreLast incluyen gym', () => {
    const g1 = { log: [set], exercises: [] }
    const s = fakeStore({ [GY]: JSON.stringify(g1), [`${GY}.backup.last`]: 'viejo' })
    expect(backupCurrent(s)).toBe(true)
    expect(s.m.get(`${GY}.backup.last`)).toBe(JSON.stringify(g1)); expect(s.m.get(`${GY}.backup.prev`)).toBe('viejo')
    expect(hasLastBackup(fakeStore({ [`${GY}.backup.last`]: 'x' }))).toBe(true)
    s.m.set(GY, JSON.stringify(EMPTY_GYM))
    const r = readLast(s)
    expect(r).toMatchObject({ events: null, custom: null, gym: g1 })
    expect(restoreLast(r as never, s)).toBe(true)
    expect(s.m.get(GY)).toBe(JSON.stringify(g1)); expect(s.m.get(`${GY}.backup.last`)).toBe(JSON.stringify(EMPTY_GYM))
  })
  test('GS5 export/parse de gym', () => {
    const g1 = { log: [set, undo], exercises: [ex], unit: 'lbs' }
    expect(parseBackup(exportBackup([], EMPTY_CUSTOM, 'x', g1 as never))?.gym).toEqual(g1)
    expect(parseBackup(exportBackup([], EMPTY_CUSTOM, 'x'))?.gym).toBeNull()
    const raw = (gym: unknown) => JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: [], custom: EMPTY_CUSTOM, gym })
    expect(parseBackup(raw('roto'))).toBeNull()
    expect(parseBackup(raw({ log: [null] }))?.dropped).toBe(1)
  })
  test('GS6 isDataKey', () => { expect(isDataKey(GYM_KEY)).toBe(true); expect(isDataKey('otra')).toBe(false) })
})

describe('módulo Comida', () => {
  const FK = FOOD_KEY
  const ent = { id: 'e1', occurredAt: '2026-10-07T10:00:00', name: 'Arroz blanco cocido', kcal: 195, p: 4, c: 42.3, f: 0.4, foodId: 'rice-white-cooked', base: 'g', qty: 150, via: 'voice' }
  const quick = { id: 'e2', occurredAt: '2026-10-07T11:00:00', name: 'Añadido rápido', kcal: 1000, qty: 0 }
  const fu = { id: 'u1', undoes: 'e1', occurredAt: '2026-10-07T10:00:00' }
  const food = { id: 'food-1', name: 'Mi tarta', base: 'g', kcal: 300, p: 5, c: 40, f: 12, servings: [{ name: 'Trozo', qty: 80 }], aliases: ['pastel'], source: 'off', ref: '123' }
  const goal = { from: '2026-10-01', kcal: 2000, p: 20, c: 50, f: 30 }
  const meal = { id: 'meal-1', name: 'Desayuno', items: [{ foodId: 'egg', qty: 100, serving: { name: 'Unidad', n: 2 } }] }
  beforeEach(unlockStorage)
  test('FD9 readFood: roundtrip, campos desconocidos y reparaciones', () => {
    const data = { log: [ent, quick, fu, { ...ent, id: 'e3', futuro: 1 }], foods: [food, { ...food, id: 'food-2', extra: true }], goals: [goal], meals: [meal], futuro: { a: 1 } }
    expect(readFood(JSON.parse(JSON.stringify(data)))).toEqual({ data, dropped: 0, fixed: 0 })
    expect(readFood({})!.data).toEqual({ log: [], foods: [] })
    const bad = [{ ...ent, id: 'a', kcal: -1 }, { ...ent, id: 'b', qty: 0 }, { ...ent, id: 'c', qty: 2001 }, { ...ent, id: 'd', name: '' }, { ...ent, id: 'f', base: 'kg' }, { ...ent, id: 'g', p: 3000 }, { ...ent, id: 'h', occurredAt: '2026-10-07' }, { ...ent, id: 'i', serving: { name: 'x', n: 60 } }, null]
    const r = readFood({ log: [ent, ...bad] })!
    expect(r.data.log).toEqual([ent]); expect(r.dropped).toBe(bad.length)
    const f = readFood({ foods: [{ ...food, id: 'food-9', servings: [{ name: 'a', qty: 5 }, { name: '', qty: 5 }], aliases: ['x', ''], archived: 'si', source: 3 }, food, { ...food, id: 'sin-prefijo' }, { ...food, id: 'food-3', kcal: 901 }, { ...food, id: 'food-4', name: '  ' }] })!
    expect(f.data.foods).toHaveLength(2); expect(f.data.foods[0]).toEqual({ ...food, id: 'food-9', servings: [{ name: 'a', qty: 5 }], aliases: ['x'], source: undefined, archived: undefined })
    expect(f.fixed).toBe(4); expect(f.dropped).toBe(3)
    expect(readFood({ foods: [{ ...food, servings: [{ name: '', qty: 0 }], aliases: [] }] })!.data.foods[0]).not.toHaveProperty('servings')
    const g = readFood({ goals: [goal, { ...goal, from: '2026-10-05', p: 30 }, { ...goal, from: '2026-10-06', kcal: 700 }, { ...goal, from: '2026-10-02', kcal: 2100.5 }, { ...goal, from: '2026-10-01', kcal: 2500 }, 'x'] })!
    expect(g.data.goals).toEqual([{ ...goal, kcal: 2500 }]); expect(g.dropped).toBe(4); expect(g.fixed).toBe(1)
    expect(readFood({ goals: 5 })).toMatchObject({ dropped: 1 })
    const items = [{ foodId: 'a', qty: 0 }, { foodId: '', qty: 5 }, { foodId: 'b', qty: 5 }, 'x']
    const m = readFood({ meals: [{ ...meal, items }, { ...meal, id: 'meal-2', items: [] }, { ...meal, id: 'x-1' }, meal, meal, { ...meal, name: ' ', id: 'meal-9' }] })!
    expect(m.data.meals).toEqual([{ ...meal, items: [{ foodId: 'b', qty: 5 }] }]); expect(m.fixed).toBe(3); expect(m.dropped).toBe(5)
    const dup = readFood({ foods: [food, { ...food, name: 'otra' }], meals: [meal, { ...meal, name: 'otra' }] })!
    expect(dup.data.foods).toHaveLength(1); expect(dup.data.meals).toHaveLength(1); expect(dup.dropped).toBe(2)
    expect(readFood({ log: 'x' })).toBeNull(); expect(readFood({ foods: {} })).toBeNull(); expect(readFood([])).toBeNull(); expect(readFood('x')).toBeNull()
    expect(readFood({ __proto__: { x: 1 }, log: [] })!.data).toEqual({ log: [], foods: [] })
  })
  test('loadAll con la comida corrupta: backup y aviso; el resto intacto', () => {
    const s = fakeStore({ [EV]: JSON.stringify([good]), [FK]: '{roto' })
    const r = loadAll(s, D)
    expect(r.food).toEqual(EMPTY_FOOD); expect(r.events).toEqual([good])
    expect(r.problems).toEqual([{ key: FK, dropped: null, fixed: 0, backupKey: BK(FK) }]); expect(s.m.get(BK(FK))).toBe('{roto')
    expect(loadAll(fakeStore(), D).food).toEqual(EMPTY_FOOD)
    expect(loadAll(fakeStore({ [FK]: JSON.stringify({ log: [ent, null], foods: [] }) }), D).problems[0]).toMatchObject({ key: FK, dropped: 1 })
  })
  test('clave bloqueada: saveFood devuelve null', () => {
    const s = fakeStore({ [FK]: '{roto' }, true)
    expect(loadAll(s, D).problems[0].backupKey).toBeNull()
    expect(saveFood(EMPTY_FOOD, s)).toBeNull()
    unlockStorage(); expect(saveFood(EMPTY_FOOD, fakeStore())).toBe(true); expect(saveFood(EMPTY_FOOD, fakeStore({}, true))).toBe(false)
  })
  test('backupCurrent / readLast / restoreLast incluyen la comida', () => {
    const d1 = { log: [ent], foods: [] }
    const s = fakeStore({ [FK]: JSON.stringify(d1), [`${FK}.backup.last`]: 'viejo' })
    expect(backupCurrent(s)).toBe(true)
    expect(s.m.get(`${FK}.backup.last`)).toBe(JSON.stringify(d1)); expect(s.m.get(`${FK}.backup.prev`)).toBe('viejo')
    expect(hasLastBackup(fakeStore({ [`${FK}.backup.last`]: 'x' }))).toBe(true)
    s.m.set(FK, JSON.stringify(EMPTY_FOOD))
    const r = readLast(s)
    expect(r).toMatchObject({ events: null, custom: null, gym: null, food: d1 })
    expect(restoreLast(r as never, s)).toBe(true)
    expect(s.m.get(FK)).toBe(JSON.stringify(d1)); expect(s.m.get(`${FK}.backup.last`)).toBe(JSON.stringify(EMPTY_FOOD))
    expect(readLast(fakeStore({ [`${FK}.backup.last`]: '[]' }))).toBe('unreadable')
  })
  test('FD10 export/parse: con food, sin food (null) e ilegible', () => {
    const d1 = { log: [ent, quick, fu], foods: [food], goals: [goal], meals: [meal] }
    expect(parseBackup(exportBackup([], EMPTY_CUSTOM, 'x', undefined, d1 as never))?.food).toEqual(d1)
    expect(parseBackup(exportBackup([], EMPTY_CUSTOM, 'x'))?.food).toBeNull()
    const raw = (fd: unknown) => JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: [], custom: EMPTY_CUSTOM, food: fd })
    expect(parseBackup(raw('roto'))).toBeNull()
    expect(parseBackup(raw({ log: [null] }))?.dropped).toBe(1)
    expect(isDataKey(FK)).toBe(true)
  })
})

describe('clave de Anthropic y ajustes de voz (T3)', () => {
  const KEY = 'sk-ant-api03-0123456789abcdefghij'
  test('readAiKey valida el formato', () => {
    expect(readAiKey(KEY)).toBe(KEY)
    expect(readAiKey(`  ${KEY}\n`)).toBe(KEY)
    expect(readAiKey('abc-ant-0123456789abcdefghij')).toBeNull()
    expect(readAiKey('sk-ant-corta')).toBeNull()
    expect(readAiKey('sk-ant-0123456789 abcdefghij')).toBeNull()
    expect(readAiKey(`sk-ant-${'a'.repeat(300)}`)).toBeNull()
    expect(readAiKey(null)).toBeNull()
  })
  test('guardar, leer y borrar', () => {
    const s = { ...fakeStore(), removeItem(k: string) { this.m.delete(k) } }
    expect(loadAiKey(s)).toBeNull()
    expect(saveAiKey(`  ${KEY} `, s)).toBe(true)
    expect(loadAiKey(s)).toBe(KEY)
    expect(clearAiKey(s)).toBe(true)
    expect(loadAiKey(s)).toBeNull()
    expect(saveAiKey(KEY, fakeStore({}, true))).toBe(false)
  })
  test('ajustes de voz: privacyAck', () => {
    const s = fakeStore()
    expect(loadVoicePrefs(s)).toEqual({})
    expect(saveVoicePrefs({ privacyAck: '2026-10-07T10:00:00.000Z' }, s)).toBe(true)
    expect(loadVoicePrefs(s)).toEqual({ privacyAck: '2026-10-07T10:00:00.000Z' })
    for (const raw of ['5', '[]', '{"privacyAck":3}', '{roto']) expect(loadVoicePrefs(fakeStore({ [VOICE_KEY]: raw }))).toEqual({})
  })
  test('ninguna de las dos claves es de datos ni entra en copias ni exportaciones', () => {
    expect(isDataKey(AI_KEY)).toBe(false); expect(isDataKey(VOICE_KEY)).toBe(false)
    const s = fakeStore({ [EV]: JSON.stringify([good]), [AI_KEY]: KEY, [VOICE_KEY]: '{"privacyAck":"x"}' })
    expect(backupCurrent(s)).toBe(true)
    expect([...s.m.keys()].filter(k => k.includes('backup')).every(k => !k.includes('ai-key') && !k.includes('voice'))).toBe(true)
    const text = exportBackup([good], EMPTY_CUSTOM, 'x', EMPTY_GYM)
    expect(text).not.toContain(KEY); expect(text).not.toContain('privacyAck')
    expect(JSON.stringify(parseBackup(text))).not.toContain(KEY)
  })
})

describe('memoria de la captura', () => {
  const entries = [{ k: 'burguer', kind: 'tracker' as const, id: 'burgers' }]
  test('loadMemo: ausente, roto y válido', () => {
    expect(loadMemo(fakeStore())).toEqual([])
    expect(loadMemo(fakeStore({ [MEMO_KEY]: '{roto' }))).toEqual([])
    expect(loadMemo(fakeStore({ [MEMO_KEY]: JSON.stringify({ v: 1, entries }) }))).toEqual(entries)
  })
  test('saveMemo y clearMemo', () => {
    const s = { ...fakeStore(), removeItem(k: string) { this.m.delete(k) } }
    expect(saveMemo(entries, s)).toBe(true)
    expect(JSON.parse(s.m.get(MEMO_KEY) as string)).toEqual({ v: 1, entries })
    expect(loadMemo(s)).toEqual(entries)
    expect(clearMemo(s)).toBe(true)
    expect(loadMemo(s)).toEqual([])
    expect(saveMemo(entries, fakeStore({}, true))).toBe(false)
  })
  test('no es clave de datos ni entra en copias ni exportaciones', () => {
    expect(isDataKey(MEMO_KEY)).toBe(false)
    const s = fakeStore({ [EV]: JSON.stringify([good]), [MEMO_KEY]: JSON.stringify({ v: 1, entries }) })
    expect(backupCurrent(s)).toBe(true)
    expect([...s.m.keys()].some(k => k.startsWith(MEMO_KEY + '.backup'))).toBe(false)
    expect(exportBackup([good], EMPTY_CUSTOM, 'x', EMPTY_GYM)).not.toContain('burguer')
  })
})

describe('avisos de privacidad de Comida (32.2)', () => {
  test('carga, guarda y corrupta -> {}', () => {
    const s = fakeStore()
    expect(loadFoodPrivacy(s)).toEqual({})
    expect(saveFoodPrivacy({ off: '2026-10-15T10:00:00.000Z', label: '2026-10-16T10:00:00.000Z' }, s)).toBe(true)
    expect(loadFoodPrivacy(s)).toEqual({ off: '2026-10-15T10:00:00.000Z', label: '2026-10-16T10:00:00.000Z' })
    for (const raw of ['5', '[]', '{"off":3}', '{roto']) expect(loadFoodPrivacy(fakeStore({ [FOOD_PRIVACY_KEY]: raw }))).toEqual({})
  })
  test('fuera de datos, copias y backupCurrent', () => {
    expect(isDataKey(FOOD_PRIVACY_KEY)).toBe(false)
    const s = fakeStore({ [EV]: JSON.stringify([good]), [FOOD_PRIVACY_KEY]: '{"off":"x"}' })
    expect(backupCurrent(s)).toBe(true)
    expect([...s.m.keys()].filter(k => k.includes('backup')).every(k => !k.includes('food-privacy'))).toBe(true)
    const text = exportBackup([good], EMPTY_CUSTOM, 'x', EMPTY_GYM)
    expect(text).not.toContain('food-privacy'); expect(text).not.toContain('"off"')
  })
})

describe('storageUsage (ciclo 40)', () => {
  const store = (init: Record<string, string>, getItem?: (k: string) => string | null) => {
    const keys = Object.keys(init)
    return { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: getItem ?? ((k: string) => init[k] ?? null) }
  }
  const init = { 'life-rpg-demo-v1': '[]', 'life-rpg-food-v1.backup.last': 'abc', 'life-rpg-food-v1.backup.20261008T123456': 'xyz', 'life-rpg-ai-key-v1': 'sk', 'otra-app': 'zzzz' }
  const len = (k: keyof typeof init) => k.length + init[k].length
  test('ST-U1: clasifica', () => {
    const data = len('life-rpg-demo-v1'), backups = len('life-rpg-food-v1.backup.last'), sealed = len('life-rpg-food-v1.backup.20261008T123456'), device = len('life-rpg-ai-key-v1')
    expect(storageUsage(store(init))).toEqual({ data, backups, sealed, sealedCount: 1, device, total: data + backups + sealed + device })
  })
  test('ST-U2: ignora claves ajenas', () => {
    expect(storageUsage(store({ 'otra-app': 'zzzz' }))?.total).toBe(0)
  })
  test('ST-U3: umbral de usageWarn', () => {
    const u = storageUsage(store({}))!
    expect(usageWarn({ ...u, total: 3_500_000 })).toBe(true)
    expect(usageWarn({ ...u, total: 3_499_999 })).toBe(false)
  })
  test('ST-U4: getItem que lanza → null', () => {
    expect(storageUsage(store(init, () => { throw new Error('x') }))).toBeNull()
  })
})
