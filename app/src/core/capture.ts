import type { Memo } from './memory'
import type { Branch, Confidence, Exercise, Food, Tracker, WeightUnit } from './types'
import { STOPWORDS, classify, exactHits, exactTracker, isValidName, isValidUnit, matchTracker, normalizeText, trackerName, trackerWords } from './classify'
import { FOOD_UNIT_SET, foodItemsFromAI, foodReady, itemReady, looksLikeFood, parseFoodVoice, type FoodItem } from './foodVoice'
import { fromAI, isComplete, matchExercise, normalizeVoice, parseGym, pickDraft, type HaikuError, type VoiceCommand } from './voice'

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
export type Src = { text: string; source: 'ai' | 'parser' | 'memory'; aiError?: HaikuError }
export type CaptureCommand =
  | VoiceCommand
  | Src & { kind: 'tracker'; trackerId: string; amount: number | null; said: Measure | null; problem: Problem | null; food?: FoodItem[]; confirm?: true } // food = comida adjunta (FV4); confirm = D1: pedir «¿Apuntar en X?»
  | Src & { kind: 'food'; items: FoodItem[]; rest: string }
  | Src & { kind: 'new'; habit: NewHabit; said: Measure | null }
  | Src & { kind: 'other-day' }
  | Src & { kind: 'unknown' }
export type CaptureCtx = { exercises: Exercise[]; trackers: Tracker[] /* activos */; all: Tracker[] /* incl. archivados */; unit: WeightUnit; memo?: Memo; foods?: Food[] /* propios, también archivados */ }

export const UNIT_WORDS: Record<Family, string[]> = {
  min: 'min mins minuto minutos minute minutes'.split(' '),
  h: 'h hora horas hour hours hr hrs'.split(' '),
  km: 'k km kms kilometro kilometros kilometer kilometers kilometre kilometres'.split(' '),
  pages: 'pag pags pagina paginas page pages'.split(' '),
  count: 'vez veces time times'.split(' '),
  other: ('m metro metros meter meters milla millas mile miles seg segundo segundos second seconds kg kgs kilo kilos lb lbs libra libras pound pounds litro litros liter liters ' +
    'g gr gramo gramos gram grams ml cl l mililitro mililitros milliliter milliliters litre litres kcal kcals caloria calorias calorie calories').split(' '), // las últimas son de comida: no cuentan como cantidad de un hábito
}
export const ALL_UNITS: ReadonlySet<string> = new Set(Object.values(UNIT_WORDS).flat())
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

const MEASURE_G_ML = /\d ?(?:g|gr|gramos?|grams?|ml|cl|l|mililitros?|litros?|liters?|litres?|milliliters?|millilitres?)(?![a-z])/

// Router determinista (también es el respaldo de la IA). Orden: otro día > gym > hábito con coincidencia exacta (+ comida adjunta, FV4)
// > comida (término o «kcal») > hábito aproximado > comida desconocida (verbo de comer o g/ml) > hábito nuevo.
export function routeCapture(text: string, ctx: CaptureCtx): CaptureCommand {
  const t = captureNorm(text), own = ctx.foods ?? []
  const src: Src = { text, source: 'parser' }
  if (isOtherDay(t)) return { ...src, kind: 'other-day' }
  if (matchExercise(normalizeVoice(text), ctx.exercises)) return { kind: 'gym', text, source: 'parser', draft: parseGym(text, ctx.exercises, ctx.unit) }
  const fp = parseFoodVoice(text, own)
  if (exactHits(t, ctx.trackers, ALL_UNITS).length) {
    const tr = matchTracker(t, ctx.trackers, ALL_UNITS)!
    const ms = fp.items.length ? measures(t).filter(m => !FOOD_UNIT_SET.has(m.word)) : measures(t)
    return { ...src, kind: 'tracker', trackerId: tr.id, ...resolveAmount(tr, ms), ...(fp.items.length ? { food: fp.items } : {}) }
  }
  if (fp.items.length) return { ...src, kind: 'food', ...fp }
  const tr = matchTracker(t, ctx.trackers, ALL_UNITS)
  if (tr) {
    const a = resolveAmount(tr, measures(t))
    // Guardia de unidad: g/ml nunca es una cantidad válida de un hábito de unidades («beef 200 g» no es Beer): va a comida.
    if (!(a.problem === 'unit' && MEASURE_G_ML.test(t))) return { ...src, kind: 'tracker', trackerId: tr.id, ...a }
  }
  if (looksLikeFood(t)) {
    const any = parseFoodVoice(text, own, { anyFood: true })
    if (any.items.length) return { ...src, kind: 'food', ...any }
  }
  return newFromText(text, ctx)
}

