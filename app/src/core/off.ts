import type { FoodBase, Serving } from './types'

// Open Food Facts (OFF): código de barras → borrador de alimento. Lógica pura salvo `fetchOff` (fetch inyectable).
export const OFF_USER_AGENT = 'RPGLifeTracker/1.0 (+https://github.com/Guillelpz/ARC)' // I6: URL del repo, sin email
export const OFF_TIMEOUT_MS = 8000
export const OFF_FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,quantity,product_quantity_unit'

export type FoodDraft = {
  name: string                 // '' si no hay nombre; ≤ 40
  base: FoodBase
  kcal: number | null          // por 100 de base; null = falta o fuera de rango
  p: number | null; c: number | null; f: number | null
  servings: Serving[]          // 0..1
  source: 'off' | 'label' | 'estimate'
  ref?: string                 // EAN-13 normalizado
}
export type OffError = 'network' | 'timeout' | 'rate' | 'http' | 'invalid'
export type OffResult =
  | { kind: 'found'; draft: FoodDraft; complete: boolean }   // complete = kcal, p, c y f no nulos
  | { kind: 'not-found' }
  | { kind: 'error'; error: OffError }

// EAN-8, UPC-A (12, pasa a 13 con un 0) o EAN-13 con dígito de control válido; ponytail: UPC-E y GTIN-14 no se aceptan.
export function normEan(t: string): string | null {
  const s = t.replace(/[\s-]/g, '')
  if (!/^\d+$/.test(s) || ![8, 12, 13].includes(s.length)) return null
  const d = [...s].map(Number), check = d.pop()!
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0)
  if ((10 - (sum % 10)) % 10 !== check) return null
  return s.length === 12 ? `0${s}` : s
}

export const offUrl = (ean: string) => `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=${OFF_FIELDS}`

export function trimName(s: string, max = 40): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1), i = cut.lastIndexOf(' ')
  return i > 0 ? cut.slice(0, i) : t.slice(0, max)
}

export function kcalCoherent(n: { kcal: number; p: number; c: number; f: number }): boolean {
  return Math.abs(n.kcal - (4 * n.p + 4 * n.c + 9 * n.f)) <= Math.max(20, 0.15 * n.kcal)
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const r1 = (x: number) => Math.round(x * 10 + 1e-9) / 10
// undefined = falta; null = valor no interpretable
function num(v: unknown): number | undefined | null {
  if (v === undefined || v === null || v === '') return undefined
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') { const s = v.trim().replace(',', '.'); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null }
  return null
}

export function parseOff(v: unknown, ean: string): OffResult | null {
  if (!isObj(v)) return null
  if (v.status === 0 || !isObj(v.product)) return { kind: 'not-found' }
  const p = v.product, nu = isObj(p.nutriments) ? p.nutriments : {}
  const read = (o: Record<string, unknown>, k: string) => num(o[k])
  const vals = [read(nu, 'energy-kcal_100g'), read(nu, 'energy-kj_100g'), read(nu, 'energy_100g'), read(nu, 'proteins_100g'), read(nu, 'carbohydrates_100g'), read(nu, 'fat_100g'), num(p.serving_quantity)]
  if (vals.includes(null)) return null
  const [kc, kj, en, pr, ch, fa, sq] = vals as (number | undefined)[]
  const kRaw = kc ?? (kj !== undefined ? kj / 4.184 : en !== undefined ? en / 4.184 : undefined)
  const kRound = kRaw === undefined ? undefined : Math.round(kRaw)
  const kcal = kRound !== undefined && kRound >= 0 && kRound <= 900 ? kRound : null
  const mac = (x: number | undefined) => { if (x === undefined) return null; const m = r1(x); return m >= 0 && m <= 100 ? m : null }
  let [pp, cc, ff] = [mac(pr), mac(ch), mac(fa)]
  if (pp !== null && cc !== null && ff !== null && pp + cc + ff > 100) [pp, cc, ff] = [null, null, null]

  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const nm = trimName(str(p.product_name_es) || str(p.product_name))
  const brand = str(p.brands).split(',')[0].trim()
  const name = nm && brand ? trimName(`${nm} (${brand})`) : nm

  const quantity = str(p.quantity)
  const base: FoodBase = p.product_quantity_unit === 'ml' || /\d\s*(ml|cl|l)\s*$/i.test(quantity) ? 'ml' : 'g'

  const servings: Serving[] = []
  const sUnit = str(p.serving_quantity_unit).trim().toLowerCase()
  if (sq !== undefined && sq > 0 && sq <= 2000 && (sUnit === '' || sUnit === base)) servings.push({ name: 'Ración', qty: sq })
  else {
    const all = [...str(p.serving_size).matchAll(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/gi)], last = all[all.length - 1]
    if (last && last[2].toLowerCase() === base) {
      const q = Number(last[1].replace(',', '.'))
      if (q > 0 && q <= 2000) servings.push({ name: 'Ración', qty: q })
    }
  }
  return { kind: 'found', complete: [kcal, pp, cc, ff].every(x => x !== null), draft: { name, base, kcal, p: pp, c: cc, f: ff, servings, source: 'off', ref: ean } }
}

export async function fetchOff(ean: string, fetchImpl: typeof fetch = fetch): Promise<OffResult> {
  const ctl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; ctl.abort() }, OFF_TIMEOUT_MS) // no AbortSignal.timeout (iOS < 16)
  try {
    const res = await fetchImpl(offUrl(ean), { headers: { 'X-User-Agent': OFF_USER_AGENT }, signal: ctl.signal })
    if (res.status === 429) return { kind: 'error', error: 'rate' }
    const body = async (): Promise<unknown> => { try { return await res.json() } catch { return undefined } }
    if (res.status === 404) return (await parseBody(await body(), ean)) ?? { kind: 'not-found' }
    if (!res.ok) return { kind: 'error', error: 'http' }
    return (await parseBody(await body(), ean)) ?? { kind: 'error', error: 'invalid' }
  } catch {
    return { kind: 'error', error: timedOut ? 'timeout' : 'network' }
  } finally { clearTimeout(timer) }
}
const parseBody = async (v: unknown, ean: string) => (v === undefined ? null : parseOff(v, ean))
