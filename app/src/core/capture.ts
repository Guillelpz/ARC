import type { Branch, Confidence, Exercise, Tracker, WeightUnit } from './types'
import { STOPWORDS, classify, isValidName, isValidUnit, matchTracker, normalizeText, trackerName } from './classify'
import { isComplete, matchExercise, normalizeVoice, parseGym, type HaikuError, type VoiceCommand } from './voice'

export const PAGE_MIN = 2        // 1 página = 2 min (solo en Reading)
export const MAX_CAPTURE = 999
export const AUTO_CREATE_S = 10  // 0 = nunca se crea sola

export type Family = 'min' | 'h' | 'km' | 'pages' | 'count' | 'other'
// value tal como se dijo; family null = número sin unidad; word = la palabra que sigue al número ('' si no hay)
export type Measure = { value: number; family: Family | null; word: string }
export type Problem = 'unit' | 'range'
export type NewHabit = {
  name: string; branch: Branch; type: Tracker['type']; unit?: string // solo custom
  amount: number | null // en la unidad del tipo; null = falta (solo duration/distance sin cantidad)
  confidence: Confidence; reason: string
  archivedDup?: string  // nombre del archivado con el mismo nombre
}
export type Src = { text: string; source: 'ai' | 'parser'; aiError?: HaikuError }
export type CaptureCommand =
  | VoiceCommand
  | Src & { kind: 'tracker'; trackerId: string; amount: number | null; said: Measure | null; problem: Problem | null }
  | Src & { kind: 'new'; habit: NewHabit; said: Measure | null }
  | Src & { kind: 'other-day' }
  | Src & { kind: 'unknown' }
export type CaptureCtx = { exercises: Exercise[]; trackers: Tracker[] /* activos */; all: Tracker[] /* incl. archivados */; unit: WeightUnit }

export const UNIT_WORDS: Record<Family, string[]> = {
  min: 'min mins minuto minutos minute minutes'.split(' '),
  h: 'h hora horas hour hours hr hrs'.split(' '),
  km: 'k km kms kilometro kilometros kilometer kilometers kilometre kilometres'.split(' '),
  pages: 'pag pags pagina paginas page pages'.split(' '),
  count: 'vez veces time times'.split(' '),
  other: 'm metro metros meter meters milla millas mile miles seg segundo segundos second seconds kg kgs kilo kilos lb lbs libra libras pound pounds litro litros liter liters'.split(' '),
}
const ALL_UNITS: ReadonlySet<string> = new Set(Object.values(UNIT_WORDS).flat())
const familyOf = (w: string): Family | null => (Object.keys(UNIT_WORDS) as Family[]).find(f => UNIT_WORDS[f].includes(w)) ?? null

// Normaliza la frase para el router: horas y medias horas, artículos fuera, números en palabra → dígitos.
export function captureNorm(text: string): string {
  let t = normalizeText(text)
  t = t.replace(/\b(?:media hora|half an hour|half hour)\b/g, '30 min')
  t = t.replace(/\b(?:una|un|uno|an|a|one) (?:hora|hour)\b/g, '1 hora')
  t = t.split(' ').filter(w => !['un', 'una', 'uno', 'an', 'a'].includes(w)).join(' ')
  return normalizeVoice(t)
}

const TODAY_RE = /\b(?:esta manana|por la manana|de la manana|this morning)\b/g
const OTHER_DAY_RE = new RegExp('\\b(?:' + [
  'ayer', 'anteayer', 'antes de ayer', 'anoche', 'manana', 'pasado manana', 'el otro dia', 'la semana pasada', 'hace \\d+ (?:dia|dias|semana|semanas)',
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'yesterday', 'tomorrow', 'last night', 'the other day', 'last week', '\\d+ days? ago', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
].join('|') + ')\\b')
const OTHER_DAY_WORDS: ReadonlySet<string> = new Set(['ayer', 'anteayer', 'anoche', 'manana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'yesterday', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'morning'])
// `t` ya normalizada con captureNorm.
// ponytail: lista cerrada. Las fechas («el 3 de octubre») no se detectan; se añaden si aparecen en el uso real.
export const isOtherDay = (t: string): boolean => OTHER_DAY_RE.test(t.replace(TODAY_RE, ' '))

// Cada número de `t` (ya con captureNorm) con la palabra que le sigue.
export function measures(t: string): Measure[] {
  const out: Measure[] = []
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)(?: ([a-z]+))?/g)) {
    const word = m[2] ?? ''
    out.push({ value: Number(m[1]), family: familyOf(word), word })
  }
  return out
}

const stem = (s: string) => s.replace(/(?:es|s)$/, '')

type Amt = { amount: number | null; said: Measure | null; problem: Problem | null }
// Cantidad que se apunta en un hábito. ponytail: «5,5 km» se guarda como 6 (todo el modelo usa enteros).
export function resolveAmount(t: Pick<Tracker, 'id' | 'type' | 'unit' | 'increment'>, ms: Measure[]): Amt {
  if (ms.length === 0) return { amount: t.increment, said: null, problem: null }
  const unit = normalizeText(t.unit)
  const factor = (m: Measure): number | null => {
    if (m.family === null) return 1
    switch (t.type) {
      case 'duration': return m.family === 'min' ? 1 : m.family === 'h' ? 60 : m.family === 'pages' && t.id === 'reading' ? PAGE_MIN : null
      case 'distance': return m.family === 'km' ? 1 : null
      case 'count': return m.family === 'count' ? 1 : null
      case 'custom': return stem(m.word) === stem(unit) || UNIT_WORDS[m.family].includes(unit) ? 1 : null
    }
  }
  for (const m of ms) {
    const f = factor(m)
    if (f === null) continue
    const amount = Math.round(m.value * f)
    return amount >= 1 && amount <= MAX_CAPTURE ? { amount, said: m, problem: null } : { amount: null, said: m, problem: 'range' }
  }
  return { amount: null, said: ms.find(m => m.family !== null) ?? null, problem: 'unit' }
}

