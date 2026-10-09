import { CircleAlert, Download } from 'lucide-react'
import { bannerTones } from './bannerTones'

export const SAVE_FAIL_TEXT = 'No se ha podido guardar en este navegador. Lo que registres ahora se perderá al recargar: exporta una copia.'

// Sin role: lo anuncia la región status global de App.
export function SaveFailBanner({ tone, onExport, className = '' }: { tone: keyof typeof bannerTones; onExport: () => void; className?: string }) {
  const c = bannerTones[tone]
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${c.box} ${className}`}>
      <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm">{SAVE_FAIL_TEXT}</p>
      <button type="button" onClick={onExport}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${c.btn}`}>
        <Download className="size-4" aria-hidden />Exportar copia ahora
      </button>
    </div>
  )
}
