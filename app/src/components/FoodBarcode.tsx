import { useEffect, useRef, useState } from 'react'
import { CircleAlert } from 'lucide-react'
import type { Food } from '../core/types'
import { foodByRef } from '../core/food'
import { normEan, type FoodDraft, type OffResult } from '../core/off'
import type { FoodPrivacy } from '../core/storage'
import { FoodCustom } from './FoodCustom'
import { FoodNetPrivacy } from './FoodNetPrivacy'
import { field, primary, secondary } from './foodStyle'

export type FoodNet = {
  online: boolean
  hasKey: boolean                       // aiKey.hint !== null
  ack: FoodPrivacy
  onAck: (k: 'off' | 'label') => void
  lookupEan: (ean: string) => Promise<OffResult>
}

type Props = {
  net: FoodNet
  custom: Food[]
  onPick: (f: Food) => void            // EAN ya guardado y activo: abre su cantidad
  onReactivate: (f: Food) => void
  onCreate: (f: Omit<Food, 'id'>) => void
  onStatus: (text: string) => void
  onClose: () => void
}
type View =
  | { t: 'form' }
  | { t: 'searching' }
  | { t: 'archived'; food: Food }
  | { t: 'review'; draft: FoodDraft; complete: boolean }
  | { t: 'manual'; ean: string }
  | { t: 'fail'; ean: string; text: string; retry: boolean }

const ERROR_TEXT = {
  rate: 'Demasiadas búsquedas seguidas. Espera un minuto.',
  network: 'No hay conexión con Open Food Facts.',
  timeout: 'No hay conexión con Open Food Facts.',
  http: 'Open Food Facts ha respondido algo inesperado.',
  invalid: 'Open Food Facts ha respondido algo inesperado.',
} as const
const OFFLINE_TEXT = 'Sin conexión. Puedes crearlo a mano'
const NO_KEY_TEXT = 'Con una clave de Anthropic en Ajustes puedes leer la etiqueta con una foto.'

// Panel «Código de barras»: aviso de privacidad, campo EAN, búsqueda en OFF y revisión antes de guardar.
export function FoodBarcode({ net, custom, onPick, onReactivate, onCreate, onStatus, onClose }: Props) {
  const [text, setText] = useState('')
  const [view, setView] = useState<View>({ t: 'form' })
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const ack = net.ack.off !== undefined
  useEffect(() => { if (ack && view.t === 'form') inputRef.current?.focus() }, [ack, view.t])

  if (!ack) return <FoodNetPrivacy kind="off" onAccept={() => net.onAck('off')} onCancel={onClose} />

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    const ean = normEan(text)
    if (!ean) return setError('Revisa el código: son 8 o 13 cifras.')
    setError('')
    const own = foodByRef(ean, custom)
    if (own && !own.archived) { onStatus(`Ya lo tienes: ${own.name}`); return onPick(own) }
    if (own) return setView({ t: 'archived', food: own })
    if (!net.online || navigator.onLine === false) return setView({ t: 'fail', ean, text: OFFLINE_TEXT, retry: false })
    setView({ t: 'searching' })
    const r = await net.lookupEan(ean)
    if (r.kind === 'found') setView({ t: 'review', draft: r.draft, complete: r.complete })
    else if (r.kind === 'not-found') setView({ t: 'fail', ean, text: 'Open Food Facts no tiene este código.', retry: false })
    else setView({ t: 'fail', ean, text: ERROR_TEXT[r.error], retry: r.error === 'http' || r.error === 'invalid' })
  }

  if (view.t === 'review') return (
    <div className="flex flex-col gap-2">
      {!view.complete && <p role="status" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />Open Food Facts no tiene todos los valores. Complétalos o haz una foto de la etiqueta.</p>}
      <FoodCustom key="review" initialName="" draft={view.draft} custom={custom} onCreate={onCreate} onReactivate={onReactivate} onCancel={() => setView({ t: 'form' })} />
    </div>
  )
  if (view.t === 'manual') return <FoodCustom key="manual" initialName="" manualRef={view.ean} custom={custom} onCreate={onCreate} onReactivate={onReactivate} onCancel={() => setView({ t: 'form' })} />

  return (
    <section aria-labelledby="food-barcode-title" className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
      <h3 id="food-barcode-title" className="text-sm font-semibold">Código de barras</h3>
      <form onSubmit={search} noValidate className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="food-ean" className="text-xs font-medium">Código de barras</label>
          <input id="food-ean" ref={inputRef} type="text" inputMode="numeric" autoComplete="off" value={text} onChange={e => { setText(e.target.value); setError('') }}
            aria-invalid={!!error} aria-describedby={error ? 'food-ean-err' : undefined} className={`${field} tabular-nums`} />
        </div>
        <button type="submit" disabled={view.t === 'searching'} className={primary}>Buscar</button>
        <button type="button" onClick={onClose} className={secondary}>Cancelar</button>
      </form>
      {error && <p id="food-ean-err" role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{error}</p>}
      <p role="status" className="text-sm text-hero-muted empty:sr-only">{view.t === 'searching' ? 'Buscando en Open Food Facts…' : view.t === 'archived' ? 'Ya lo tienes, archivado' : ''}</p>
      {view.t === 'archived' && <button type="button" onClick={() => onReactivate(view.food)} className={`${secondary} self-start`}>Reactivar</button>}
      {view.t === 
'fail' && (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="flex items-center gap-2 text-sm text-hero-text"><CircleAlert className="size-4 shrink-0" aria-hidden />{view.text}</p>
          <div className="flex flex-wrap gap-2">
            {view.retry && <button type="button" onClick={() => void search()} className={secondary}>Reintentar</button>}
            <button type="button" onClick={() => setView({ t: 'manual', ean: view.ean })} className={secondary}>Crear a mano</button>
          </div>
          {!net.hasKey && <p className="text-sm text-hero-muted">{NO_KEY_TEXT}</p>}
        </div>
      )}
    </section>
  )
}
