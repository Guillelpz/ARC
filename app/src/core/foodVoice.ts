import type { Food, FoodEntry, Portion } from './types'
import { STOPWORDS, normalizeText } from './classify'
import { normalizeVoice } from './voice'
import { CATALOG } from './foodCatalog'
import { fmtKcal, fmtPortion, fold, foodById, portion as nutrients } from './food'
import { trimName } from './off'
import { GENERIC_SERVING, SERVING_WORDS, VOICE_ALIASES } from './foodAliases'

export const MAX_FOOD_ITEMS = 8
// g/ml ya convertidos (kg ×1000, l ×1000, cl ×10); serving = nº de raciones; null = número sin unidad
export type FoodQty = { n: number; unit: 'g' | 'ml' | 'serving' | null; word: string }
export type FoodProblem = 'missing' | 'range' | 'unit' | 'guess'
export type FoodItem =
  | { k: 'food'; said: string; foodId: string; qty: FoodQty | null; portion: Portion | null; problem: FoodProblem | null }
  | { k: 'quick'; said: string; kcal: number; name: string }
  | { k: 'estimate'; said: string; draft: Omit<Food, 'id'>; portion: Portion } // solo Haiku (FV3); nunca está listo: se guarda al confirmar
  | { k: 'pending'; said: string; query: string; ids: string[]; qty: FoodQty | null } // ids ≥ 2 ambiguo; [] desconocido
export type FoodParse = { items: FoodItem[]; rest: string } // rest = palabras de contenido sin reconocer ('' si ninguna)
export type VoiceAdd = { food: Food; portion: Portion } | { quick: { kcal: number; name: string } } | { estimate: Omit<Food, 'id'>; portion: Portion; own: boolean }

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
// Una estimación solo entra con `ownFlags` (la confirmación del usuario; `ownFlags[k]` = guardarla también como alimento propio): nunca se guarda sola.
export function voiceAdds(items: FoodItem[], own: Food[], ownFlags?: boolean[]): VoiceAdd[] {
  return items.flatMap((i, k): VoiceAdd[] => {
    if (i.k === 'quick') return [{ quick: { kcal: i.kcal, name: i.name } }]
    if (i.k === 'estimate') return ownFlags ? [{ estimate: i.draft, portion: i.portion, own: ownFlags[k] === true }] : []
    if (i.k !== 'food' || !i.portion || (i.problem !== null && i.problem !== 'guess')) return []
    const food = foodById(i.foodId, own)
    return food ? [{ food, portion: i.portion }] : []
  })
}

// «Arroz blanco cocido · 200 g · 260 kcal»
export function itemText(i: FoodItem, own: Food[]): string {
  if (i.k === 'quick') return `${i.name} · ${fmtKcal(i.kcal)} kcal`
  if (i.k === 'pending') return i.query
  if (i.k === 'estimate') return [i.draft.name, fmtPortion(i.portion, i.draft.base), `${fmtKcal(nutrients({ id: '', ...i.draft }, i.portion.qty).kcal)} kcal`].filter(Boolean).join(' · ')
  const f = foodById(i.foodId, own)
  if (!f) return i.said
  if (!i.portion) return f.name
  return [f.name, fmtPortion(i.portion, f.base), `${fmtKcal(nutrients(f, i.portion.qty).kcal)} kcal`].join(' · ')
}

// Kcal de un ítem listo (0 si no tiene ración)
export function itemKcal(i: FoodItem, own: Food[]): number {
  if (i.k === 'quick') return i.kcal
  if (i.k === 'estimate') return nutrients({ id: '', ...i.draft }, i.portion.qty).kcal
  if (i.k !== 'food' || !i.portion) return 0
  const f = foodById(i.foodId, own)
  return f ? nutrients(f, i.portion.qty).kcal : 0
}

// Lo que falta de un ítem no listo, para la tarjeta de la captura y la lista «Por voz: pendiente» de Comida
export function pendingText(i: FoodItem, own: Food[]): string {
  if (i.k === 'pending') return i.ids.length >= 2 ? `«${i.query}»: hay varios alimentos` : `«${i.query}»: no está en tus alimentos`
  if (i.k === 'food' && !itemReady(i)) {
    const name = foodById(i.foodId, own)?.name ?? i.said
    if (i.problem === 'guess') return itemText(i, own)
    return `${name} · ${i.problem === 'range' ? 'cantidad fuera de rango' : i.problem === 'unit' ? 'no sé esa medida' : 'falta la cantidad'}`
  }
  return itemText(i, own)
}

// ¿Hay algo que confirmar con «Apuntar»? Una estimación de Haiku o una ración típica propuesta.
export const isConfirmable = (i: FoodItem): boolean => i.k === 'estimate' || (i.k === 'food' && i.problem === 'guess' && i.portion !== null)