// ¿Está el dispositivo seguro sin preguntar a Haiku? Gym completo, comida lista sin resto, o hábito con coincidencia exacta y única
// y sin palabras ajenas: fuera del nombre/alias del hábito solo números, unidades (incl. la del tracker) y stopwords.
// ponytail: sin clave o con Haiku caído, un hábito no seguro y sin cantidad dicha no se guarda solo: `needsConfirm` (D1). Palabras de < 3 letras se ignoran (como exactHits). Una frase mixta hábito + comida ya no es segura.
export function deviceSure(c: CaptureCommand, ctx: CaptureCtx): boolean {
  if (c.kind === 'gym') return isComplete(c.draft, ctx.exercises)
  if (c.kind === 'tracker') {
    const t = exactTracker(captureNorm(c.text), ctx.trackers, ALL_UNITS)
    if (t?.id !== c.trackerId) return false
    const own = new Set([...trackerWords(t), ...normalizeText(t.unit).split(/[^a-z0-9]+/)])
    return normalizeText(captureNorm(c.text)).split(/[^a-z0-9]+/)
      .every(w => w.length < 3 || /^\d+$/.test(w) || own.has(w) || ALL_UNITS.has(w) || STOPWORDS.has(w))
  }
  if (c.kind === 'food') return c.source === 'parser' && foodReady(c.items) && c.rest === ''
  return false
}

// D1 (ciclo 40): lo que resuelve el parser (sin clave, sin conexión o con Haiku caído) solo se guarda solo si el dispositivo está
// seguro (deviceSure) o hay una cantidad dicha que resolveAmount acepta. Si no, la vista pregunta «¿Apuntar en X?».
export function needsConfirm(c: CaptureCommand, ctx: CaptureCtx): c is Extract<CaptureCommand, { kind: 'tracker' }> {
  return c.kind === 'tracker' && c.source === 'parser' && c.amount !== null && c.problem === null && c.said === null && !deviceSure(c, ctx)
}

export function isReady(c: CaptureCommand, ctx: CaptureCtx): boolean {
  switch (c.kind) {
    case 'gym': return isComplete(c.draft, ctx.exercises)
    case 'tracker': return c.amount !== null && c.problem === null
    case 'new': return c.habit.amount !== null && !c.habit.archivedDup
    case 'food': return foodReady(c.items)
    default: return false
  }
}

const KINDS = ['gym', 'tracker', 'food', 'new', 'none'] as const
const AMOUNT_UNITS = ['min', 'h', 'km', 'pages', 'count', 'other', 'none'] as const
const TYPES = ['count', 'distance', 'duration', 'custom'] as const
const oneOf = <T extends string>(v: unknown, xs: readonly T[]): v is T => xs.includes(v as T)
const numOrNull = (v: unknown): v is number | null => v === null || (typeof v === 'number' && Number.isFinite(v))

