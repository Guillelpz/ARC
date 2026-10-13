import type { Exercise, GymSet, WeightUnit } from './types'
import { normalizeText } from './classify'
import { MAX_WEIGHT, fmtSet } from './gym'

// Borrador de una anotación de series. null = no se ha entendido ese dato.
export type GymDraft = {
  exerciseId: string | null
  weight: number | null   // en `unit`; peso corporal: lastre (0 = sin lastre)
  unit: WeightUnit        // la dicha o la preferencia por defecto
  reps: number | null     // entero 1..999
  sets: number            // series iguales; válido 1..MAX_VOICE_SETS (fuera de rango → incompleto)
}
// (HaikuError se define aquí y `haiku.ts` lo reexporta: así `voice.ts` no importa de `haiku.ts`, que sí importa de este módulo.)
export type HaikuError = 'auth' | 'rate' | 'bad-request' | 'http' | 'network' | 'timeout' | 'refusal' | 'invalid'
export type VoiceCommand = { kind: 'gym'; text: string; draft: GymDraft; source: 'ai' | 'parser' | 'memory'; aiError?: HaikuError }

export const MAX_VOICE_SETS = 10
export const VOICE_MAX_CHARS = 200

// Alias por ejercicio, ya normalizados (sin tildes). El nombre del catálogo se añade siempre.
// ponytail: coincidencia exacta por palabras, sin erratas ni plurales automáticos. Si el reconocimiento da variantes, se añaden aquí.
// Si hay falsos positivos, se ajusta la tabla. «curl» solo no es alias (ambiguo): queda «sin reconocer».
export const ALIASES: Record<string, string[]> = {
  'bench-press': ['press banca', 'press de banca', 'banca', 'bench press', 'bench'],
  'incline-db-press': ['press inclinado', 'press inclinado con mancuernas', 'inclinado con mancuernas', 'incline press', 'incline dumbbell press', 'incline bench'],
  'dips': ['fondos', 'fondos en paralelas', 'dips', 'dip'],
  'pull-up': ['dominadas', 'dominada', 'pull ups', 'pull up', 'pullups', 'pullup', 'chin ups', 'chin up'],
  'barbell-row': ['remo con barra', 'remo', 'barbell row', 'bent over row', 'row'],
  'lat-pulldown': ['jalon al pecho', 'jalon', 'polea al pecho', 'lat pulldown', 'pulldown', 'pull down'],
  'deadlift': ['peso muerto', 'deadlift', 'dead lift'],
  'squat': ['sentadilla', 'sentadillas', 'squat', 'squats', 'back squat'],
  'leg-press': ['prensa', 'prensa de piernas', 'leg press'],
  'lunge': ['zancadas', 'zancada', 'lunges', 'lunge'],
  'romanian-deadlift': ['peso muerto rumano', 'rumano', 'romanian deadlift', 'rdl'],
  'leg-curl': ['curl femoral', 'femoral', 'femorales', 'leg curl', 'hamstring curl'],
  'calf-raise': ['elevacion de gemelos', 'elevaciones de gemelos', 'gemelos', 'calf raise', 'calf raises', 'calves'],
  'overhead-press': ['press militar', 'militar', 'press de hombro', 'press de hombros', 'overhead press', 'ohp', 'military press', 'shoulder press'],
  'lateral-raise': ['elevaciones laterales', 'elevacion lateral', 'laterales', 'lateral raise', 'lateral raises', 'side raise'],
  'face-pull': ['tiron a la cara', 'face pull', 'face pulls', 'facepull'],
  'barbell-curl': ['curl de biceps con barra', 'curl de biceps', 'curl biceps', 'curl con barra', 'biceps', 'bicep curl', 'biceps curl', 'barbell curl'],
  'hammer-curl': ['curl martillo', 'martillo', 'hammer curl', 'hammer curls', 'hammer'],
  'triceps-pushdown': ['extension de triceps en polea', 'extension de triceps', 'triceps en polea', 'triceps polea', 'triceps', 'triceps pushdown', 'tricep pushdown', 'pushdown'],
  'skull-crusher': ['press frances', 'frances', 'skull crusher', 'skull crushers', 'skullcrusher'],
  'leg-raise': ['elevaciones de piernas', 'elevacion de piernas', 'elevaciones de pierna', 'leg raise', 'leg raises', 'hanging leg raise'],
}

