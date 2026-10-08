import { Moon, Shield } from 'lucide-react'
import type { GameState, LevelInfo } from '../core/types'
import { ProgressBar } from './ProgressBar'

const PANEL = {
  hero: { name: 'HERO', Icon: Shield, box: 'border-hero-border bg-hero-surface text-hero-text', accent: 'text-hero' },
  villain: { name: 'VILLAIN', Icon: Moon, box: 'border-villain-border bg-villain-bg text-villain-text', accent: 'text-villain' },
}

function BranchPanel({ info, branch }: { info: LevelInfo; branch: 'hero' | 'villain' }) {
  const { name, Icon, box, accent } = PANEL[branch]
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${box}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${accent}`}>
          <Icon className="size-4" aria-hidden /> {name} · Lv. {info.level}
        </span>
        <span className="text-sm font-semibold tabular-nums">{info.xp} XP</span>
      </div>
      <ProgressBar value={info.progress} tone={branch} label={`Progreso ${name}`} />
    </div>
  )
}

export function PlayerHeader({ game }: { game: GameState }) {
  const { player, hero, villain, heroPct } = game
  return (
    <header className="flex flex-col gap-4 rounded-xl border border-app-border bg-app-surface p-4 text-app-text shadow-sm sm:p-5">
      <div className="flex items-center gap-4">
        <div
          className="grid size-[72px] shrink-0 place-items-center rounded-full"
          style={{
            background: heroPct === null
              ? 'var(--color-app-track)'
              : `conic-gradient(var(--color-hero) 0 ${heroPct}%, var(--color-villain-bg) 0)`,
          }}
        >
          <div className="grid size-[58px] place-items-center rounded-full bg-app-surface text-2xl font-semibold tabular-nums">
            {player.level}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">YOU</span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">PLAYER Lv. {player.level}</h1>
          <ProgressBar value={player.progress} tone="neutral" label="Progreso PLAYER" />
          <span className="text-xs leading-5 tabular-nums text-app-muted">{player.xpInLevel} / {player.threshold} XP</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <BranchPanel info={hero} branch="hero" />
        <BranchPanel info={villain} branch="villain" />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs leading-5 text-app-muted">Distribución de XP</span>
        {heroPct === null ? (
          <span className="text-sm leading-6">Tu personaje empieza aquí</span>
        ) : (
          <>
            <div className="flex h-2 gap-0.5" aria-hidden>
              <div className="rounded-full bg-hero transition-[width] duration-500 ease-out" style={{ width: `${heroPct}%` }} />
              <div className="flex-1 rounded-full bg-villain-bg" />
            </div>
            <span className="text-sm font-semibold tabular-nums">{heroPct}% HERO · {100 - heroPct}% VILLAIN</span>
          </>
        )}
      </div>
    </header>
  )
}
