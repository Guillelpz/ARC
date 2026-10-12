import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EXERCISES } from './gym'
import { HAIKU_VOICE_MODEL, askHaiku, interpretGym } from './haiku'

const KEY = 'sk-ant-test-0000000000000000'
const reply = (o: unknown, extra: Record<string, unknown> = {}) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(o) }], ...extra })
const ok = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
const bench = { exerciseId: 'bench-press', weight: 80, unit: 'kg', reps: 5, sets: 1 }
const mock = (impl: (...a: unknown[]) => unknown) => vi.fn(impl) as unknown as typeof fetch & ReturnType<typeof vi.fn>
const ask = (f: typeof fetch) => askHaiku('80 kilos press banca 5 repeticiones', EXERCISES, 'kg', KEY, f)

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('askHaiku', () => {
  test('la peticion exacta', async () => {
    const f = mock(() => ok(reply(bench)))
    const r = await ask(f)
    expect(r).toEqual({ ok: true, draft: { exerciseId: 'bench-press', weight: 80, unit: 'kg', reps: 5, sets: 1 } })
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({ 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' })
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe(HAIKU_VOICE_MODEL); expect(body.model).toBe('claude-haiku-5-5')
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema.properties.exerciseId.enum).toEqual([...EXERCISES.map(e => e.id), 'none'])
    expect(body.messages[0].content).toContain('<frase>80 kilos press banca 5 repeticiones</frase>')
    expect(JSON.stringify(body)).not.toContain(KEY)
  })
  test('toma el primer bloque de texto', async () => {
    const f = mock(() => ok({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'x' }, { type: 'text', text: JSON.stringify(bench) }] }))
    expect((await ask(f)).ok).toBe(true)
  })
  test.each([[401, 'auth'], [403, 'auth'], [429, 'rate'], [529, 'rate'], [400, 'bad-request'], [500, 'http']] as const)('HTTP %i -> %s', async (status, error) => {
    expect(await ask(mock(() => ok({ error: 'x' }, status)))).toEqual({ ok: false, error })
  })
  test('refusal, max_tokens, texto no JSON, ejercicio fuera de la lista, sin bloque de texto', async () => {
    expect(await ask(mock(() => ok(reply(bench, { stop_reason: 'refusal' }))))).toEqual({ ok: false, error: 'refusal' })
    expect(await ask(mock(() => ok(reply(bench, { stop_reason: 'max_tokens' }))))).toEqual({ ok: false, error: 'invalid' })
    expect(await ask(mock(() => ok({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'hola' }] })))).toEqual({ ok: false, error: 'invalid' })
    expect(await ask(mock(() => ok(reply({ ...bench, exerciseId: 'ghost' }))))).toEqual({ ok: false, error: 'invalid' })
    expect(await ask(mock(() => ok({ stop_reason: 'end_turn', content: [] })))).toEqual({ ok: false, error: 'invalid' })
  })
  test('timeout a los 8 s y red caida', async () => {
    const hang = mock((_u: unknown, init: unknown) => new Promise((_, rej) => (init as RequestInit).signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))))
    const p = ask(hang)
    let done = false; void p.then(() => { done = true })
    await vi.advanceTimersByTimeAsync(7999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await p).toEqual({ ok: false, error: 'timeout' })
    expect(await ask(mock(() => Promise.reject(new TypeError('Failed to fetch'))))).toEqual({ ok: false, error: 'network' })
  })
})

describe('interpretGym', () => {
  test('sin clave u offline no llama a fetch', async () => {
    const f = mock(() => ok(reply(bench)))
    const a = await interpretGym('80 kilos press banca 5 repeticiones', EXERCISES, 'kg', null, true, f)
    const b = await interpretGym('80 kilos press banca 5 repeticiones', EXERCISES, 'kg', KEY, false, f)
    expect(f).not.toHaveBeenCalled()
    expect(a).toMatchObject({ source: 'parser', draft: { exerciseId: 'bench-press', weight: 80, reps: 5 } })
    expect(a).not.toHaveProperty('aiError'); expect(b.source).toBe('parser')
  })
  test('con fallo usa el parser y lleva aiError', async () => {
    const r = await interpretGym('80 kilos press banca 5 repeticiones', EXERCISES, 'kg', KEY, true, mock(() => ok({}, 401)))
    expect(r).toMatchObject({ source: 'parser', aiError: 'auth', draft: { exerciseId: 'bench-press' } })
  })
  test('la IA completa gana; la IA con hueco cede al parser completo', async () => {
    const full = await interpretGym('la maquina de piernas 100 10', EXERCISES, 'kg', KEY, true, mock(() => ok(reply({ exerciseId: 'leg-press', weight: 100, unit: 'none', reps: 10, sets: 1 }))))
    expect(full).toMatchObject({ source: 'ai', draft: { exerciseId: 'leg-press', weight: 100, reps: 10 } })
    const hole = await interpretGym('press banca 80 5', EXERCISES, 'kg', KEY, true, mock(() => ok(reply({ ...bench, reps: null }))))
    expect(hole).toMatchObject({ source: 'parser', draft: { reps: 5 } })
  })
})