const m = (o: Record<string, number>) => new Map(Object.entries(o))
const UNITS_ES = m({ un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 })
const UNITS_EN = m({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 })
const UNITS = new Map([...UNITS_ES, ...UNITS_EN])
const SMALL = new Map([...UNITS, ...m({
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
})])
const TENS_EN = m({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 })
const TENS = new Map([...TENS_EN, ...m({ veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 })])
const HUND = m({ cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900 })
// Palabras-número que no se saben convertir: la frase queda incompleta (no se guarda un número inventado).
const UNRESOLVED = /\b(mil|millon|millones|thousand|million|cero|zero|medio|media|half|docena|dozen|docenas|dozens)\b/

// Un número en palabra desde la posición i: «treinta y cinco», «veinticinco», «thirty five», «ciento veinte», «one hundred twenty».
function wordNumber(tk: string[], i: number): { v: number; next: number } | null {
  let j = i, v = 0
  const w = tk[j]
  if (HUND.has(w)) { v = HUND.get(w)!; j++ }
  else if (UNITS.has(w) && tk[j + 1] === 'hundred') { v = UNITS.get(w)! * 100; j += 2 }
  else if (w === 'hundred') { v = 100; j++ }
  const x = tk[j]
  if (TENS.has(x)) {
    v += TENS.get(x)!; j++
    if (tk[j] === 'y' && UNITS.has(tk[j + 1])) { v += UNITS.get(tk[j + 1])!; j += 2 }
    else if (UNITS.has(tk[j])) { v += UNITS.get(tk[j])!; j++ } // «ochenta cinco» = 85, como «thirty five»
  } else if (SMALL.has(x)) { v += SMALL.get(x)!; j++ }
  return j > i ? { v, next: j } : null
}

