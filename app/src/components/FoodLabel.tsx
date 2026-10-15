import { useEffect, useRef, useState } from 'react'
import { Camera, CircleAlert } from 'lucide-react'
import type { Food } from '../core/types'
import { foodByRef } from '../core/food'
import type { FoodDraft } from '../core/off'
import type { LabelResult } from '../core/label'
import { FoodCustom } from './FoodCustom'
import { FoodNetPrivacy } from './FoodNetPrivacy'
import { TEST_TEXT } from './aiKeyText'
import type { FoodNet } from './FoodBarcode'
import { primary, secondary } from './foodStyle'

type Props = {
  net: FoodNet
  custom: Food[]
  onPick: (f: Food) => void            // el EAN leído ya está guardado y activo: abre su cantidad
  onReactivate: (f: Food) => void
  onCreate: (f: Omit<Food, 'id'>) => void
  onStatus: (text: string) => void
  onClose: () => void
}
type View =
  | { t: 'form' }
  | { t: 'reading' }
  | { t: 'archived'; food: Food }
  | { t: 'review'; draft: FoodDraft }
  | { t: 'manual' }
  | { t: 'fail'; text: string }

const OFFLINE_TEXT = 'Sin conexión. Puedes crearlo a mano'
const FAIL_TEXT = {
  image: 'No se ha podido abrir la foto. Prueba con otra.',
  unreadable: 'No se lee la tabla nutricional. Haz la foto más cerca y con luz.',
} as const

// Panel «Foto de la etiqueta»: aviso de privacidad, selector de foto, lectura con Haiku y revisión antes de guardar.
export function FoodLabel({ net, custom, onPick, onReactivate, onCreate, onStatus, onClose }: Props) {
  const [view, setView] = useState<View>({ t: 'form' })
  const input = useRef<HTMLInputElement>(null)
  const head = useRef<HTMLHeadingElement>(null)
  const ack = net.ack.label !== undefined
  useEffect(() => { if (ack && view.t === 'form') head.current?.focus() }, [ack, view.t])

  // El selector se abre dentro del gesto (clic) para que iOS lo permita.
  const choose = () => {
    if (!net.online || navigator.onLine === false) return setView({ t: 'fail', text: OFFLINE_TEXT })
    input.current?.click()
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite volver a elegir la misma foto
    if (!file) return
    if (!net.online || navigator.onLine === false) return setView({ t: 'fail', text: OFFLINE_TEXT })
    setView({ t: 'reading' })
    const r: LabelResult = await net.readLabel(file)
    if (!r.ok) return setView({ t: 'fail', text: r.error === 'image' || r.error === 'unreadable' ? FAIL_TEXT[r.error] : TEST_TEXT[r.error] })
    const own = r.draft.ref ? foodByRef(r.draft.ref, custom) : null
    if (own && !own.archived) { onStatus(`Ya lo tienes: ${own.name}`); return onPick(own) }
    if (own) return setView({ t: 'archived', food: own })
    setView({ t: 'review', draft: r.draft })
  }
  const picker = <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={e => void onFile(e)} />

  // El selector va siempre en la misma posición: si se desmontara al aceptar el aviso, la foto elegida se perdería.
  return <>{picker}{body()}</>
  function body() {
  if (!ack) return <FoodNetPrivacy kind="label" onAccept={() => { net.onAck('label'); choose() }} onCancel={onClose} />
  if (view.t === 'review') {
    const d = view.draft
    return (
      <div className="flex flex-col gap-2">
        {[d.kcal, d.p, d.c, d.f].some(x => x === null) && <p role="status" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />No se han podido leer todos los valores. Complétalos.</p>}
        <FoodCustom key="review" initialName="" draft={d} custom={custom} onCreate={onCreate} onReactivate={onReactivate} onCancel={() => setView({ t: 'form' })} />
      </div>
    )
  }
  if (view.t === 'manual') return <FoodCustom key="manual" initialName="" custom={custom} onCreate={onCreate} onReactivate={onReactivate} onCancel={() => setView({ t: 'form' })} />

  return (
    <section aria-labelledby="food-label-title" className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
      <h3 id="food-label-title" ref={head} tabIndex={-1} className="text-sm font-semibold outline-none">Foto de la etiqueta</h3>
      <p className="text-sm text-hero-muted">Haz la foto solo de la tabla nutricional, de cerca y con luz. Revisarás los valores antes de guardar.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={choose} disabled={view.t === 'reading'} className={primary}><Camera className="size-4" aria-hidden />{view.t === 'fail' ? 'Probar otra foto' : 'Hacer o elegir foto'}</button>
        <button type="button" onClick={onClose} className={secondary}>Cancelar</button>
      </div>
      <p role="status" className="text-sm text-hero-muted empty:sr-only">{view.t === 'reading' ? 'Leyendo la etiqueta…' : view.t === 'archived' ? 'Ya lo tienes, archivado' : ''}</p>
      {view.t === 'archived' && <button type="button" onClick={() => onReactivate(view.food)} className={`${secondary} self-start`}>Reactivar</button>}
      {view.t === 'fail' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{view.text}</p>
          <button type="button" onClick={() => setView({ t: 'manual' })} className={secondary}>Crear a mano</button>
        </div>
      )}
    </section>
  )
  }
}
