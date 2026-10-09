import { ChevronsDown, Ghost, Zap } from 'lucide-react'
import type { RankMetric } from '../core/types'
import type { Overtake, Toast } from './LevelUpToast'

// Te superan: HERO = un rival pasa como un rayo y te empuja; VILLAIN = glitch; profundidad = bajas escalones
export const PASSED: Record<RankMetric, { card: string; badge: string; label: string; muted: string; title: string; Icon: typeof Zap }> = {
  hero: { card: 'passed-hero border-hero bg-hero-surface text-hero-text', badge: 'bg-hero text-hero-on-accent', label: 'text-hero', muted: 'text-hero-muted', title: 'Te adelantan', Icon: Zap },
  villain: { card: 'passed-villain border-villain bg-villain-bg text-villain-text', badge: 'bg-villain text-villain-on-accent', label: 'text-villain', muted: 'text-villain-muted', title: 'Te superan en el lado oscuro', Icon: Ghost },
  depth: { card: 'passed-depth border-app-text bg-app-surface text-app-text', badge: 'bg-app-text text-app-surface', label: 'text-app-muted', muted: 'text-app-muted', title: 'Pierdes profundidad', Icon: ChevronsDown },
}
export const RANK_NAME: Record<RankMetric, string> = { hero: 'HERO', villain: 'VILLAIN', depth: 'profundidad' }


export function liveText(toast: Toast | null, o: Overtake | null): string {
  if (toast) return toast.detail ? `${toast.title}. ${toast.detail}` : toast.title
  if (!o) return ''
  const where = `${o.position}.º en ${o.party}`
  if (o.lost) return `${PASSED[o.lost].title}: ${o.names.join(', ')} te ${o.names.length > 1 ? 'superan' : 'supera'} en ${RANK_NAME[o.lost]} · ${where}`
  return `${o.position === 1 ? 'Líder de la party' : 'Adelantamiento'}: Superas a ${o.names.join(', ')} · ${where}`
}