// Respuesta de Haiku (ya parseada) → comando, o null si algún campo no es válido (entonces manda el parser).
export function captureFromAI(o: unknown, text: string, ctx: CaptureCtx): CaptureCommand | null {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
  const x = o as Record<string, unknown>
  if (!oneOf(x.kind, KINDS) || typeof x.otherDay !== 'boolean' || !oneOf(x.weightUnit, ['kg', 'lbs', 'none'] as const) ||
    !oneOf(x.amountUnit, AMOUNT_UNITS) || !oneOf(x.branch, ['hero', 'villain'] as const) || !oneOf(x.confidence, ['alta', 'media', 'baja'] as const) || !oneOf(x.type, TYPES)) return null
  if (typeof x.exerciseId !== 'string' || typeof x.trackerId !== 'string' || typeof x.reason !== 'string' || typeof x.name !== 'string') return null
  if (typeof x.unitWord !== 'string' || x.unitWord.length > 20 || typeof x.customUnit !== 'string' || x.customUnit.length > 20) return null
  if (!numOrNull(x.weight) || !numOrNull(x.amount) || !(x.reps === null || typeof x.reps === 'number') || typeof x.sets !== 'number') return null
  const active = ctx.trackers.filter(t => !t.archived)
  if (!['none', ...ctx.exercises.map(e => e.id)].includes(x.exerciseId) || !['none', ...active.map(t => t.id)].includes(x.trackerId)) return null
  const src: Src = { text, source: 'ai' }
  if (x.otherDay) return { ...src, kind: 'other-day' }
  if (x.kind === 'none') return { ...src, kind: 'unknown' }
  if (x.kind === 'gym') {
    if (x.exerciseId === 'none') return null
    const draft = fromAI({ exerciseId: x.exerciseId, weight: x.weight, unit: x.weightUnit, reps: x.reps, sets: x.sets }, ctx.exercises, ctx.unit)
    return draft ? { kind: 'gym', text, source: 'ai', draft } : null
  }
  // foods ausente = [] (tolerante); presente pero inválido → null (manda el parser)
  const foods = x.foods === undefined ? [] : foodItemsFromAI(x.foods, ctx.foods ?? [])
  if (foods === null) return null
  if (x.kind === 'food') return foods.length ? { ...src, kind: 'food', items: foods, rest: '' } : { ...src, kind: 'unknown' }
  const ms: Measure[] = x.amount === null ? [] : [{ value: x.amount, family: x.amountUnit === 'none' ? null : x.amountUnit, word: normalizeText(x.unitWord) }]
  if (x.kind === 'tracker') {
    const t = active.find(a => a.id === x.trackerId)
    return t ? { ...src, kind: 'tracker', trackerId: t.id, ...resolveAmount(t, ms), ...(foods.length ? { food: foods } : {}) } : null
  }
  const name = trackerName(x.name.trim().replace(/\s+/g, ' '))
  if (!isValidName(name) || (x.type === 'custom' && !isValidUnit(x.customUnit))) return null
  return buildNew({ name, type: x.type, unit: x.type === 'custom' ? x.customUnit.trim() : undefined, ms, src, ctx, branch: x.branch, confidence: x.confidence, reason: x.reason.trim().slice(0, 120) })
}

// Combina la IA y el parser. Si la IA respondió bien, decide ella (también «none» = no entendido): el parser solo cubre
// sin clave, sin conexión o con respuesta inválida (ai null). Excepciones: otro día gana siempre; dos gym → pickDraft;
// mismo hábito con la cantidad de la IA incompleta y la del parser lista → el parser.
export function pickCapture(ai: CaptureCommand | null, parsed: CaptureCommand, ctx: CaptureCtx): CaptureCommand {
  if (ai?.kind === 'other-day') return ai
  if (parsed.kind === 'other-day') return parsed
  if (!ai) return parsed
  // ponytail: Haiku ya conoce la comida (kind «food»), pero si el parser casó un alimento del catálogo o propio (no solo un «pendiente» sin nombre) y la IA
  // ve un hábito nuevo o nada, manda el parser: un «new» con confianza alta se crearía solo como hábito («arroz»). Se retira cuando haya datos de uso real que no lo pidan.
  if (parsed.kind === 'food' && (ai.kind === 'new' || ai.kind === 'unknown') && parsed.items.some(i => i.k !== 'pending')) return parsed
  // comida de las dos: la IA, salvo que el parser tenga más ítems listos (su cantidad es exacta)
  if (ai.kind === 'food' && parsed.kind === 'food') return parsed.items.filter(itemReady).length > ai.items.filter(itemReady).length ? parsed : ai
  if (ai.kind === 'gym' && parsed.kind === 'gym') {
    const { draft, source } = pickDraft(ai.draft, parsed.draft, ctx.exercises)
    return { kind: 'gym', text: ai.text, draft, source }
  }
  const sameHabit = ai.kind === 'tracker' && parsed.kind === 'tracker' && ai.trackerId === parsed.trackerId
  return sameHabit && !isReady(ai, ctx) && isReady(parsed, ctx) ? parsed : ai
}

// Comida del día elegido (Comida → «Dictar»): solo entiende comida. Otro día → no guarda (A7); sin nada reconocible → unknown.
// Es el respaldo determinista de `interpretFood` (haiku.ts, con Haiku y memoria); no pasa por hábitos ni gym.
export function localFood(text: string, own: Food[]): Extract<CaptureCommand, { kind: 'food' | 'other-day' | 'unknown' }> {
  const src: Src = { text, source: 'parser' }
  if (isOtherDay(captureNorm(text))) return { ...src, kind: 'other-day' }
  const p = parseFoodVoice(text, own, { anyFood: true })
  return p.items.length ? { ...src, kind: 'food', ...p } : { ...src, kind: 'unknown' }
}
