import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, CircleAlert, Plus, ScanBarcode } from 'lucide-react'
import type { DietChange, Food, FoodData, Portion } from '../core/types'
import { allFoods, dietNote, fmtKcal, fmtPortion, foodById, frequentFoods, lastPortion, parseKcal, parseMacro, portion, recentFoods, searchFoods } from '../core/food'
import { Segmented } from './Segmented'
import { FoodQty } from './FoodQty'
import { FoodCustom } from './FoodCustom'
import { FoodBarcode, type FoodNet } from './FoodBarcode'
import { FoodLabel } from './FoodLabel'
import { card, field, primary, secondary } from './foodStyle'

type Quick = { kcal: number; p?: number; c?: number; f?: number; name?: string }
// Abre el panel con algo ya elegido (desde «Por voz: pendiente»). `key` distingue dos aperturas seguidas: quien lo pasa remonta FoodAdd con él.
export type FoodOpen = { key: number } & (
  | { kind: 'qty'; food: Food; portion: Portion | null }
  | { kind: 'search'; query: string }
  | { kind: 'quick'; kcal: number; name: string })
type Props = {
  open?: FoodOpen | null
  food: FoodData
  day: string
  today: string
  onAdd: (f: Food, p: Portion, day: string) => { diet: DietChange }
  onQuick: (i: Quick, day: string) => { diet: DietChange }
  onCreate: (f: Omit<Food, 'id'>) => Food
  onArchive: (id: string, archived: boolean) => void
  onStatus: (text: string) => void // «Añadido: …», lo anuncia la región status de FoodView
  net: FoodNet
}

const isOwn = (f: Food) => f.id.startsWith('food-')
const defaultPortion = (f: Food, last: Portion | null): Portion => last ?? (f.servings?.[0] ? { qty: f.servings[0].qty, serving: { name: f.servings[0].name, n: 1 } } : { qty: 100 })

