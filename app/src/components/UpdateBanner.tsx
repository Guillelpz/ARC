import { RotateCw, X } from 'lucide-react'
import { bannerTones } from './bannerTones'

export function UpdateBanner({ tone, onReload, onClose }: { tone: keyof typeof bannerTones; onReload: () => void; onClose: () => void }) {
  const c = bannerTones[tone]
  const btn = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.btn}`
  return (
    <div className="fixed inset-x-0 top-4 z-40 mx-auto max-w-md px-4">
      <div role="status" className={`flex items-center gap-3 rounded-xl border p-4 shadow-sm ${c.box}`}>
        <p className="flex-1 text-sm">Hay una versión nueva de la app.</p>
        <button type="button" onClick={onReload} className={`${btn} px-4`}>
          <RotateCw className="size-4" aria-hidden />Recargar
        </button>
        <button type="button" onClick={onClose} aria-label="Cerrar aviso" className={`${btn} min-w-11`}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}
