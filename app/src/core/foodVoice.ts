import type { Food, Portion } from './types'
import { STOPWORDS, normalizeText } from './classify'
import { normalizeVoice } from './voice'
import { CATALOG } from './foodCatalog'
import { fmtKcal, fmtPortion, fold, foodById, portion as nutrients } from './food'
import { GENERIC_SERVING, SERVING_WORDS, VOICE_ALIASES } from './foodAliases'

export const MAX_FOOD_ITEMS = 8
// g/ml ya convertidos (kg ×1000, l ×1000, cl ×10); serving = nº de raciones; null = número sin unidad
export type FoodQty = { n: number; unit: 'g' | 'ml' | 'serving' | null; word: string }
export type FoodProblem = 'missing' | 'range' | 'unit' | 'guess'
export type FoodItem =
  | { k: 'food'; said: string; foodId: string; qty: FoodQty | null; portion: Portion | null; problem: FoodProblem | null }
  | { k: 'quick'; said: string; kcal: number; name: string }
  | { k: 'pending'; said: string; query: string; ids: string[]; qty: FoodQty | null } // ids ≥ 2 ambiguo; [] desconocido
export type FoodParse = { items: FoodItem[]; rest: string } // rest = palabras de contenido sin reconocer ('' si ninguna)
export type VoiceAdd = { food: Food; portion: Portion } | { quick: { kcal: number; name: string } }

type FoodUnit = { kind: 'g' | 'ml' | 'kcal'; mul: number }
const unitsOf = (words: string, u: FoodUnit): [string, FoodUnit][] => words.split(' ').map(w => [w, u])
export const FOOD_UNITS: ReadonlyMap<string, FoodUnit> = new Map([
  ...unitsOf('g gr gramo gramos gram grams', { kind: 'g', mul: 1 }),
  ...unitsOf('kg kgs kilo kilos kilogramo kilogramos kilogram kilograms', { kind: 'g', mul: 1000 }),
  ...unitsOf('ml mililitro mililitros milliliter milliliters millilitre millilitres', { kind: 'ml', mul: 1 }),
  ...unitsOf('cl centilitro centilitros', { kind: 'ml', mul: 10 }),
  ...unitsOf('l litro litros liter liters litre litres', { kind: 'ml', mul: 1000 }),
  ...unitsOf('kcal kcals caloria calorias calorie calories', { kind: 'kcal', mul: 1 }),
])
export const FOOD_UNIT_SET: ReadonlySet<string> = new Set(FOOD_UNITS.keys())

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)
const isUnitWord = (w: string) => FOOD_UNITS.has(w) || has(SERVING_WORDS, w) || GENERIC_SERVING.has(w)
const FOOD_FILLER: ReadonlySet<string> = new Set('desayune desayunado cene cenado almorce almorzado merende merendado comido tomado bebido breakfast lunch dinner snack had for plato'.split(' '))
const NUM_RE = /^\d+(?:\.\d+)?$/
const r1 = (x: number) => Math.round(x * 10 + 1e-9) / 10

// Normaliza frases y términos igual: números en palabra, mitades, docenas y cuartos; «,» y «;» separan como «y».
export function foodNorm(text: string): string {
  let t = normalizeText(text).replace(/(\d),(\d)/g, '$1.$2').replace(/[,;]/g, ' y ')
  t = normalizeVoice(t)
  t = t.replace(/(\d+(?:\.\d+)?)((?: [a-z]+)?) (?:y|and) (?:medio|media|a half)\b/g, (_m, n: string, u: string) => `${Number(n) + 0.5}${u}`)
  t = t.replace(/\bmedia docena\b/g, '6').replace(/\b(?:1 docena|docena|a dozen)\b/g, '12')
  t = t.replace(/\b(?:1 cuarto|a quarter)(?: (?:de|of))?\b/g, '0.25')
  t = t.replace(/\b(?:medio|media|half(?: an?)?)\b/g, '0.5')
  return t.replace(/\s+/g, ' ').trim()
}

const isPlural = (s: string, p: string) => s.length >= 3 && (p === s + 's' || p === s + 'es' || (s.endsWith('z') && p === s.slice(0, -1) + 'ces') || (s.endsWith('y') && p === s.slice(0, -1) + 'ies'))
const wordEq = (a: string, b: string) => a === b || isPlural(a, b) || isPlural(b, a)
// Iguales o uno plural del otro, palabra a palabra. ponytail: reglas regulares; sin irregulares ni erratas.
export function pluralEq(a: string, b: string): boolean {
  const x = a.split(' '), y = b.split(' ')
  return x.length === y.length && x.every((w, i) => wordEq(w, y[i]))
}

