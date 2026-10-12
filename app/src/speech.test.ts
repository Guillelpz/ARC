// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { isIosStandalone, listenOnce, speechSupported } from './speech'

// Reconocimiento simulado: el test llama a result()/onerror/onend a mano
class FakeRecognition {
  static last: FakeRecognition
  lang = ''; continuous = true; interimResults = false; maxAlternatives = 0
  onstart: (() => void) | null = null; onaudiostart = null; onspeechstart = null; onspeechend = null
  onresult: ((e: unknown) => void) | null = null; onnomatch = null
  onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null
  started = false; stopped = 0; aborted = 0
  constructor() { FakeRecognition.last = this }
  start() { this.started = true; this.onstart?.() }
  stop() { this.stopped++ }
  abort() { this.aborted++ }
  result(transcript: string, isFinal: boolean) { this.onresult?.({ results: [Object.assign([{ transcript }], { isFinal })] }) }
}
const w = window as unknown as Record<string, unknown>
beforeEach(() => { vi.useFakeTimers(); w.webkitSpeechRecognition = FakeRecognition })
afterEach(() => { delete w.webkitSpeechRecognition; vi.useRealTimers(); vi.restoreAllMocks() })

test('resultado final: para y devuelve el texto', async () => {
  const { result } = listenOnce({ lang: 'es-ES' })
  const r = FakeRecognition.last
  expect(r.lang).toBe('es-ES'); expect(r.continuous).toBe(false); expect(r.interimResults).toBe(true); expect(r.maxAlternatives).toBe(1)
  r.result('80 kilos press banca 5 repeticiones', true)
  expect(r.stopped).toBe(1)
  r.onend?.()
  expect(await result).toEqual({ ok: true, text: '80 kilos press banca 5 repeticiones' })
})

test('parcial + end: usa el ultimo parcial', async () => {
  const { result } = listenOnce({ lang: 'es-ES' })
  const r = FakeRecognition.last
  r.result('80 kilos', false); r.result('80 kilos press banca 5', false)
  r.onend?.()
  expect(await result).toEqual({ ok: true, text: '80 kilos press banca 5' })
})

test('timeout: stop() y 2 s despues abort()', async () => {
  const events: string[] = []
  const { result } = listenOnce({ lang: 'es-ES', timeoutMs: 8000, onEvent: e => events.push(e.ev) })
  const r = FakeRecognition.last
  vi.advanceTimersByTime(8000)
  expect(r.stopped).toBe(1); expect(r.aborted).toBe(0)
  vi.advanceTimersByTime(2000)
  expect(r.aborted).toBe(1)
  expect(await result).toEqual({ ok: false, error: 'timeout' })
  expect(events).toContain('start')
})

test('timeout con texto parcial: devuelve el texto', async () => {
  const { result } = listenOnce({ lang: 'es-ES' })
  FakeRecognition.last.result('dominadas 12', false)
  vi.advanceTimersByTime(10_000)
  expect(await result).toEqual({ ok: true, text: 'dominadas 12' })
})

test('error not-allowed', async () => {
  const { result } = listenOnce({ lang: 'es-ES' })
  FakeRecognition.last.onerror?.({ error: 'not-allowed' }); FakeRecognition.last.onend?.()
  expect(await result).toEqual({ ok: false, error: 'not-allowed' })
})

test('codigo desconocido es other con detalle; sin nada es no-result', async () => {
  const a = listenOnce({ lang: 'es-ES' })
  FakeRecognition.last.onerror?.({ error: 'language-not-supported' }); FakeRecognition.last.onend?.()
  expect(await a.result).toEqual({ ok: false, error: 'other', detail: 'language-not-supported' })
  const b = listenOnce({ lang: 'es-ES' })
  FakeRecognition.last.onend?.()
  expect(await b.result).toEqual({ ok: false, error: 'no-result' })
})

test('sin API es not-supported', async () => {
  delete w.webkitSpeechRecognition
  expect(speechSupported()).toBe(false)
  expect(await listenOnce({ lang: 'es-ES' }).result).toEqual({ ok: false, error: 'not-supported' })
})

test('texto + error es ok (se prioriza el texto)', async () => {
  const { result } = listenOnce({ lang: 'es-ES' })
  FakeRecognition.last.result('sentadilla 100 5', false)
  FakeRecognition.last.onerror?.({ error: 'network' }); FakeRecognition.last.onend?.()
  expect(await result).toEqual({ ok: true, text: 'sentadilla 100 5' })
})

test('start() que lanza es other', async () => {
  vi.spyOn(FakeRecognition.prototype, 'start').mockImplementation(() => { throw new Error('boom') })
  expect(await listenOnce({ lang: 'es-ES' }).result).toEqual({ ok: false, error: 'other', detail: 'boom' })
})

test('isIosStandalone y speechSupported con la API', () => {
  expect(isIosStandalone()).toBe(false)
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  expect(isIosStandalone()).toBe(true)
  delete (navigator as unknown as Record<string, unknown>).standalone
  expect(speechSupported()).toBe(true)
})
