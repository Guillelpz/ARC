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
  weeklyLimit?: number // solo VILLAIN, entero ≥ 1; ausente = sin límite. Solo avisa: no afecta a XP, rachas ni party
  custom?: true
  archived?: boolean // ausente = activo
  pastGoals?: PastGoal[] // derivado en allTrackers desde custom.goalLog, orden ascendente por until; nunca se persiste
}

export type GoalLogEntry = { trackerId: string; goal: number | null; until: string } // until: lunes YYYY-MM-DD, exclusivo; goal rige en semanas < until (null = sin objetivo)
export type PastGoal = Omit<GoalLogEntry, 'trackerId'>

export type TrackerEdit = { name: string; increment: number; weeklyGoal: number | null; weeklyLimit?: number | null } // weeklyGoal null = sin objetivo; weeklyLimit undefined = no tocar, null = sin límite

export type ActivityEvent = {
  id: string
  trackerId: string
  amount: number
  occurredAt: string // 'YYYY-MM-DDTHH:mm:ss' local, sin zona
  undoes?: string    // id del evento positivo que este negativo deshace
}

export type WeekRow = {
  monday: string        // YYYY-MM-DD, lunes de la semana
  total: number         // neto de la semana; la en curso, hasta today incluido
  goal: number | null   // objetivo vigente (en curso: t.weeklyGoal; pasadas: goalAt); null sin objetivo actual
  met: boolean          // goal !== null && total >= goal
  current: boolean      // true solo en la última fila
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
  over: number | null // unidades por encima de weeklyLimit en la semana en curso; null = sin límite
  xp: LevelInfo
}

export type TodaySummary = {
  xp: Record<Branch, number>                       // neto de hoy por rama
  done: { tracker: Tracker; amount: number; undo?: ActivityEvent }[] // neto de hoy > 0, en el orden de game.trackers; undo: último registro de hoy que se puede deshacer entero
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
export type Limits = Record<string, number> // trackerId fijo VILLAIN → weeklyLimit (entero ≥ 1)
export type CustomData = { trackers: Tracker[]; proposals: Proposal[]; goals?: Goals; goalLog?: GoalLogEntry[]; limits?: Limits } // goals/goalLog ausentes = sin overrides/cambios registrados

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

export type BranchWeek = {
  monday: string    // YYYY-MM-DD
  hero: number      // XP neta de la semana (en curso: hasta today incluido)
  villain: number
  current: boolean  // solo la última
}

export type WeightUnit = 'kg' | 'lbs'
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core'
export type Exercise = { id: string; name: string; group: MuscleGroup; kind: 'load' | 'bodyweight'; archived?: boolean }
// weight: kg o lbs según unit, ≥ 0, ≤ 2000, 2 decimales máx.; en 'bodyweight' es el lastre (0 = sin lastre). reps: entero 1..999
export type GymSet = { id: string; exerciseId: string; weight: number; unit: WeightUnit; reps: number; occurredAt: string }
export type GymUndo = { id: string; undoes: string; occurredAt: string } // occurredAt = el de la serie anulada
export type GymEntry = GymSet | GymUndo
export type RoutineItem = { exerciseId: string; sets: number } // sets: entero 1..10
export type Routine = { id: string; name: string; items: RoutineItem[] } // id 'routine-<uuid>'; 1..20 ítems; exerciseId únicos
export type GymData = { log: GymEntry[]; exercises: Exercise[]; unit?: WeightUnit; routines?: Routine[] } // exercises: solo los propios; unit ausente = 'kg'; routines ausente = ninguna
export type RecordKind = 'weight' | '1rm' | 'reps'
export type GymRecords = { maxWeight: GymSet | null; best1rm: { set: GymSet; kg: number } | null; mostReps: GymSet | null }
export type WeekBest = { monday: string; kg: number | null; current: boolean } // kg: mejor 1RM estimado de la semana, en kg; null = sin dato
export type GroupVolume = { group: MuscleGroup; label: string; sets: number; kg: number; prevSets: number; prevKg: number }
export type GymDay = { sets: number; exercises: number } // series vivas de un día y ejercicios distintos

// Comida (spec eliminada en el ciclo 30; ver git)
export type FoodBase = 'g' | 'ml'
export type Nutrients = { kcal: number; p: number; c: number; f: number } // p/c/f en g
export type Serving = { name: string; qty: number } // qty en g o ml de la base, (0, 2000]
// Valores por 100 de `base`. kcal 0..900, p/c/f 0..100.
export type Food = Nutrients & {
  id: string            // catálogo: kebab estable (nunca empieza por 'food-'); propios: 'food-<uuid>'
  name: string          // 1..40
  base: FoodBase
  servings?: Serving[]  // 0..5
  aliases?: string[]    // 0..10, 1..40 c/u
  source?: string       // catálogo: 'usda' | 'bedca'; propios: ausente = 'user' (≤ 20)
  ref?: string          // fdcId, código BEDCA o código de barras (≤ 100)
  archived?: boolean    // solo propios
}
export type Portion = { qty: number; serving?: { name: string; n: number } } // qty en g/ml (0, 2000]; serving.n 0.25..50 → qty = n·serving.qty
export type FoodEntry = Partial<Omit<Nutrients, 'kcal'>> & Portion & {
  id: string
  occurredAt: string    // 'YYYY-MM-DDTHH:mm:ss'
  name: string          // instantánea, 1..60
  kcal: number          // 0..20000, 1 decimal
  foodId?: string       // ausente = añadido rápido
  base?: FoodBase       // presente si hay foodId
  via?: string          // ausente = a mano; 'meal' (ciclo 30); 'copy' (ciclo 39); fase 3: 'voice'
}
export type FoodUndo = { id: string; undoes: string; occurredAt: string } // occurredAt = el de la entrada
export type FoodLogEntry = FoodEntry | FoodUndo
export type FoodGoal = { from: string; kcal: number; p: number; c: number; f: number } // kcal entero 800..10000; % enteros que suman 100
export type MealItem = { foodId: string; qty: number; serving?: { name: string; n: number } }
export type Meal = { id: string; name: string; items: MealItem[] } // 'meal-<uuid>'; name 1..40; 1..20 ítems
export type FoodData = { log: FoodLogEntry[]; foods: Food[]; goals?: FoodGoal[]; meals?: Meal[] }
export type DietChange = 1 | -1 | 0 // efecto en Dieta de un cambio: +1 entra en rango, −1 sale, 0 nada
export type FoodDay = Nutrients & { entries: number } // suma de entradas vivas
export type FoodWeek = { monday: string; days: number; avg: Nutrients | null; goal: number | null; inRange: number; current: boolean }
