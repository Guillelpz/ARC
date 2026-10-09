import { RotateCw, X } from 'lucide-react'
import { bannerTones } from './bannerTones'

export const STALE_TAB_TEXT = 'Otra pestaña ha guardado datos que esta no puede leer. Recarga para seguir; lo que registres aquí no se guardará.'

export function UpdateBanner({ tone, onReload, onClose, text = 'Hay una versión nueva de la app.' }: { tone: keyof typeof bannerTones; onReload: () => void; onClose?: () => void; text?: string }) {
  const c = bannerTones[tone]
  const btn = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.btn}`
  return (
    <div className="fixed inset-x-0 top-4 z-40 mx-auto max-w-md px-4">
      <div role="status" className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm ${c.box}`}>
        <p className="flex-1 text-sm">{text}</p>
        <button type="button" onClick={onReload} className={`${btn} px-4`}>
          <RotateCw className="size-4" aria-hidden />Recargar
        </button>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Cerrar aviso" className={`${btn} min-w-11`}>
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}
