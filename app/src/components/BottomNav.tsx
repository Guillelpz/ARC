import { House, Moon, Shield, Sparkles, User, Users, type LucideIcon } from 'lucide-react'

export type Screen = 'home' | 'hero' | 'villain' | 'new' | 'party' | 'me' | 'gym' | 'food'

const ITEMS: { screen: Screen; label: string; Icon: LucideIcon }[] = [
  { screen: 'home', label: 'Inicio', Icon: House },
  { screen: 'hero', label: 'HERO', Icon: Shield },
  { screen: 'villain', label: 'VILLAIN', Icon: Moon },
  { screen: 'new', label: 'Nuevo', Icon: Sparkles },
  { screen: 'party', label: 'Party', Icon: Users },
  { screen: 'me', label: 'Yo', Icon: User },
]

export function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  return (
    <nav aria-label="Principal" className="vt-nav fixed inset-x-0 bottom-0 z-40 border-t border-app-border bg-app-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-6">
        {ITEMS.map(({ screen: s, label, Icon }) => {
          const active = screen === s || (s === 'me' && (screen === 'gym' || screen === 'food')) // Gym y Comida cuelgan de «Yo»
          return (
          <li key={s}>
            <button
              type="button"
              onClick={() => onChange(s)}
              aria-current={active ? 'page' : undefined}
              className={`group relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs transition duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-app-text ${
                active ? 'font-semibold text-app-text' : 'text-app-muted hover:text-app-text'}`}
            >
              <Icon className={`size-5 transition duration-150 group-active:scale-90 motion-reduce:transform-none ${active ? '-translate-y-0.5' : ''}`} aria-hidden />
              <span data-label className="block w-full whitespace-nowrap text-center">{label}</span>
              {active && <span aria-hidden className="vt-tab absolute inset-x-3 top-0 h-0.5 rounded-full bg-app-text" />}
            </button>
          </li>
          )
        })}
      </ul>
    </nav>
  )
}
