// Envoltorio de la Web Speech API. Fuera de `core/`: es una API del navegador (como pwa.ts).
// Tipos mínimos propios: `lib.dom` no trae los de webkitSpeechRecognition.
import { loadVoicePrefs, type VoiceLang } from './core/storage'

export type SpeechError = 'not-supported' | 'not-allowed' | 'service-not-allowed' | 'no-speech' | 'audio-capture'
  | 'network' | 'aborted' | 'timeout' | 'no-result' | 'other'
export type SpeechOutcome = { ok: true; text: string } | { ok: false; error: SpeechError; detail?: string }
export type SpeechLog = { t: number; ev: string; detail?: string }[] // ms desde start; solo para el diagnóstico

type Alt = { transcript: string }
type Res = { isFinal: boolean; 0: Alt; length: number }
type ResEvent = { resultIndex?: number; results: ArrayLike<Res> }
type ErrEvent = { error?: string; message?: string }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  onstart: ((e: unknown) => void) | null; onaudiostart: ((e: unknown) => void) | null
  onspeechstart: ((e: unknown) => void) | null; onspeechend: ((e: unknown) => void) | null
  onresult: ((e: ResEvent) => void) | null; onnomatch: ((e: unknown) => void) | null
  onerror: ((e: ErrEvent) => void) | null; onend: ((e: unknown) => void) | null
  start(): void; stop(): void; abort(): void
}
type Ctor = new () => Recognition
type SpeechWindow = { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }

// ponytail: el valor se fija tras la prueba del usuario en el iPhone (T8 de docs/TECH_SPEC-voz-gym.md).
// 'never' = siempre se intenta la voz y, si falla, cae al campo de texto enfocado. 'standalone' = en la PWA de iOS abre el campo directamente;
// 'always' = en cualquier iOS. Sin prueba hecha, se queda en 'never'.
export type KeyboardOnIos = 'never' | 'standalone' | 'always'
export const KEYBOARD_ON_IOS = 'never' as KeyboardOnIos

export const getRecognition = (): Ctor | undefined => {
  const w = window as unknown as SpeechWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}
export const speechSupported = () => getRecognition() !== undefined && navigator.onLine !== false
export const isIosStandalone = () => (navigator as { standalone?: boolean }).standalone === true
export const isStandaloneApp = () => isIosStandalone() || window.matchMedia?.('(display-mode: standalone)').matches === true
// Idioma elegido en Ajustes, no el del sistema: con el móvil en inglés y la app en español, el dictado debe ser en español.
export const speechLang = (): VoiceLang => loadVoicePrefs().lang ?? 'es-ES'
// ¿hay que saltarse la voz y abrir el campo de texto? (iOS según KEYBOARD_ON_IOS)
export const keyboardFirst = () => {
  const ios = (navigator as { standalone?: boolean }).standalone !== undefined
  return (KEYBOARD_ON_IOS as KeyboardOnIos) === 'always' ? ios : (KEYBOARD_ON_IOS as KeyboardOnIos) === 'standalone' ? isIosStandalone() : false
}

const MAPPED = new Set(['not-allowed', 'service-not-allowed', 'no-speech', 'audio-capture', 'network', 'aborted'])
const STOP_GRACE_MS = 2000

export function listenOnce({ lang, timeoutMs = 8000, onEvent }: { lang: string; timeoutMs?: number; onEvent?: (e: { t: number; ev: string; detail?: string }) => void }): { result: Promise<SpeechOutcome>; stop(): void } {
  const Rec = getRecognition()
  if (!Rec) return { result: Promise.resolve({ ok: false, error: 'not-supported' }), stop() {} }
  const t0 = Date.now()
  const log = (ev: string, detail?: string) => onEvent?.({ t: Date.now() - t0, ev, ...(detail !== undefined && { detail }) })
  let text = '', err: SpeechError | null = null, detail: string | undefined, done = false
  let t1: ReturnType<typeof setTimeout> | undefined, t2: ReturnType<typeof setTimeout> | undefined
  let resolve!: (o: SpeechOutcome) => void
  const result = new Promise<SpeechOutcome>(r => { resolve = r })
  const rec = new Rec()
  const finish = () => {
    if (done) return
    done = true; clearTimeout(t1); clearTimeout(t2)
    const t = text.trim()
    resolve(t ? { ok: true, text: t } : err ? { ok: false, error: err, ...(detail !== undefined && { detail }) } : { ok: false, error: 'no-result' })
  }
  const stop = () => { try { rec.stop() } catch { /* ya parado */ } }
  rec.lang = lang; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1
  rec.onstart = () => log('start')
  rec.onaudiostart = () => log('audiostart')
  rec.onspeechstart = () => log('speechstart')
  rec.onspeechend = () => log('speechend')
  rec.onnomatch = () => log('nomatch')
  rec.onresult = e => {
    const last = e.results[e.results.length - 1]
    if (!last) return
    text = last[0]?.transcript ?? text
    log(`result(${last.isFinal ? 'final' : 'interim'})`, text)
    if (last.isFinal) stop()
  }
  rec.onerror = e => {
    const code = e.error ?? 'other'
    log(`error:${code}`, e.message)
    if (MAPPED.has(code)) err = code as SpeechError
    else { err = 'other'; detail = code }
  }
  rec.onend = () => { log('end'); finish() }
  t1 = setTimeout(() => {
    if (done) return
    log('timeout'); stop()
    t2 = setTimeout(() => {
      if (done) return
      try { rec.abort() } catch { /* ya parado */ }
      if (!text.trim() && !err) err = 'timeout'
      finish()
    }, STOP_GRACE_MS)
  }, timeoutMs)
  try { rec.start() } catch (e) { err = 'other'; detail = e instanceof Error ? e.message : String(e); finish() }
  return { result, stop }
}