export function FoodAdd({ open, food, day, today, onAdd, onQuick, onCreate, onArchive, onStatus, net }: Props) {
  const [query, setQuery] = useState(open?.kind === 'search' ? open.query : '')
  const [tab, setTab] = useState<'recent' | 'frequent'>('recent')
  const [picked, setPicked] = useState<Food | null>(open?.kind === 'qty' ? open.food : null)
  const [seed, setSeed] = useState<Portion | null>(open?.kind === 'qty' ? open.portion : null) // ración propuesta por la voz, solo para el primer alimento
  const [panel, setPanel] = useState<null | 'create' | 'barcode' | 'label'>(null) // un solo panel abierto; abrir uno cierra `picked`
  const [createName, setCreateName] = useState('') // nombre prerrellenado de «Crear alimento»
  const openCreate = (name: string) => { setPicked(null); setCreateName(name); setPanel('create') }
  const [quickOpen, setQuickOpen] = useState(open?.kind === 'quick')
  const [q, setQ] = useState({ kcal: open?.kind === 'quick' ? String(open.kcal) : '', p: '', c: '', f: '', name: open?.kind === 'quick' && open.name !== 'Añadido rápido' ? open.name : '' })
  const [qErr, setQErr] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (open?.kind === 'search') searchRef.current?.focus() }, [open])
  const foods = useMemo(() => allFoods(food.foods), [food.foods])
  const results = useMemo(() => searchFoods(query, foods), [query, foods])
  const list = useMemo(() => (tab === 'recent' ? recentFoods(food.log, 20) : frequentFoods(food.log, today, 20))
    .flatMap(r => { const f = foodById(r.foodId, food.foods); return f && !f.archived ? [f] : [] }).slice(0, 8), [tab, food.log, food.foods, today])
  const typing = query.trim() !== ''

  const done = (text: string, diet: DietChange) => {
    onStatus(text + dietNote(diet))
    setQuery(''); setPicked(null); setSeed(null)
    setTimeout(() => searchRef.current?.focus(), 0)
  }
  const add = (f: Food, p: Portion) => {
    const kcal = portion(f, p.qty).kcal
    const r = onAdd(f, p, day)
    done(`Añadido: ${f.name} ${fmtPortion(p, f.base)} (${fmtKcal(kcal)} kcal)`, r.diet)
  }
  const submitQuick = (e: React.FormEvent) => {
    e.preventDefault()
    const kcal = parseKcal(q.kcal), p = parseMacro(q.p), c = parseMacro(q.c), f = parseMacro(q.f)
    if (kcal === null) return setQErr('Indica las kcal (1 a 10.000).')
    if (p === null || c === null || f === null) return setQErr('Los macros son números de 0 a 1.000 g, o déjalos vacíos.')
    if (q.name.trim().length > 60) return setQErr('El nombre admite hasta 60 caracteres.')
    const input: Quick = { kcal, ...(p !== undefined && { p }), ...(c !== undefined && { c }), ...(f !== undefined && { f }), ...(q.name.trim() && { name: q.name.trim() }) }
    const r = onQuick(input, day)
    setQ({ kcal: '', p: '', c: '', f: '', name: '' }); setQErr(''); setQuickOpen(false)
    done(`Añadido: ${input.name ?? 'Añadido rápido'} (${fmtKcal(kcal)} kcal)`, r.diet)
  }
  const create = (input: Omit<Food, 'id'>) => {
    const f = onCreate(input)
    setPanel(null); setQuery(''); setPicked(f)
    onStatus(`Alimento creado: ${f.name}`)
  }
  const reactivate = (f: Food) => {
    onArchive(f.id, false)
    setPanel(null); setQuery(''); setPicked({ ...f, archived: false })
    onStatus(`Reactivado: ${f.name}`)
  }
  const archive = (f: Food) => {
    onArchive(f.id, true)
    onStatus(`Archivado: ${f.name}`)
    searchRef.current?.focus()
  }
  const item = (f: Food, extra?: string) => (
    <li key={f.id} className="flex items-center">
      <button type="button" onClick={() => { setPicked(f); setSeed(null) }}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2 text-left text-sm outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:-outline-offset-2">
        <span className="min-w-0 flex-1 font-semibold">{f.name}</span>
        <span className="shrink-0 text-hero-muted tabular-nums">{extra ?? `${fmtKcal(f.kcal)} kcal/100 ${f.base}`}</span>
      </button>
      {extra === undefined && isOwn(f) && <button type="button" onClick={() => archive(f)} aria-label={`Archivar ${f.name}`} className="m-1 inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-hero-border px-3 text-sm font-semibold text-hero-text outline-hero hover:bg-hero-bg focus-visible:outline-2 focus-visible:outline-offset-2">Archivar</button>}
    </li>
  )
  const qField = (key: 'kcal' | 'p' | 'c' | 'f', label: string, id: string) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">{label}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={q[key]} onChange={e => setQ(x => ({ ...x, [key]: e.target.value }))} className={`${field} tabular-nums`} />
    </div>
  )

  return (
    <section aria-labelledby="food-add" className={card}>
      <h2 id="food-add" className="text-base font-semibold">Apuntar comida</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="food-search" className="text-xs font-medium">Buscar alimento</label>
        <input id="food-search" ref={searchRef} type="search" autoComplete="off" value={query} onChange={e => { setQuery(e.target.value); setPicked(null) }} className={field} />
      </div>
      {panel === 'create'
        ? <FoodCustom key="create" initialName={createName} custom={food.foods} onCreate={create} onReactivate={reactivate} onCancel={() => { setPanel(null); searchRef.current?.focus() }} />
        : panel === 'barcode'
        ? <FoodBarcode net={net} custom={food.foods} onPick={f => { setPanel(null); setQuery(''); setPicked(f) }} onReactivate={reactivate} onCreate={create} onStatus={onStatus} onClose={() => { setPanel(null); searchRef.current?.focus() }} onLabel={() => setPanel('label')} />
        : panel === 'label'
        ? <FoodLabel net={net} custom={food.foods} onPick={f => { setPanel(null); setQuery(''); setPicked(f) }} onReactivate={reactivate} onCreate={create} onStatus={onStatus} onClose={() => { setPanel(null); searchRef.current?.focus() }} />
        : picked
        ? <FoodQty key={picked.id} food={picked} initial={seed ?? defaultPortion(picked, lastPortion(food.log, picked.id))} onAdd={p => add(picked, p)} onCancel={() => { setPicked(null); searchRef.current?.focus() }} />
        : typing
          ? results.length === 0
            ? <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-hero-muted">Sin resultados para «{query.trim()}». Apunta las calorías con «Añadido rápido».</p>
                <button type="button" onClick={() => openCreate(query.trim())} className={secondary}><Plus className="size-4" aria-hidden />Crear alimento</button>
              </div>
            : <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">{results.map(f => item(f))}</ul>
          : (
            <div className="flex flex-col gap-2">
              <Segmented<'recent' | 'frequent'> label="Alimentos" value={tab} onChange={setTab} toneFor={() => 'hero'} options={[{ value: 'recent', label: 'Recientes' }, { value: 'frequent', label: 'Frecuentes' }]} />
              {list.length === 0 ? <p className="text-sm text-hero-muted">Aún no has apuntado alimentos.</p>
                : <ul className="divide-y divide-hero-border rounded-lg border border-hero-border">
                    {list.map(f => { const p = lastPortion(food.log, f.id); return item(f, p ? fmtPortion(p, f.base) : undefined) })}
                  </ul>}
            </div>
          )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setQuickOpen(o => !o)} aria-expanded={quickOpen} aria-controls="food-quick" className={secondary}>
          <Plus className="size-4" aria-hidden />Añadido rápido
        </button>
        <button type="button" onClick={() => openCreate('')} className={secondary}>
          <Plus className="size-4" aria-hidden />Crear alimento
        </button>
        <button type="button" onClick={() => { setPicked(null); setPanel('barcode') }} className={secondary}>
          <ScanBarcode className="size-4" aria-hidden />Código de barras
        </button>
        {net.hasKey && (
          <button type="button" onClick={() => { setPicked(null); setPanel('label') }} className={secondary}>
            <Camera className="size-4" aria-hidden />Foto de la etiqueta
          </button>
        )}
      </div>
      {quickOpen && (
        <form id="food-quick" onSubmit={submitQuick} noValidate className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
          {qField('kcal', 'Calorías (kcal)', 'food-q-kcal')}
          <div className="flex gap-2">{qField('p', 'Proteína (g)', 'food-q-p')}{qField('c', 'Carbohidratos (g)', 'food-q-c')}{qField('f', 'Grasa (g)', 'food-q-f')}</div>
          <div className="flex flex-col gap-1">
            <label htmlFor="food-q-name" className="text-xs font-medium">Nombre (opcional)</label>
            <input id="food-q-name" type="text" autoComplete="off" value={q.name} onChange={e => setQ(x => ({ ...x, name: e.target.value }))} className={field} />
          </div>
          {qErr && <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{qErr}</p>}
          <button type="submit" className={`${primary} self-start`}>Añadir</button>
        </form>
      )}
    </section>
  )
}
