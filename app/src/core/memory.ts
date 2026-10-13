import { STOPWORDS } from './classify'
import { ALL_UNITS, captureNorm, deviceSure, isOtherDay, isReady, measures, resolveAmount, routeCapture, type CaptureCommand, type CaptureCtx } from './capture'
import { parseGym } from './voice'

// Memoria de frases confirmadas (O1): frase sin números ni unidades → ejercicio u hábito. Puro: la persistencia es de storage.ts.
export const MEMO_MAX = 200
export type MemoEntry = { k: string; kind: 'gym' | 'tracker'; id: string } // k = memoKey; id = exerciseId | trackerId
export type Memo = MemoEntry[] // orden de uso: el último es el más reciente

const GYM_WORDS: ReadonlySet<string> = new Set('x por by rep reps repeticion repeticiones repetition repetitions serie series set sets kilogramo kilogramos'.split(' '))

export function memoKey(text: string): string | null {
  const t = captureNorm(text)
  if (isOtherDay(t)) return null
  const k = t.split(/[^a-z0-9.]+/)
    .filter(w => w !== '' && !/^\d+(\.\d+)?$/.test(w) && !ALL_UNITS.has(w) && !GYM_WORDS.has(w) && !STOPWORDS.has(w))
    .join(' ').slice(0, 120)
  return k.length < 3 ? null : k
}

// Aprende (o refresca) la frase de un comando gym/tracker de la IA o de la memoria. Si no procede, devuelve el mismo `m`.
export function learn(m: Memo, c: CaptureCommand): Memo {
  if (c.source !== 'ai' && c.source !== 'memory') return m
  let kind: MemoEntry['kind'], id: string | null
  if (c.kind === 'gym') { kind = 'gym'; id = c.draft.exerciseId } else if (c.kind === 'tracker') { kind = 'tracker'; id = c.trackerId } else return m
  const k = memoKey(c.text)
  if (!id || k === null) return m
  return [...m.filter(e => e.k !== k), { k, kind, id }].slice(-MEMO_MAX)
}

export function forget(m: Memo, text: string): Memo {
  const k = memoKey(text)
  if (k === null || !m.some(e => e.k === k)) return m
  return m.filter(e => e.k !== k)
}

// Valida lo leído de localStorage: entradas ilegibles se descartan; `k` repetida, gana la última; tope MEMO_MAX.
export function readMemo(v: unknown): Memo {
  if (typeof v !== 'object' || v === null) return []
  const o = v as { v?: unknown; entries?: unknown }
  if (o.v !== 1 || !Array.isArray(o.entries)) return []
  const out = new Map<string, MemoEntry>()
  for (const x of o.entries as unknown[]) {
    if (typeof x !== 'object' || x === null) continue
    const e = x as Record<string, unknown>
    if (typeof e.k !== 'string' || e.k.length < 1 || e.k.length > 120 || (e.kind !== 'gym' && e.kind !== 'tracker') || typeof e.id !== 'string' || e.id.length < 1 || e.id.length > 100) continue
    out.delete(e.k)
    out.set(e.k, { k: e.k, kind: e.kind, id: e.id })
  }
  return [...out.values()].slice(-MEMO_MAX)
}

// Comando que dicta la memoria para `text`, si la entrada sigue valiendo (ejercicio activo / hábito activo). La cantidad la saca el parser.
export function recall(text: string, ctx: CaptureCtx): CaptureCommand | null {
  const k = memoKey(text)
  const e = k === null ? undefined : ctx.memo?.find(x => x.k === k)
  if (!e) return null
  if (e.kind === 'gym') {
    if (!ctx.exercises.some(x => x.id === e.id)) return null
    return { kind: 'gym', text, source: 'memory', draft: parseGym(text, ctx.exercises, ctx.unit, e.id) }
  }
  const t = ctx.trackers.find(x => x.id === e.id && !x.archived)
  if (!t) return null
  return { text, source: 'memory', kind: 'tracker', trackerId: t.id, ...resolveAmount(t, measures(captureNorm(text))) }
}

// Lo que el dispositivo resuelve solo (`done`) o su mejor respaldo si hay que preguntar a Haiku.
export function localCapture(text: string, ctx: CaptureCtx): { cmd: CaptureCommand; done: boolean } {
  const parsed = routeCapture(text, ctx)
  if (parsed.kind === 'other-day' || deviceSure(parsed, ctx)) return { cmd: parsed, done: true }
  const mem = recall(text, ctx)
  if (mem && isReady(mem, ctx)) return { cmd: mem, done: true }
  return { cmd: mem ?? parsed, done: false }
}
