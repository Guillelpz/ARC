import { useMemo } from 'react'
import type { FoodData } from '../core/types'
import { fmtKcal, foodWeekly } from '../core/food'
import { shortDate } from '../core/stats'
import { card } from './foodStyle'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const inRangeText = (n: number) => `${n} en rango`

// Resumen semanal: media por día con registros (E1), objetivo de cada semana y días dentro del 90–110 %.
export function FoodWeek({ food, today }: { food: FoodData; today: string }) {
  const weeks = useMemo(() => foodWeekly(food, today), [food, today])
  const cur = weeks[weeks.length - 1]
  const withData = weeks.some(w => w.days > 0)
  const max = Math.max(1, ...weeks.flatMap(w => [w.avg?.kcal ?? 0, w.goal ?? 0]))
  const bw = 88 / weeks.length, x = (i: number) => 6 + i * bw, y = (k: number) => 36 - (k / max) * 30 // 6..36 del viewBox 100×40
  const g = (n: number) => Math.round(n)

  return (
    <section aria-labelledby="food-week" className={card}>
      <h2 id="food-week" className="text-base font-semibold">Semana</h2>
      {!withData ? <p className="text-sm text-hero-muted">Aún no hay semanas con registros.</p> : (
        <>
          {cur.avg ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-hero-muted">Esta semana, media por día con registros</p>
              <p className="text-2xl font-semibold tabular-nums">{fmtKcal(cur.avg.kcal)}{cur.goal ? ` / ${fmtKcal(cur.goal)}` : ''} kcal/día</p>
              <p className="text-sm text-hero-muted tabular-nums">P {g(cur.avg.p)} g · C {g(cur.avg.c)} g · G {g(cur.avg.f)} g</p>
              <p className="text-sm font-semibold tabular-nums">{plural(cur.days, 'día', 'días')} · {inRangeText(cur.inRange)}</p>
            </div>
          ) : <p className="text-sm text-hero-muted">Esta semana aún no has apuntado nada.</p>}
          <svg viewBox="0 0 100 40" className="h-28 w-full text-hero" aria-hidden>
            <line x1="4" x2="96" y1="36" y2="36" stroke="currentColor" strokeWidth="0.4" opacity="0.4" />
            {weeks.map((w, i) => w.avg && (
              <rect key={w.monday} x={x(i) + bw * 0.15} width={bw * 0.7} y={y(w.avg.kcal)} height={Math.max(0.6, 36 - y(w.avg.kcal))} rx="0.8"
                fill={w.current ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth="0.8" strokeDasharray={w.current ? '1.6 1.2' : undefined} />
            ))}
            {weeks.map((w, i) => w.goal !== null && w.days > 0 && (
              <line key={`g${w.monday}`} x1={x(i)} x2={x(i) + bw} y1={y(w.goal)} y2={y(w.goal)} className="stroke-hero-text" strokeWidth="1" />
            ))}
          </svg>
          <p className="text-xs text-hero-muted">Media de kcal por semana; la marca horizontal es el objetivo de esa semana.</p>
          <ul className="sr-only">
            {weeks.map(w => (
              <li key={w.monday}>
                {w.avg
                  ? `Semana del ${shortDate(w.monday)}${w.current ? ' (en curso)' : ''}: media ${fmtKcal(w.avg.kcal)} kcal en ${plural(w.days, 'día', 'días')}${w.goal ? ` · objetivo ${fmtKcal(w.goal)}` : ''} · ${inRangeText(w.inRange)}`
                  : `Semana del ${shortDate(w.monday)}${w.current ? ' (en curso)' : ''}: sin registros`}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