export type Term = { words: string[]; ids: string[]; own: boolean }
const NO_OWN: Food[] = []
const termCache = new WeakMap<Food[], Term[]>()
// Propios activos primero (gana un propio sobre el catálogo con el mismo término), después catálogo + alias de voz. Más largos antes.
export function foodTerms(own: Food[] = NO_OWN): Term[] {
  const hit = termCache.get(own)
  if (hit) return hit
  const ownMap = new Map<string, Set<string>>(), catMap = new Map<string, Set<string>>()
  const add = (m: Map<string, Set<string>>, name: string, id: string) => {
    const k = foodNorm(name)
    if (k) m.set(k, (m.get(k) ?? new Set()).add(id))
  }
  for (const f of own) if (!f.archived) for (const n of [f.name, ...(f.aliases ?? [])]) add(ownMap, n, f.id)
  for (const f of CATALOG) for (const n of [f.name, ...(f.aliases ?? []), ...(VOICE_ALIASES[f.id] ?? [])]) add(catMap, n, f.id)
  const terms: Term[] = [
    ...[...ownMap].map(([k, ids]) => ({ words: k.split(' '), ids: [...ids], own: true })),
    ...[...catMap].filter(([k]) => !ownMap.has(k)).map(([k, ids]) => ({ words: k.split(' '), ids: [...ids], own: false })),
  ]
  terms.sort((a, b) => b.words.length - a.words.length)
  termCache.set(own, terms)
  return terms
}

export type Hit = { s: number; e: number; ids: string[] }
// De izquierda a derecha, el término más largo que encaje, sin solapes. Mismo largo: si alguno es propio, solo los propios.
export function findFoods(tokens: string[], terms: Term[]): Hit[] {
  const out: Hit[] = []
  for (let i = 0; i < tokens.length;) {
    let len = 0
    let matched: Term[] = []
    for (const t of terms) {
      if (len && t.words.length < len) break
      if (i + t.words.length > tokens.length || !t.words.every((w, j) => wordEq(w, tokens[i + j]))) continue
      len = t.words.length
      matched.push(t)
    }
    if (!len) { i++; continue }
    if (matched.some(t => t.own)) matched = matched.filter(t => t.own)
    out.push({ s: i, e: i + len, ids: [...new Set(matched.flatMap(t => t.ids))] })
    i += len
  }
  return out
}

const rangeOk = (q: number) => q > 0 && q <= 2000
const byServing = (s: { name: string; qty: number }, n: number): { portion: Portion | null; problem: 'range' | null } => {
  const nn = Math.round(n * 4) / 4
  return nn >= 0.25 && nn <= 50 && nn * s.qty <= 2000 ? { portion: { qty: r1(nn * s.qty), serving: { name: s.name, n: nn } }, problem: null } : { portion: null, problem: 'range' }
}
// Cantidad dicha → ración del alimento, o el problema (FV6: sin cantidad = 1 ración de la primera).
export function portionFor(food: Food, q: FoodQty | null): { portion: Portion | null; problem: FoodProblem | null } {
  const sv = food.servings ?? []
  if (!q) return sv.length ? { portion: { qty: sv[0].qty, serving: { name: sv[0].name, n: 1 } }, problem: null } : { portion: null, problem: 'missing' }
  if (q.unit === 'g' || q.unit === 'ml') {
    // ponytail: g y ml se toman 1:1 si la base del alimento es la otra (como el catálogo con los líquidos)
    const qty = r1(q.n)
    return rangeOk(qty) ? { portion: { qty }, problem: null } : { portion: null, problem: 'range' }
  }
  if (q.unit === 'serving') {
    const target = has(SERVING_WORDS, q.word) ? SERVING_WORDS[q.word] : null
    const s = target ? sv.find(x => fold(x.name).split(' ')[0] === target) : GENERIC_SERVING.has(q.word) ? sv[0] : undefined
    return s ? byServing(s, q.n) : { portion: null, problem: 'unit' }
  }
  if (sv.length) return byServing(sv[0], q.n)
  // ponytail: un número suelto en un alimento sin raciones vale como g/ml desde 10 («arroz 200»); menos pide la cantidad
  if (q.n >= 10) { const qty = r1(q.n); return rangeOk(qty) ? { portion: { qty }, problem: null } : { portion: null, problem: 'range' } }
  return { portion: null, problem: 'missing' }
}

