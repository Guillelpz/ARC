import type { ActivityEvent, Branch, GameState, LevelInfo, Tracker, TrackerStats } from './types'
import { TRACKERS } from './trackers'
import { trackerStats } from './stats'

export const THRESHOLD = { activity: 60, branch: 200, player: 250 } as const

export const levelInfo = (xp: number, threshold: number): LevelInfo => ({
  xp, threshold,
  level: 1 + Math.floor(xp / threshold),
  xpInLevel: xp % threshold,
  progress: (xp % threshold) / threshold,
})

export function deriveGame(events: ActivityEvent[], today: string, trackers: Tracker[] = TRACKERS): GameState {
  const stats: TrackerStats[] = trackers.map(t => {
    const s = trackerStats(t, events, today)
    return { tracker: t, ...s, xp: levelInfo(s.allTime * t.xpPerUnit, THRESHOLD.activity) }
  })
  const of = (b: Branch) => stats.filter(s => s.tracker.branch === b)
  const heroXp = of('hero').reduce((a, s) => a + s.xp.xp, 0)
  const villainXp = of('villain').reduce((a, s) => a + s.xp.xp, 0)
  const playerXp = heroXp + villainXp
  return {
    trackers: stats,
    hero: levelInfo(heroXp, THRESHOLD.branch),
    villain: levelInfo(villainXp, THRESHOLD.branch),
    player: levelInfo(playerXp, THRESHOLD.player),
    heroPct: playerXp ? Math.round((heroXp / playerXp) * 100) : null,
    weeklyHeroXp: of('hero').reduce((a, s) => a + s.week * s.tracker.xpPerUnit, 0),
  }
}

export const weeklyXp = (g: GameState, b: Branch): number =>
  g.trackers.filter(s => s.tracker.branch === b).reduce((a, s) => a + s.week * s.tracker.xpPerUnit, 0)

type LevelDiff = { title: string; detail: string } | null

function diffLevels(before: GameState, after: GameState, down: boolean): LevelDiff {
  const moved = (a: LevelInfo, b: LevelInfo) => (down ? b.level < a.level : b.level > a.level)
  const label = down ? 'LEVEL DOWN' : 'LEVEL UP'
  const ups = after.trackers
    .filter((s, i) => moved(before.trackers[i].xp, s.xp))
    .map(s => `${s.tracker.name} Lv. ${s.xp.level}`)
  if (moved(before.hero, after.hero)) ups.push(`Hero Lv. ${after.hero.level}`)
  if (moved(before.villain, after.villain)) ups.push(`Villain Lv. ${after.villain.level}`)
  if (moved(before.player, after.player)) return { title: `${label} — PLAYER ${after.player.level}`, detail: ups.join(' · ') }
  return ups.length ? { title: label, detail: ups.join(' · ') } : null
}

export const diffLevelUps = (before: GameState, after: GameState) => diffLevels(before, after, false)
export const diffLevelDowns = (before: GameState, after: GameState) => diffLevels(before, after, true)
