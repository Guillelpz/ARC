import { describe, expect, test } from 'vitest'
import { EMPTY_CUSTOM, parseCustom, readCustom, readEvents } from './storage'
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
