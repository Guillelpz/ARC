import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { EXERCISES } from './gym'
import { TRACKERS } from './trackers'
import type { Memo } from './memory'
import { routeCapture, type CaptureCtx } from './capture'
import { askLabel } from './label'
import { HAIKU_VOICE_MODEL, askCapture, askHaiku, interpretCapture, interpretGym, postHaiku } from './haiku'

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

describe('postHaiku', () => {
  test('timeout configurable y content en array', async () => {
    const hang = mock((_u: unknown, init: unknown) => new Promise((_, rej) => (init as RequestInit).signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))))
    const p = postHaiku({ system: 's', content: [{ type: 'text', text: 'x' }], schema: {}, maxTokens: 10, timeoutMs: 20000 }, KEY, hang)
    let done = false; void p.then(() => { done = true })
    await vi.advanceTimersByTimeAsync(19999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await p).toEqual({ ok: false, error: 'timeout' })
    const body = JSON.parse((hang.mock.calls[0] as [string, RequestInit])[1].body as string)
    expect(body.messages[0].content).toEqual([{ type: 'text', text: 'x' }])
  })
})

describe('askLabel', () => {
  const lab = { readable: true, name: 'Yogur', ean: '', per: '100g', servingQty: null, servingUnit: 'none', kcal: 61, kj: null, p: 3.5, c: 4.7, f: 3.3 }
  test('cuerpo con bloque image y resultado', async () => {
    const f = mock(() => ok(reply(lab)))
    const r = await askLabel('QUJD', KEY, f)
    expect(r.ok && r.draft.kcal).toBe(61)
    const [, init] = f.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } })
    expect(body.output_config.format.schema.additionalProperties).toBe(false)
    expect(JSON.stringify(body)).not.toContain(KEY)
  })
  test('timeout de 20 s', async () => {
    const hang = mock((_u: unknown, init: unknown) => new Promise((_, rej) => (init as RequestInit).signal!.addEventListener('abort', () => rej(new DOMException('abort', 'AbortError')))))
    const p = askLabel('QUJD', KEY, hang)
    let done = false; void p.then(() => { done = true })
    await vi.advanceTimersByTimeAsync(19999)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await p).toEqual({ ok: false, error: 'timeout' })
  })
  test('401 -> auth, readable false -> unreadable, forma invalida -> invalid', async () => {
    expect(await askLabel('x', KEY, mock(() => ok({ error: 'x' }, 401)))).toEqual({ ok: false, error: 'auth' })
    expect(await askLabel('x', KEY, mock(() => ok(reply({ ...lab, readable: false }))))).toEqual({ ok: false, error: 'unreadable' })
    expect(await askLabel('x', KEY, mock(() => ok(reply({ nope: 1 }))))).toEqual({ ok: false, error: 'invalid' })
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

describe('captura', () => {
  const act = TRACKERS
  const ctx: CaptureCtx = { exercises: EXERCISES, trackers: act, all: act, unit: 'kg' }
  const cap = { kind: 'none', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'none', amount: null, amountUnit: 'none', unitWord: '',
    name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '' }
  const newAlta = { ...cap, kind: 'new', name: 'Grounding', branch: 'hero', confidence: 'alta', type: 'duration', amount: 30, amountUnit: 'min', unitWord: 'min', reason: 'Bienestar' }
  const run = (t: string, f: typeof fetch, key: string | null = KEY, online = true) => interpretCapture(t, ctx, key, online, f)

  test('la peticion exacta de askCapture', async () => {
    const f = mock(() => ok(reply(newAlta)))
    const r = await askCapture('grounding 30 min', ctx, KEY, f)
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('claude-haiku-5-5'); expect(body.max_tokens).toBe(400)
    expect(body.thinking).toEqual({ type: 'disabled' })
    expect(body.output_config.format.schema.properties.exerciseId.enum).toEqual([...EXERCISES.map(e => e.id), 'none'])
    expect(body.output_config.format.schema.properties.trackerId.enum).toEqual([...act.map(t => t.id), 'none'])
    expect(body.messages[0].content).toContain('<frase>grounding 30 min</frase>')
    expect(body.messages[0].content).toContain('reading: Reading · HERO · min')
    expect(JSON.stringify(body)).not.toContain(KEY)
  })
  test('sin clave u offline no llama a fetch y devuelve el router', async () => {
    const f = mock(() => ok(reply(newAlta)))
    const a = await run('ate a burguer', f, null), b = await run('ate a burguer', f, KEY, false)
    expect(f).not.toHaveBeenCalled()
    expect(a).toEqual(routeCapture('ate a burguer', ctx)); expect(b).toEqual(a)
    expect(a).toMatchObject({ kind: 'tracker', trackerId: 'burgers', amount: 1, source: 'parser' })
    expect(a).not.toHaveProperty('aiError')
  })
  test('un 401 deja el parser con aiError auth', async () => {
    const r = await run('ate a burguer', mock(() => ok({}, 401)))
    expect(r).toMatchObject({ kind: 'tracker', trackerId: 'burgers', source: 'parser', aiError: 'auth' })
  })
  test('la IA new alta llega tal cual', async () => {
    const r = await run('grounding 30 min', mock(() => ok(reply(newAlta))))
    expect(r).toMatchObject({ kind: 'new', source: 'ai', habit: { name: 'Grounding', type: 'duration', amount: 30, confidence: 'alta', branch: 'hero' } })
  })
  test('la IA con trackerId inventado cae al parser', async () => {
    const r = await run('ate a burguer', mock(() => ok(reply({ ...cap, kind: 'tracker', trackerId: 'ghost' }))))
    expect(r).toMatchObject({ kind: 'tracker', trackerId: 'burgers', source: 'parser', aiError: 'invalid' })
  })
  test('O3: el dispositivo seguro no llama a fetch', async () => {
    for (const t of ['Read 50 pages of the name of the wind', '80kg bench press 5 reps', 'corrí 30 minutos', 'ayer leí 20 páginas']) {
      const f = mock(() => ok(reply(newAlta)))
      await run(t, f)
      expect(f, t).not.toHaveBeenCalled()
    }
  })
  test('O3: lo aproximado o incompleto sí llama a fetch', async () => {
    for (const t of ['ate a burguer', 'grounding 30 min', 'press banca 80']) {
      const f = mock(() => ok(reply(newAlta)))
      await run(t, f)
      expect(f, t).toHaveBeenCalledTimes(1)
    }
  })
  describe('memoria', () => {
    const mctx = (memo: Memo): CaptureCtx => ({ ...ctx, memo })
    const burg: Memo = [{ k: 'burguer', kind: 'tracker', id: 'burgers' }]
    const legs: Memo = [{ k: 'maquina piernas', kind: 'gym', id: 'leg-press' }]
    test('memoria lista: no llama a fetch', async () => {
      const f = mock(() => ok(reply(newAlta)))
      const r = await interpretCapture('ate a burguer', mctx(burg), KEY, true, f)
      expect(f).not.toHaveBeenCalled()
      expect(r).toMatchObject({ kind: 'tracker', trackerId: 'burgers', source: 'memory' })
    })
    test('memoria incompleta con clave: 1 llamada; si falla (500), la memoria con aiError', async () => {
      const f = mock(() => ok({}, 500))
      const r = await interpretCapture('máquina de piernas 100', mctx(legs), KEY, true, f)
      expect(f).toHaveBeenCalledTimes(1)
      expect(r).toMatchObject({ kind: 'gym', source: 'memory', aiError: 'http', draft: { exerciseId: 'leg-press', weight: 100 } })
    })
    test('memoria incompleta sin clave: el comando de la memoria', async () => {
      const f = mock(() => ok(reply(newAlta)))
      const r = await interpretCapture('máquina de piernas 100', mctx(legs), null, true, f)
      expect(f).not.toHaveBeenCalled()
      expect(r).toMatchObject({ kind: 'gym', source: 'memory' })
      expect(r).not.toHaveProperty('aiError')
    })
  })
})
