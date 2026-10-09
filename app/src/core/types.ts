export type Branch = 'hero' | 'villain'

export type Tracker = {
  id: string
  name: string
  branch: Branch
  type: 'count' | 'distance' | 'duration' | 'custom'
  unit: string
  increment: number
  buttonLabel: string
  xpPerUnit: number
  weeklyGoal?: number
  custom?: true
  archived?: boolean // ausente = activo
  pastGoals?: PastGoal[] // derivado en allTrackers desde custom.goalLog, orden ascendente por until; nunca se persiste
}

export type GoalLogEntry = { trackerId: string; goal: number | null; until: string } // until: lunes YYYY-MM-DD, exclusivo; goal rige en semanas < until (null = sin objetivo)
export type PastGoal = Omit<GoalLogEntry, 'trackerId'>

export type TrackerEdit = { name: string; increment: number; weeklyGoal: number | null } // null = sin objetivo

export type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string // 'YYYY-MM-DDTHH:mm:ss' local, sin zona
  undoes?: string    // id del evento positivo que este negativo deshace
}

export type HistoryRow = { event: ActivityEvent; undone: boolean; canUndo: boolean }

export type LevelInfo = {
  xp: number
  level: number
  xpInLevel: number
  threshold: number
  progress: number
}

export type TrackerStats = {
  tracker: Tracker
  week: number
  prev: number
  diff: number
  allTime: number
  goalPct: number | null
  streak: number // semanas seguidas con objetivo cumplido; 0 si no hay objetivo
  xp: LevelInfo
}

export type TodaySummary = {
  xp: Record<Branch, number>                       // neto de hoy por rama
  done: { tracker: Tracker; amount: number }[]     // neto de hoy > 0, en el orden de game.trackers
  missing: { tracker: Tracker; left: number }[]    // con weeklyGoal y week < goal; left = goal − week
  daysLeft: number                                 // 1..7, cuenta hoy
  best: { tracker: Tracker; weeks: number } | null // mayor streak > 0; empate: el primero
}

export type GameState = {
  trackers: TrackerStats[]
  hero: LevelInfo
  villain: LevelInfo
  player: LevelInfo
  heroPct: number | null
  weeklyHeroXp: number
}

export type PartyMember = {
  id: string
  name: string
  isYou?: boolean
  playerLevel: number
  heroLevel: number
  villainLevel: number
  weeklyHeroXp: number
  weeklyVillainXp: number
}

export type RankMetric = 'hero' | 'villain' | 'depth'

export type Friend = PartyMember & { stance: Record<Branch, boolean> }
export type Party = { id: string; name: string; members: Friend[]; seedCriteria: string[] }

export type Proposal = { trackerId: string; partyId: string; proposedAt: string } // 'YYYY-MM-DDTHH:mm:ss'
export type Goals = Record<string, number> // trackerId fijo HERO → weeklyGoal (entero ≥ 1)
export type CustomData = { trackers: Tracker[]; proposals: Proposal[]; goals?: Goals; goalLog?: GoalLogEntry[] } // goals/goalLog ausentes = sin overrides/cambios registrados

export type VoteResult = {
  partyId: string
  accepted: boolean
  yes: number
  total: number
  votes: { name: string; yes: boolean }[]
}

export type PartyState = {
  party: Party
  game: GameState
  criteria: Tracker[]
  rejected: { tracker: Tracker; result: VoteResult }[]
  ranking: PartyMember[]
  position: number
}

export type Confidence = 'alta' | 'media' | 'baja'
export type Classification = {
  branch: Branch
  confidence: Confidence
  reasons: string[]
  reason: string
  type: Tracker['type']
  unit: string
  increment: number
  xpPerUnit: number
  matchId?: string // actividad existente equivalente (sinónimo, otro idioma, errata)
}
export type TrackerDraft = { name: string; branch: Branch; type: Tracker['type']; xpPerUnit: number; unit?: string }