// Entrada de una estimación confirmada sin guardarla como propio (A4): tipo añadido rápido con macros, nombre «X (200 g)».
export function estimateEntry(draft: Omit<Food, 'id'>, p: Portion, id: string, at: string): FoodEntry {
  const n = nutrients({ id: '', ...draft }, p.qty)
  return { id, occurredAt: at, name: trimName(`${draft.name} (${fmtPortion({ qty: p.qty }, draft.base)})`, 60), kcal: n.kcal, p: n.p, c: n.c, f: n.f, qty: 0, via: 'voice' }
}

const AI_UNITS: readonly unknown[] = ['g', 'kg', 'ml', 'l', 'kcal', 'serving', 'none']
const fin = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const per100 = (n: number, max: number) => n >= 0 && n <= max

// Lista de alimentos de Haiku (ya parseada) → ítems. Haiku da nombres, no ids: se resuelven con los mismos términos que el parser.
// null si algún elemento (de los 8 primeros) no cumple tipos o enums: entonces manda el parser.
// ponytail: el nombre solo cuenta como alimento del catálogo si el término empieza la frase («arroz blanco» sí; «bocadillo de calamares» no, es una estimación): sin erratas ni plurales raros.
export function foodItemsFromAI(v: unknown, own: Food[] = NO_OWN): FoodItem[] | null {
  if (!Array.isArray(v)) return null
  const terms = foodTerms(own), out: FoodItem[] = []
  for (const x of v.slice(0, MAX_FOOD_ITEMS) as unknown[]) {
    if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
    const o = x as Record<string, unknown>
    if (typeof o.name !== 'string' || !AI_UNITS.includes(o.unit) || typeof o.servingWord !== 'string' || (o.base !== 'g' && o.base !== 'ml') ||
      !(o.amount === null || fin(o.amount)) || !(o.typicalQty === null || fin(o.typicalQty)) || !fin(o.kcal100) || !fin(o.p100) || !fin(o.c100) || !fin(o.f100)) return null
    const name = o.name.trim().replace(/\s+/g, ' ')
    if (name.length < 1 || name.length > 60) return null
    const amount = o.amount, unit = o.unit as 'g' | 'kg' | 'ml' | 'l' | 'kcal' | 'serving' | 'none'
    const tq = o.typicalQty !== null && rangeOk(o.typicalQty) ? r1(o.typicalQty) : null
    const word = normalizeText(o.servingWord).split(' ')[0] || 'unidad'
    const qty: FoodQty | null = amount === null || unit === 'kcal' ? null
      : unit === 'g' || unit === 'kg' ? { n: amount * (unit === 'kg' ? 1000 : 1), unit: 'g', word: unit }
      : unit === 'ml' || unit === 'l' ? { n: amount * (unit === 'l' ? 1000 : 1), unit: 'ml', word: unit }
      : unit === 'serving' ? { n: amount, unit: 'serving', word }
      : { n: amount, unit: null, word: '' }
    const hit = findFoods(foodNorm(name).split(' '), terms)[0]
    const head = hit && hit.s === 0 ? hit : null
    if (unit === 'kcal' && amount !== null && Math.round(amount) >= 1 && Math.round(amount) <= 10000) {
      out.push({ k: 'quick', said: name, kcal: Math.round(amount), name: head && head.ids.length === 1 ? foodById(head.ids[0], own)!.name : cap(name).slice(0, 60) })
      continue
    }
    if (head) {
      if (head.ids.length >= 2) { out.push({ k: 'pending', said: name, query: name, ids: head.ids, qty }); continue }
      const f = foodById(head.ids[0], own)!
      let pf = portionFor(f, qty)
      if (pf.problem === 'missing' && tq !== null) {
        const n = qty?.unit === 'serving' ? qty.n : 1
        if (tq * n <= 2000) pf = { portion: { qty: r1(tq * n) }, problem: 'guess' }
      }
      out.push({ k: 'food', said: name, foodId: f.id, qty, ...pf })
      continue
    }
    // sin alimento conocido: estimación de Haiku (si los números son plausibles) o pendiente para buscarlo a mano
    const macros = per100(o.kcal100, 900) && per100(o.p100, 100) && per100(o.c100, 100) && per100(o.f100, 100) && o.p100 + o.c100 + o.f100 <= 100
    let portion: Portion | null = null
    if (macros) {
      if (qty && (qty.unit === 'g' || qty.unit === 'ml')) { const q = r1(qty.n); if (rangeOk(q)) portion = { qty: q } }
      else if (tq !== null) portion = byServing({ name: 'Ración', qty: tq }, qty ? qty.n : 1).portion
    }
    if (macros && portion) {
      const draft: Omit<Food, 'id'> = { name: trimName(cap(name), 40), base: o.base, kcal: r1(o.kcal100), p: r1(o.p100), c: r1(o.c100), f: r1(o.f100), ...(tq !== null ? { servings: [{ name: 'Ración', qty: tq }] } : {}), source: 'estimate' }
      out.push({ k: 'estimate', said: name, draft, portion })
    } else out.push({ k: 'pending', said: name, query: name, ids: [], qty })
  }
  return out
}
