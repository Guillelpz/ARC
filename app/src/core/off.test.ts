import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { OFF_USER_AGENT, fetchOff, offUrl } from './off'

const EAN = '8480000118837'
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
const mock = (impl: (...a: unknown[]) => unknown) => vi.fn(impl) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const product = { status: 1, product: { product_name: 'Yogur', nutriments: { 'energy-kcal_100g': 61, proteins_100g: 3.5, carbohydrates_100g: 4.7, fat_100g: 3.3 } } }

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('fetchOff (FI-T1, sin red real)', () => {
  test('URL, cabecera y 200 -> found', async () => {
    const f = mock(() => json(product))
    const r = await fetchOff(EAN, f)
    expect(r.kind).toBe('found')
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(offUrl(EAN))
    expect(init.headers).toMatchObject({ 'X-User-Agent': OFF_USER_AGENT })
    expect(OFF_USER_AGENT).toBe('RPGLifeTracker/1.0 (+https://github.com/Guillelpz/ARC)')
  })
  test('404 con {status:0} -> not-found; 404 sin JSON -> not-found', async () => {
    expect(await fetchOff(EAN, mock(() => json({ status: 0 }, 404)))).toEqual({ kind: 'not-found' })
    expect(await fetchOff(EAN, mock(() => Promise.resolve(new Response('nope', { status: 404 }))))).toEqual({ kind: 'not-found' })
  })
  test('429 -> rate, 503 -> http', async () => {
    expect(await fetchOff(EAN, mock(() => json({}, 429)))).toEqual({ kind: 'error', error: 'rate' })
    expect(await fetchOff(EAN, mock(() => json({}, 503)))).toEqual({ kind: 'error', error: 'http' })
  })
  test('excepción -> network', async () => {
    expect(await fetchOff(EAN, mock(() => Promise.reject(new TypeError('fail'))))).toEqual({ kind: 'error', error: 'network' })
  })
  test('timeout (abort) -> timeout', async () => {
    const f = mock((...a: unknown[]) => new Promise((_, rej) => { (a[1] as RequestInit).signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError'))) }))
    const p = fetchOff(EAN, f)
    await vi.advanceTimersByTimeAsync(8000)
    expect(await p).toEqual({ kind: 'error', error: 'timeout' })
  })
  test('200 con cuerpo no JSON -> invalid', async () => {
    expect(await fetchOff(EAN, mock(() => Promise.resolve(new Response('<html>', { status: 200 }))))).toEqual({ kind: 'error', error: 'invalid' })
  })
})