type Meas = { s: number; e: number; n: number; word: string }
const toQty = (m: Meas): FoodQty | null => {
  if (m.word === '') return { n: m.n, unit: null, word: '' }
  const u = FOOD_UNITS.get(m.word)
  if (u) return u.kind === 'kcal' ? null : { n: m.n * u.mul, unit: u.kind, word: m.word }
  return { n: m.n, unit: 'serving', word: m.word }
}
const isKcal = (m: Meas) => FOOD_UNITS.get(m.word)?.kind === 'kcal'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ADJ = new Set(['de', 'of', 'del'])

export type FoodOpts = { anyFood?: boolean; forceId?: string }
// Frase → alimentos. Sin `anyFood` solo cuenta lo que casa con un término o con «N kcal»; con `anyFood` un tramo sin término es «pendiente».
export function parseFoodVoice(text: string, own: Food[] = NO_OWN, opts: FoodOpts = {}): FoodParse {
  const norm = foodNorm(text)
  if (!norm) return { items: [], rest: '' }
  const tokens = norm.split(' ')
  // palabra normalizada → como se dijo (con tildes), solo para mostrar
  const shown = new Map<string, string>()
  for (const w of text.split(/[\s,;.:!?¿¡"«»()]+/)) if (w) shown.set(normalizeText(w), w.toLowerCase())
  const show = (ws: string[]) => ws.map(w => shown.get(w) ?? w).join(' ')

  const measuresIn = (a: number, b: number, covered: number[], hits: Hit[]): Meas[] => {
    const out: Meas[] = []
    for (let i = a; i < b;) {
      const t = tokens[i], nx = tokens[i + 1]
      if (covered[i] >= 0) { i++; continue }
      if (NUM_RE.test(t)) {
        if (i + 1 < b && covered[i + 1] < 0 && isUnitWord(nx)) { out.push({ s: i, e: i + 2, n: Number(t), word: nx }); i += 2 } else { out.push({ s: i, e: i + 1, n: Number(t), word: '' }); i++ }
        continue
      }
      if ((t === 'a' || t === 'an') && i + 1 < b) {
        if (covered[i + 1] >= 0 && hits[covered[i + 1]].s === i + 1) { out.push({ s: i, e: i + 1, n: 1, word: '' }); i++; continue }
        if (covered[i + 1] < 0 && isUnitWord(nx)) { out.push({ s: i, e: i + 2, n: 1, word: nx }); i += 2; continue }
      }
      i++
    }
    return out
  }

  if (opts.forceId) {
    const f = foodById(opts.forceId, own)
    if (!f) return { items: [], rest: '' }
    const m = measuresIn(0, tokens.length, tokens.map(() => -1), []).find(x => !isKcal(x))
    const q = m ? toQty(m) : null
    return { items: [{ k: 'food', said: norm, foodId: f.id, qty: q, ...portionFor(f, q) }], rest: '' }
  }

  const hits = findFoods(tokens, foodTerms(own))
  const covered = tokens.map(() => -1)
  hits.forEach((h, k) => { for (let j = h.s; j < h.e; j++) covered[j] = k })
  const segs: [number, number][] = []
  let from = 0
  tokens.forEach((t, i) => { if ((t === 'y' || t === 'and') && covered[i] < 0) { segs.push([from, i]); from = i + 1 } })
  segs.push([from, tokens.length])

  const items: FoodItem[] = [], rest: string[] = []
  for (const [a, b] of segs) {
    if (a >= b) continue
    const said = show(tokens.slice(a, b))
    const ms = measuresIn(a, b, covered, hits)
    const inMeas = new Set(ms.flatMap(m => Array.from({ length: m.e - m.s }, (_, j) => m.s + j)))
    const segHits = hits.filter(h => h.s >= a && h.e <= b)
    const content = tokens.map((w, i) => ({ w, i })).slice(a, b).filter(({ w, i }) => covered[i] < 0 && !inMeas.has(i) &&
      w.length >= 3 && !NUM_RE.test(w) && !STOPWORDS.has(w) && !isUnitWord(w) && !FOOD_FILLER.has(w)).map(x => x.w)
    const kc = ms.find(m => isKcal(m) && Math.round(m.n) >= 1 && Math.round(m.n) <= 10000)
    if (kc) {
      const h0 = segHits[0]
      const name = h0 ? (h0.ids.length === 1 ? foodById(h0.ids[0], own)!.name : cap(show(tokens.slice(h0.s, h0.e)))) : content.length ? cap(show(content)).slice(0, 60) : 'Añadido rápido'
      items.push({ k: 'quick', said, kcal: Math.round(kc.n), name })
      continue
    }
    // medida → término que la sigue (con «de»/«of» como mucho entre medias); si no, el anterior sin medida
    const meas = new Map<Hit, Meas>()
    for (const m of ms.filter(x => !isKcal(x))) {
      const next = segHits.find(h => h.s >= m.e)
      const gap = next ? tokens.slice(m.e, next.s) : null
      if (next && gap && (gap.length === 0 || (gap.length === 1 && ADJ.has(gap[0]))) && !meas.has(next)) { meas.set(next, m); continue }
      const prev = [...segHits].reverse().find(h => h.e <= m.s && !meas.has(h))
      if (prev) meas.set(prev, m)
    }
    const withM = segHits.filter(h => meas.has(h))
    const chosen = withM.length ? withM : segHits.slice(0, 1)
    for (const h of chosen) {
      const m = meas.get(h), q = m ? toQty(m) : null
      if (h.ids.length === 1) items.push({ k: 'food', said, foodId: h.ids[0], qty: q, ...portionFor(foodById(h.ids[0], own)!, q) })
      else items.push({ k: 'pending', said, query: show(tokens.slice(h.s, h.e)), ids: h.ids, qty: q })
    }
    for (const h of segHits) if (!chosen.includes(h)) rest.push(show(tokens.slice(h.s, h.e)))
    if (!segHits.length && opts.anyFood && content.length) {
      const m = ms.find(x => !isKcal(x))
      items.push({ k: 'pending', said, query: show(content), ids: [], qty: m ? toQty(m) : null })
    } else if (content.length) rest.push(show(content))
  }
  return { items: items.slice(0, MAX_FOOD_ITEMS), rest: rest.join(' ') }
}

export const itemReady = (i: FoodItem): boolean => i.k === 'quick' || (i.k === 'food' && i.portion !== null && i.problem === null)
export const foodReady = (items: FoodItem[]): boolean => items.length > 0 && items.every(itemReady)

const EAT_RE = /\b(?:comi|comido|desayune|desayunado|cene|cenado|almorce|almorzado|merende|merendado|ate|eaten|eat|breakfast|lunch|dinner)\b/
const MEASURE_RE = /\d(?: (?:g|gr|gramos?|grams?|ml|cl|l|mililitros?|litros?|liters?|litres?|milliliters?|millilitres?))\b/
// Verbo de comer o medida g/ml/cl/l (kg no: es de Gym). Los de beber no cuentan («3 vasos de agua»).
export const looksLikeFood = (norm: string): boolean => EAT_RE.test(norm) || MEASURE_RE.test(norm)

// Alimentos ya listos o confirmados → lo que se guarda. Lo que no tiene ración se ignora.
export function voiceAdds(items: FoodItem[], own: Food[]): VoiceAdd[] {
  return items.flatMap((i): VoiceAdd[] => {
    if (i.k === 'quick') return [{ quick: { kcal: i.kcal, name: i.name } }]
    if (i.k !== 'food' || !i.portion || (i.problem !== null && i.problem !== 'guess')) return []
    const food = foodById(i.foodId, own)
    return food ? [{ food, portion: i.portion }] : []
  })
}

// «Arroz blanco cocido · 200 g · 260 kcal»
export function itemText(i: FoodItem, own: Food[]): string {
  if (i.k === 'quick') return `${i.name} · ${fmtKcal(i.kcal)} kcal`
  if (i.k === 'pending') return i.query
  const f = foodById(i.foodId, own)
  if (!f) return i.said
  if (!i.portion) return f.name
  return [f.name, fmtPortion(i.portion, f.base), `${fmtKcal(nutrients(f, i.portion.qty).kcal)} kcal`].join(' · ')
}

// Kcal de un ítem listo (0 si no tiene ración)
export function itemKcal(i: FoodItem, own: Food[]): number {
  if (i.k === 'quick') return i.kcal
  if (i.k !== 'food' || !i.portion) return 0
  const f = foodById(i.foodId, own)
  return f ? nutrients(f, i.portion.qty).kcal : 0
}

// Lo que falta de un ítem no listo, para la tarjeta de la captura y la lista «Por voz: pendiente» de Comida
export function pendingText(i: FoodItem, own: Food[]): string {
  if (i.k === 'pending') return i.ids.length >= 2 ? `«${i.query}»: hay varios alimentos` : `«${i.query}»: no está en tus alimentos`
  if (i.k === 'food' && !itemReady(i)) {
    const name = foodById(i.foodId, own)?.name ?? i.said
    return `${name} · ${i.problem === 'range' ? 'cantidad fuera de rango' : i.problem === 'unit' ? 'no sé esa medida' : 'falta la cantidad'}`
  }
  return itemText(i, own)
}