// Paso 0 del parser: minúsculas sin tildes, recortada, decimales con punto, signos fuera y números en palabra → dígitos.
export function normalizeVoice(text: string): string {
  let t = normalizeText(text).slice(0, VOICE_MAX_CHARS)
  t = t.replace(/(\d),(\d)/g, '$1.$2')
  t = t.replace(/×/g, ' x ')
  t = t.replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2')
  t = t.replace(/[^a-z0-9. ]/g, ' ')
  t = t.replace(/(?<!\d)\.|\.(?!\d)/g, ' ') // un punto solo vale entre dígitos
  t = t.replace(/\s+/g, ' ').trim()
  const tk = t.split(' '), out: string[] = []
  for (let i = 0; i < tk.length;) {
    const n = wordNumber(tk, i)
    if (n) { out.push(String(n.v)); i = n.next } else out.push(tk[i++])
  }
  return out.join(' ')
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const aliasRe = (a: string) => new RegExp(`(^| )${esc(a)}( |$)`)

// Alias de un ejercicio: su nombre normalizado más ALIASES (los propios solo tienen el nombre).
function aliasesOf(e: Exercise): string[] {
  const list = [normalizeVoice(e.name), ...(e.id.startsWith('custom-') ? [] : (ALIASES[e.id] ?? []).map(normalizeVoice))]
  return [...new Set(list.filter(a => a !== ''))]
}

// Gana el alias más largo; si empatan, el ejercicio propio y después el orden de la lista. `alias` es el tramo a borrar del texto.
export function matchExercise(norm: string, exercises: Exercise[]): { id: string; alias: string } | null {
  let best: { id: string; alias: string; own: boolean } | null = null
  for (const e of exercises) {
    const own = e.id.startsWith('custom-')
    for (const a of aliasesOf(e)) {
      if (!aliasRe(a).test(norm)) continue
      if (!best || a.length > best.alias.length || (a.length === best.alias.length && own && !best.own)) best = { id: e.id, alias: a, own }
    }
  }
  return best && { id: best.id, alias: best.alias }
}

const N = String.raw`(\d+(?:\.\d+)?)`
const NOT_NUM = String.raw`(?<![\d.])`, NOT_NUM_AFTER = String.raw`(?![\d.])`
const KG = 'kg|kgs|kilo|kilos|kilogramo|kilogramos', LBS = 'lb|lbs|libra|libras|pound|pounds'
const REPS = 'rep|reps|repeticion|repeticiones|repetition|repetitions|veces|times', SETS = 'series|serie|sets|set'
const RE_A = new RegExp(`${NOT_NUM}${N} (?:${SETS}) (?:de|of) ${N}${NOT_NUM_AFTER}`)
const RE_B = new RegExp(`${NOT_NUM}${N} (${KG}|${LBS})\\b`, 'g')
const RE_C = new RegExp(`${NOT_NUM}${N} (?:x|por|by) ${N}(?: (?:${REPS})\\b)?${NOT_NUM_AFTER}`)
const RE_D = new RegExp(`${NOT_NUM}${N} (?:${REPS})\\b`, 'g')
const RE_E = new RegExp(`${NOT_NUM}${N} (?:${SETS})\\b`, 'g')
const RE_NUM = new RegExp(`${NOT_NUM}\\d+(?:\\.\\d+)?${NOT_NUM_AFTER}`, 'g')
const r2 = (x: number) => Math.round(x * 100) / 100

// Texto dictado → borrador. `exercises` son las activas; `defaultUnit` es la preferencia del gym (kg por defecto).
export function parseGym(text: string, exercises: Exercise[], defaultUnit: WeightUnit, forceId?: string): GymDraft {
  let t = normalizeVoice(text)
  const m = forceId ? { id: forceId, alias: '' } : matchExercise(t, exercises)
  if (m && m.alias !== '') t = t.replace(aliasRe(m.alias), ' ') // el 45 de «Press 45 grados» no cuenta
  const unresolved = UNRESOLVED.test(t)
  const ex = m ? exercises.find(e => e.id === m.id) : undefined
  const body = ex?.kind === 'bodyweight'
  let sets: number | null = null, reps: number | null = null, weight: number | null = null, unit: WeightUnit | null = null

  // a — «3 series de 5»
  const a = RE_A.exec(t)
  if (a) { sets = Number(a[1]); reps = Number(a[2]); t = t.replace(RE_A, ' ') }
  // b — peso con unidad (solo el primero; los siguientes se ignoran)
  for (const x of t.matchAll(RE_B)) if (weight === null) { weight = Number(x[1]); unit = new RegExp(`^(?:${LBS})$`).test(x[2]) ? 'lbs' : 'kg' }
  t = t.replace(RE_B, ' ')
  // c — «A x B»
  const c = RE_C.exec(t)
  if (c) {
    const A = Number(c[1]), B = Number(c[2])
    const others = (t.replace(RE_C, ' ').match(RE_NUM) ?? []).length
    if (sets === null && reps === null) {
      if (weight !== null || others > 0 || body) { sets = A; reps = B }
      else if (A > B || !Number.isInteger(A)) { weight = A; reps = B }
      else { sets = A; reps = B }
    }
    t = t.replace(RE_C, ' ')
  }
  // d — «N repeticiones»; e — «N series»
  for (const x of t.matchAll(RE_D)) if (reps === null) reps = Number(x[1])
  t = t.replace(RE_D, ' ')
  for (const x of t.matchAll(RE_E)) if (sets === null) sets = Number(x[1])
  t = t.replace(RE_E, ' ')
  // f — números sueltos, en orden
  const rest = (t.match(RE_NUM) ?? []).map(Number)
  if (weight !== null && reps === null) reps = rest.find(Number.isInteger) ?? null
  else if (reps !== null && weight === null) { if (rest.length) weight = Math.max(...rest) }
  else if (weight === null && reps === null) {
    if (rest.length >= 2) {
      const wi = rest.indexOf(Math.max(...rest))
      weight = rest[wi]; reps = rest.find((_, i) => i !== wi) ?? null
    } else if (rest.length === 1) { if (body) reps = rest[0]; else weight = rest[0] }
  }

  // paso 3 — validar y completar
  const said = weight !== null
  if (weight !== null && (weight < 0 || weight > MAX_WEIGHT)) weight = null
  if (weight !== null && !body && weight === 0) weight = null
  if (weight !== null) weight = r2(weight)
  if (reps !== null && !(Number.isInteger(reps) && reps >= 1 && reps <= 999)) reps = null
  if (body && weight === null && !said) weight = 0 // «no dicho» = sin lastre; «dicho pero fuera de rango» queda null (incompleto)
  if (unresolved) { weight = null; reps = null } // palabra-número sin resolver («mil»…): incompleto, no se guarda un dato inventado
  return { exerciseId: m?.id ?? null, weight, unit: unit ?? defaultUnit, reps, sets: sets ?? 1 }
}

export function isComplete(d: GymDraft, exercises: Exercise[]): boolean {
  const e = exercises.find(x => x.id === d.exerciseId)
  return !!e && d.reps !== null && Number.isInteger(d.sets) && d.sets >= 1 && d.sets <= MAX_VOICE_SETS &&
    d.weight !== null && (e.kind === 'bodyweight' || d.weight > 0)
}

// «Press banca · 80 kg × 5»; con varias series: «Press banca · 3 series · 80 kg × 5»
export function draftText(d: GymDraft, exercises: Exercise[], pref: WeightUnit): string {
  const e = exercises.find(x => x.id === d.exerciseId)
  if (!e) return 'Ejercicio sin reconocer'
  const s = fmtSet({ weight: d.weight ?? 0, unit: d.unit, reps: d.reps ?? 0 } as GymSet, pref, e.kind)
  return d.sets > 1 ? `${e.name} · ${d.sets} series · ${s}` : `${e.name} · ${s}`
}

// Respuesta de Haiku (ya parseada) → borrador, o null si no es válida. Los campos sueltos incorrectos pasan a null.
export function fromAI(o: unknown, exercises: Exercise[], defaultUnit: WeightUnit): GymDraft | null {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return null
  const x = o as Record<string, unknown>
  if (typeof x.exerciseId !== 'string' || (x.exerciseId !== 'none' && !exercises.some(e => e.id === x.exerciseId))) return null
  if (x.unit !== 'kg' && x.unit !== 'lbs' && x.unit !== 'none') return null
  if (typeof x.sets !== 'number' || !Number.isInteger(x.sets) || x.sets < 1 || x.sets > MAX_VOICE_SETS) return null
  const e = exercises.find(y => y.id === x.exerciseId)
  let weight = typeof x.weight === 'number' && Number.isFinite(x.weight) && x.weight >= 0 && x.weight <= MAX_WEIGHT ? r2(x.weight) : null
  const reps = typeof x.reps === 'number' && Number.isInteger(x.reps) && x.reps >= 1 && x.reps <= 999 ? x.reps : null
  if (e?.kind === 'bodyweight' && weight === null && x.weight === null) weight = 0 // null = no dicho; un número inválido queda null (incompleto)
  if (e && e.kind === 'load' && weight === 0) weight = null
  return { exerciseId: e?.id ?? null, weight, unit: x.unit === 'none' ? defaultUnit : x.unit, reps, sets: x.sets }
}

// Gana la IA si está completa; si no, el parser si está completo; si no, el borrador más rico (IA o parser).
export function pickDraft(ai: GymDraft | null, parsed: GymDraft, exercises: Exercise[]): { draft: GymDraft; source: 'ai' | 'parser' } {
  if (ai && isComplete(ai, exercises)) return { draft: ai, source: 'ai' }
  if (isComplete(parsed, exercises)) return { draft: parsed, source: 'parser' }
  return ai ? { draft: ai, source: 'ai' } : { draft: parsed, source: 'parser' }
}
