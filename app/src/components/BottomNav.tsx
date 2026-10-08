import { House, Moon, Shield, Sparkles, Users, type LucideIcon } from 'lucide-react'

export type Screen = 'home' | 'hero' | 'villain' | 'new' | 'party'

const ITEMS: { screen: Screen; label: string; Icon: LucideIcon }[] = [
  { screen: 'home', label: 'Inicio', Icon: House },
  { screen: 'hero', label: 'HERO', Icon: Shield },
  { screen: 'villain', label: 'VILLAIN', Icon: Moon },
  { screen: 'new', label: 'Nuevo', Icon: Sparkles },
  { screen: 'party', label: 'Party', Icon: Users },
]

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  return (
    <nav aria-label="Principal" className="vt-nav fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ screen: s, label, Icon }) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onChange(s)}
              aria-current={screen === s ? 'page' : undefined}
              className={`group relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs transition duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text ${
                screen === s ? 'font-semibold text-app-text' : 'text-app-muted hover:text-app-text'}`}
            >
              <Icon className={`size-5 transition duration-150 group-active:scale-90 motion-reduce:transform-none ${screen === s ? '-translate-y-0.5' : ''}`} aria-hidden />
              {label}
              {screen === s && <span aria-hidden className="vt-tab absolute inset-x-3 top-0 h-0.5 rounded-full bg-app-text" />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
