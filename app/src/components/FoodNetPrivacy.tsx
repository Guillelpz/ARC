import { useEffect, useRef } from 'react'
import { primary, secondary } from './foodStyle'
import { NET_PRIVACY, type NetKind } from './foodNetText'

// Aviso de privacidad de una integración de red de Comida: panel en línea (no modal), paleta HERO. El foco va al encabezado.
export function FoodNetPrivacy({ kind, onAccept, onCancel }: { kind: NetKind; onAccept: () => void; onCancel: () => void }) {
  const h = useRef<HTMLHeadingElement>(null), t = NET_PRIVACY[kind]
  useEffect(() => { h.current?.focus() }, [])
  return (
    <section aria-labelledby="food-net-privacy" className="flex flex-col gap-3 rounded-lg border border-hero-border p-3">
      <h3 id="food-net-privacy" ref={h} tabIndex={-1} className="text-sm font-semibold outline-none">{t.title}</h3>
      <p className="text-sm leading-6 text-hero-muted">{t.text}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAccept} className={primary}>Entendido</button>
        <button type="button" onClick={onCancel} className={secondary}>Cancelar</button>
      </div>
    </section>
  )
}
