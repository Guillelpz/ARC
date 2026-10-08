import { flushSync } from 'react-dom'

// Envuelve un cambio de estado en una View Transition (si el navegador la soporta).
// kind va a <html data-vt> para que index.css distinga cambio de pantalla de cambio local.
export function transition(update: () => void, kind: 'screen' | 'local' = 'local') {
  if (!document.startViewTransition) return update()
  const root = document.documentElement
  root.dataset.vt = kind
  document.startViewTransition(() => flushSync(update)).finished.finally(() => delete root.dataset.vt)
}

// view-transition-name debe ser un identificador CSS: sin espacios ni acentos
export const vtName = (s: string) => s.normalize('NFD').replace(/[^a-zA-Z0-9-]/g, '')