export function convNote(said: Measure | null, amount: number | null): string | null {
  if (!said || amount === null) return null
  if (said.family === 'pages') return `${said.value} ${said.value === 1 ? 'página' : 'páginas'} ≈ ${amount} min`
  if (said.family === 'h') return `${said.value} h = ${amount} min`
  return null
}

const NUM_RE = /^\d+(?:\.\d+)?$/

// Propone un hábito nuevo a partir del texto (o, si el nombre coincide con uno existente, lo apunta en él).
// La confianza del parser se limita a «media»: solo la IA puede dar «alta» (y activar la cuenta atrás).
export function newFromText(text: string, ctx: CaptureCtx): CaptureCommand {
  const t = captureNorm(text)
  const ms = measures(t)
  const pat = /(\d+(?:\.\d+)?) ([a-z]+) (?:de|of) /.exec(t)
  const kept = text.split(/\s+/).map(w => w.replace(/[.,;:!?¿¡"«»]/g, '')).filter(Boolean).filter(w => {
    const n = normalizeText(w), nv = normalizeVoice(w)
    if (nv === '' || STOPWORDS.has(n) || ALL_UNITS.has(n) || OTHER_DAY_WORDS.has(n) || (pat && n === pat[2])) return false
    return !nv.split(' ').every(p => NUM_RE.test(p) || ALL_UNITS.has(p))
  })
  let name = ''
  for (const w of kept) { if ((name ? name + ' ' + w : w).length > 40) break; name = name ? name + ' ' + w : w }
  name = trackerName(name)
  const src: Src = { text, source: 'parser' }
  if (!isValidName(name)) return { ...src, kind: 'unknown' }
  const first = ms.find(m => m.family !== null)
  let type: Tracker['type'] = 'count', unit: string | undefined
  if (first) {
    switch (first.family) {
      case 'min': case 'h': type = 'duration'; break
      case 'km': type = 'distance'; break
      case 'pages': type = 'custom'; unit = 'páginas'; break
      case 'other': type = 'custom'; unit = first.word; break
    }
  } else if (pat) { type = 'custom'; unit = pat[2] }
  if (unit !== undefined && !isValidUnit(unit)) { type = 'count'; unit = undefined }
  const c = classify(name)
  return buildNew({ name, type, unit, ms, src, ctx, branch: c.branch, confidence: c.confidence === 'alta' ? 'media' : c.confidence, reason: c.reason })
}

type BuildNew = { name: string; type: Tracker['type']; unit?: string; ms: Measure[]; src: Src; ctx: CaptureCtx; branch: Branch; confidence: Confidence; reason: string }
// Hábito nuevo con su cantidad, o el existente con el mismo nombre (activo → tracker; archivado → `archivedDup`).
export function buildNew({ name, type, unit, ms, src, ctx, branch, confidence, reason }: BuildNew): CaptureCommand {
  const dup = ctx.trackers.find(x => normalizeText(x.name) === normalizeText(name))
  if (dup) return { ...src, kind: 'tracker', trackerId: dup.id, ...resolveAmount(dup, ms) }
  const r = ms.length ? resolveAmount({ id: '', type, unit: unit ?? '', increment: 1 }, ms) : null
  const amount = r ? r.problem ? null : r.amount : type === 'count' || type === 'custom' ? 1 : null
  const arch = ctx.all.find(x => x.archived && normalizeText(x.name) === normalizeText(name))
  return {
    ...src, kind: 'new', said: r?.said ?? null,
    habit: { name, branch, type, ...(type === 'custom' && { unit }), amount, confidence, reason, ...(arch && { archivedDup: arch.name }) },
  }
}

// Router determinista (también es el respaldo de la IA). Orden: otro día > gym > hábito existente > nuevo.
export function routeCapture(text: string, ctx: CaptureCtx): CaptureCommand {
  const t = captureNorm(text)
  const src: Src = { text, source: 'parser' }
  if (isOtherDay(t)) return { ...src, kind: 'other-day' }
  if (matchExercise(normalizeVoice(text), ctx.exercises)) return { kind: 'gym', text, source: 'parser', draft: parseGym(text, ctx.exercises, ctx.unit) }
  const tr = matchTracker(t, ctx.trackers, ALL_UNITS)
  if (tr) return { ...src, kind: 'tracker', trackerId: tr.id, ...resolveAmount(tr, measures(t)) }
  return newFromText(text, ctx)
}

export function isReady(c: CaptureCommand, ctx: CaptureCtx): boolean {
  switch (c.kind) {
    case 'gym': return isComplete(c.draft, ctx.exercises)
    case 'tracker': return c.amount !== null && c.problem === null
    case 'new': return c.habit.amount !== null && !c.habit.archivedDup
    default: return false
  }
}
