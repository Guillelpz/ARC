import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { transition } from './viewTransition'
import type { ActivityEvent, CustomData, Exercise, FoodData, GymData, GymSet, RecordKind, Routine, Tracker, WeightUnit } from './core/types'
import { seedFor } from './core/seed'
import { mergeBackup } from './core/merge'
import { branchWeekly, clampAmount, localDate, todaySummary, undoneIds } from './core/stats'
import { EXERCISES, GYM_TRACKER, allExercises, autoSession, beaten, ensureAuto, exerciseName, recordText, retractAuto, liveSets, setDays, gymDay, undoMany } from './core/gym'
import { DIET_TRACKER, dietActive, dietDays, dietSync, withDiet } from './core/food'
import { EMPTY_CUSTOM, EMPTY_FOOD, EMPTY_GYM, backupCurrent, backupDue, exportBackup, hasLastBackup, isDataKey, loadAll, loadLastExport, loadVoicePrefs, saveVoicePrefs, loadFoodPrivacy, saveFoodPrivacy, loadAiKey, hasAiKeyEntry, saveAiKey, clearAiKey, readAiKey, loadMemo, saveMemo, clearMemo, META_KEY, parseBackup, readLast, requestPersist, lockStorage, restoreLast, saveCustom, saveEvents, saveGym, saveLastExport, unlockStorage, type LoadProblem } from './core/storage'
import { useFood, foodCount } from './useFood'
import { forget, learn } from './core/memory'
import { fetchOff } from './core/off'
import { askLabel, type LabelResult } from './core/label'
import { downscale } from './image'
import { askHaiku, interpretCapture, interpretGym, type HaikuError } from './core/haiku'
import type { CaptureCommand, NewHabit } from './core/capture'
import type { FoodItem } from './core/foodVoice'
import { TYPE_DEFAULTS, createTracker } from './core/classify'
import { beginListen } from './speech'
import type { GymDraft, VoiceCommand } from './core/voice'
import { deriveGame, diffLevelDowns, diffLevelUps } from './core/rpg'
import { allTrackers, defaultGoal, logGoal, setGoal, setLimit } from './core/trackers'
import { PARTIES, buildRanking, derivePartyState, overtakes, proposeTo } from './core/party'
import { BottomNav, type Screen } from './components/BottomNav'
import { HomeView } from './components/HomeView'
import { MissionsView } from './components/MissionsView'
import { UnknownView } from './components/UnknownView'
import { CaptureView, type CaptureStart } from './components/CaptureView'
import { PartyView } from './components/PartyView'
import { editNote, incompleteNote } from './components/voiceNotes'
import { MeView } from './components/MeView'
import type { VoiceMissing } from './components/voiceNotes'
import { GymView } from './components/GymView'
import { FoodView } from './components/FoodView'
import type { Gain } from './components/TrackerCard'
import { SAVE_FAIL_TEXT } from './components/SaveFailBanner'
import { STALE_TAB_TEXT, UpdateBanner } from './components/UpdateBanner'
import { registerSW } from './pwa'
import { liveText } from './components/liveText'
import { LevelUpToast, OvertakeBanner, PassedBanner, RecordBanner, type Overtake, type RecordNotice, type Toast } from './components/LevelUpToast'

const uuid = () => crypto.randomUUID()
// fuera del componente: solo se llama desde manejadores de eventos
const nowStamp = (day?: string, d = new Date()) => `${day ?? localDate(d)}T${d.toTimeString().slice(0, 8)}`

const STALE_BLOCK_TEXT = 'Recarga la página antes de cambiar tus datos.'
const noticeFor = (problems: LoadProblem[]) => !problems.length ? null
  : problems.some(p => p.backupKey === null)
    ? 'Parte de tus datos guardados no se pudo leer ni copiar. Tus cambios no se guardarán en este navegador hasta que importes una copia.'
    : problems.every(p => p.dropped === 0)
    ? 'Hemos corregido algunos datos guardados con campos no válidos; no se ha perdido ningún registro. El original está copiado aparte en este navegador.'
    : 'Parte de tus datos guardados no se pudo leer. El original está copiado aparte en este navegador. Exporta una copia para conservar lo que ves.'

export default function App() {
  const [loaded] = useState(loadAll)
  const [update, setUpdate] = useState(false)
  const [stale, setStale] = useState(false)
  useEffect(() => registerSW(() => setUpdate(true)), [])
  const [events, setEvents] = useState<ActivityEvent[]>(loaded.events)
  const [custom, setCustom] = useState<CustomData>(loaded.custom)
  const [gym, setGym] = useState<GymData>(loaded.gym)
  const [notice, setNotice] = useState<string | null>(() => noticeFor(loaded.problems))
  const [screen, setScreen] = useState<Screen>('home')
  const [focusCard, setFocusCard] = useState<'gym' | 'food' | null>(null) // al volver de un módulo abierto desde «Yo»: el foco va a su tarjeta
  const [focusHoy, setFocusHoy] = useState(false) // true al volver de un módulo abierto desde «Hoy»: el foco va al encabezado «Hoy»
  const [moduleFrom, setModuleFrom] = useState<'me' | 'home'>('me') // desde dónde se abrió Gym o Comida
  const [gymPrefill, setGymPrefill] = useState<{ draft: GymDraft; note: string } | null>(null) // borrador de la voz en «Hoy» que abre Gym prerrellenado
  const [foodPrefill, setFoodPrefill] = useState<{ heard: string; items: FoodItem[] } | null>(null) // ítems de la voz que abren Comida con pendientes
  const [newMode, setNewMode] = useState<'capture' | 'manual'>('capture') // pantalla «Nuevo»: captura por voz o formulario a mano
  const [manualText, setManualText] = useState('')
  const [capture, setCapture] = useState<{ key: number; start: CaptureStart }>({ key: 0, start: { mode: 'idle' } })
  const captureBusy = useRef(false)
  const [partyId, setPartyId] = useState(PARTIES[0].id)
  const [toast, setToast] = useState<Toast | null>(null)
  const [gain, setGain] = useState<Gain | null>(null)
  const [overtake, setOvertake] = useState<Overtake | null>(null)
  const [record, setRecord] = useState<RecordNotice | null>(null)
  const [canRestore, setCanRestore] = useState(hasLastBackup)
  const [lastExport, setLastExport] = useState(loadLastExport)
  const [voiceAck, setVoiceAck] = useState(() => loadVoicePrefs().privacyAck !== undefined)
  const keyState = () => { const k = loadAiKey(); return { hint: k ? k.slice(-4) : null, invalid: !k && hasAiKeyEntry() } }
  const [aiKey, setAiKey] = useState(keyState) // solo los últimos 4 caracteres: la clave entera se lee con loadAiKey() dentro de los manejadores
  const saveKey = (key: string): 'ok' | 'format' | 'save' => {
    if (!readAiKey(key)) return 'format'
    if (!saveAiKey(key)) return 'save'
    setAiKey(keyState()); return 'ok'
  }
  const clearKey = () => { clearAiKey(); setAiKey(keyState()) }
  async function testKey(): Promise<HaikuError | 'ok'> {
    const key = loadAiKey()
    if (!key) return 'auth'
    const r = await askHaiku('press banca 80 kg 5 repeticiones', EXERCISES, 'kg', key)
    return r.ok ? (r.draft.exerciseId === 'bench-press' ? 'ok' : 'invalid') : r.error
  }
  const [foodAck, setFoodAck] = useState(loadFoodPrivacy)
  const readLabel = async (file: File): Promise<LabelResult> => {
    if (navigator.onLine === false) return { ok: false, error: 'network' }
    const img = await downscale(file)
    if (!img) return { ok: false, error: 'image' }
    const key = loadAiKey()
    return key ? askLabel(img.data, key) : { ok: false, error: 'auth' }
  }
  const ackFood = (k: 'off' | 'label') => { const next = { ...loadFoodPrivacy(), [k]: new Date().toISOString() }; saveFoodPrivacy(next); setFoodAck(next) }
  const ackVoice = () => { saveVoicePrefs({ ...loadVoicePrefs(), privacyAck: new Date().toISOString() }); setVoiceAck(true) }

  const [, refresh] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
  // ponytail: «hoy» se recalcula en cada render y al volver a la pestaña; con la app visible
  // pasada la medianoche y sin tocar nada, la pantalla muestra el día anterior hasta la siguiente
  // interacción. Añadir un timer a medianoche si molesta.
  const now = new Date(); const today = localDate(now)
  const { food, setFood, unsaved: foodUnsaved, foodToday, handlers: foodHandlers } = useFood(loaded.food, { events, today, stamp: nowStamp, pushDiet })
  const hasData = events.length > 0 || custom.trackers.length > 0 || Object.keys(custom.goals ?? {}).length > 0 || (custom.goalLog?.length ?? 0) > 0 || Object.keys(custom.limits ?? {}).length > 0 || gym.log.length > 0 || gym.exercises.length > 0 || (gym.routines?.length ?? 0) > 0 || food.log.length > 0 || food.foods.length > 0 || (food.goals?.length ?? 0) > 0 || (food.meals?.length ?? 0) > 0
  const copy = backupDue(lastExport, now, hasData)

  const [unsaved, setUnsaved] = useState({ events: false, custom: false, gym: false }) // false en cada clave con su siguiente guardado correcto
  // ponytail: setState dentro del efecto de guardado (aviso de lint aceptado); guardar en cada handler evitaría el render extra, a costa de tocar todos los setEvents/setCustom
  // oxlint-disable-next-line react/set-state-in-effect -- ver ponytail
  useEffect(() => { const ok = saveEvents(events); if (ok !== null) setUnsaved(u => (u.events === !ok ? u : { ...u, events: !ok })) }, [events])
  // oxlint-disable-next-line react/set-state-in-effect -- ver ponytail
  useEffect(() => { const ok = saveCustom(custom); if (ok !== null) setUnsaved(u => (u.custom === !ok ? u : { ...u, custom: !ok })) }, [custom])
  // oxlint-disable-next-line react/set-state-in-effect -- ver ponytail
  useEffect(() => { const ok = saveGym(gym); if (ok !== null) setUnsaved(u => (u.gym === !ok ? u : { ...u, gym: !ok })) }, [gym])
  const saveFailed = unsaved.events || unsaved.custom || unsaved.gym || foodUnsaved
  // ponytail: si dos pestañas escriben en menos tiempo del que tarda en llegar el evento `storage`, la última escritura pisa a la otra.
  // Cerrarlo de verdad exige fusionar eventos o Web Locks.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === META_KEY) return setLastExport(loadLastExport())
      if (!isDataKey(e.key)) return
      const r = loadAll()
      setCanRestore(hasLastBackup()); setLastExport(loadLastExport())
      if (r.problems.length) { lockStorage(); return setStale(true) } // no pisar lo de la otra pestaña: recargar lo lee (original en .backup.<stamp>)
      unlockStorage(); setStale(false) // lo guardado se ha leído entero: guardar ya no destruye nada
      setEvents(r.events); setCustom(r.custom); setGym(r.gym); setFood(r.food)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [setFood])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(id)
  }, [toast])
  useEffect(() => {
    if (!gain) return
    const id = setTimeout(() => setGain(null), 900) // = duración de .float-xp
    return () => clearTimeout(id)
  }, [gain])
  // el banner espera a que termine el level-up: una celebración cada vez
  // el banner de récord también espera a level-up y adelantamientos
  useEffect(() => {
    if (!record || toast || overtake) return
    const id = setTimeout(() => setRecord(null), 3200)
    return () => clearTimeout(id)
  }, [record, toast, overtake])
  useEffect(() => {
    if (!overtake || toast) return
    const id = setTimeout(() => setOvertake(null), 3200)
    return () => clearTimeout(id)
  }, [overtake, toast])

  const dietTracker = () => trackers.find(t => t.id === DIET_TRACKER)!
  function pushDiet(evs: ActivityEvent[]) { push(evs, dietTracker()) }
  const active = dietActive(food, events) // B1: Dieta oculta mientras no haya objetivo ni eventos (derivado, no se persiste)
  const trackers = useMemo(() => withDiet(allTrackers(custom.trackers, custom.goals, custom.goalLog, custom.limits), active), [custom.trackers, custom.goals, custom.goalLog, custom.limits, active])
  const game = useMemo(() => deriveGame(events, today, trackers), [events, today, trackers])
  const weeks = useMemo(() => branchWeekly(events, trackers, today), [events, trackers, today])
  const gymToday = useMemo(() => gymDay(gym.log, today), [gym.log, today])
  const summary = useMemo(() => todaySummary(events, game.trackers, today), [events, game, today])
  const partyStates = useMemo(
    () => PARTIES.map(p => derivePartyState(p, events, today, trackers, custom.proposals)),
    [events, today, trackers, custom.proposals],
  )

  function go(s: Screen) {
    if (s === screen) return window.scrollTo(0, 0)
    transition(() => { setScreen(s); window.scrollTo(0, 0) }, 'screen')
  }

  // Se llama SÍNCRONO desde el onClick (+, Nuevo, Dictar): el reconocimiento tiene que arrancar dentro del gesto (iOS), antes de la transición.
  function openCapture() {
    if (captureBusy.current && screen === 'new' && newMode === 'capture') return // ya escucha o procesa: solo se navega
    const start: CaptureStart = voiceAck ? beginListen() : { mode: 'privacy' }
    setCapture(c => ({ key: c.key + 1, start })); setNewMode('capture')
    setFocusCard(null); setFocusHoy(false); setGymPrefill(null); setFoodPrefill(null); go('new')
  }
  const openManual = (text = '') => { setManualText(text); setNewMode('manual'); setFocusCard(null); setFocusHoy(false); setGymPrefill(null); setFoodPrefill(null); go('new') }
  const goTo = (s: Screen) => { if (s === 'new') return openCapture(); setFocusCard(null); setFocusHoy(false); setGymPrefill(null); setFoodPrefill(null); go(s) }
  const openGym = (from: 'me' | 'home') => { setModuleFrom(from); goTo('gym') }
  const openFood = (from: 'me' | 'home') => { setModuleFrom(from); goTo('food') }
  // Comida prerrellenada por la voz (captura): los ítems llegan como pendientes. Vuelve a «Hoy», como Gym con `openGymWith`.
  const openFoodWith = (items: FoodItem[], heard: string) => { setFoodPrefill({ heard, items }); setModuleFrom('home'); setFocusCard(null); setFocusHoy(false); go('food') }
  const backFromGym = () => { setGymPrefill(null); if (moduleFrom === 'home') { setFocusHoy(true); go('home') } else { setFocusCard('gym'); go('me') } }
  const backFromFood = () => { setFoodPrefill(null); if (moduleFrom === 'home') { setFocusHoy(true); go('home') } else { setFocusCard('food'); go('me') } }

  // evs: uno o varios eventos de un mismo tracker ya validados (clampAmount) que se guardan juntos
  function push(evs: ActivityEvent[], t: Tracker, list = trackers) {
    const next = [...events, ...evs]
    const amount = evs.reduce((n, e) => n + e.amount, 0), key = evs[evs.length - 1].id
    if (amount === 0) return setEvents(next) // neto 0 (deshacer la sesión de un día con series + sesión automática): sin XP, toast ni animación
    const after = deriveGame(next, today, list)
    const up = amount > 0 ? diffLevelUps(game, after) : diffLevelDowns(game, after)
    setEvents(next) // evento creado fuera del updater (StrictMode)
    setGain({ trackerId: t.id, xp: amount * t.xpPerUnit, branch: t.branch, key })
    if (up) setToast({ ...up, key, down: amount < 0, tone: up.title.includes('— PLAYER') ? 'neutral' : t.branch })
    // adelantamientos: tú superas a alguien (ranking HERO) o alguien te supera en HERO/VILLAIN/profundidad
    for (const [i, p] of PARTIES.entries()) {
      const before = partyStates[i]
      const after = derivePartyState(p, next, today, list, custom.proposals)
      const names = overtakes(after.ranking, before.ranking)
      if (names.length) { setOvertake({ key, party: p.name, names, position: after.position }); break }
      const lost = ([t.branch, 'depth'] as const).map(metric => {
        const a = buildRanking(after.game, p.members, metric, today)
        const names = overtakes(buildRanking(before.game, p.members, metric, today), a)
        return { key, party: p.name, names, position: a.findIndex(m => m.isYou) + 1, lost: metric }
      }).find(o => o.names.length)
      if (lost) { setOvertake(lost); break }
    }
  }

  // amount < 0 = corrección (evento negativo); no deja el día por debajo de 0
  // undo = registro positivo que se anula entero
  function add(t: Tracker, amount: number, day = today, undo?: ActivityEvent): number {
    if (day > today) day = today
    if (undo && undoneIds(events).has(undo.id)) return 0
    amount = clampAmount(events, t.id, day, amount)
    if (!amount || (undo && amount !== -undo.amount)) return 0
    const ev: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount,
      occurredAt: undo ? undo.occurredAt : nowStamp(day), ...(undo && { undoes: undo.id }) }
    // Regla: día con series vivas ⇒ al menos 1 sesión de Gym. Si el deshacer o el «−» la rompe, se repone en el mismo guardado (neto 0).
    const extra = t.id === GYM_TRACKER && amount < 0 ? ensureAuto([...events, ev], gym.log, [day])
      : t.id === DIET_TRACKER && amount < 0 ? dietSync([...events, ev], food, [day], today, uuid) : [] // Dieta: «−» manual de un día en rango → se repone la automática (neto 0)
    push([ev, ...extra], t)
    return amount + extra.length
  }

  const r2 = (x: number) => Math.round(x * 100) / 100
  const gymTracker = () => trackers.find(t => t.id === GYM_TRACKER)!
  // n series iguales con el mismo `occurredAt`; un solo setGym. Solo la primera puede batir récord (las siguientes son iguales).
  function addSets(input: Omit<GymSet, 'id' | 'occurredAt'>, n: number, day: string): { ids: string[]; kinds: RecordKind[]; auto: boolean } {
    if (day > today) day = today
    const at = nowStamp(day)
    const sets: GymSet[] = Array.from({ length: n }, () => ({ id: crypto.randomUUID(), ...input, weight: r2(input.weight), occurredAt: at }))
    const kinds = beaten(liveSets(gym.log).filter(s => s.exerciseId === input.exerciseId), sets[0])
    setGym({ ...gym, log: [...gym.log, ...sets] })
    // la regla «series vivas ⇒ ≥ 1 sesión» la cumple también `add` (deshacer o «−» de la sesión): ver ensureAuto
    const ev = autoSession(events, day)
    if (ev) push([ev], gymTracker())
    if (kinds.length) {
      const x = allExercises(gym.exercises).find(e => e.id === input.exerciseId)
      setRecord({ key: sets[0].id, text: recordText(kinds, sets[0], exerciseName(input.exerciseId, gym.exercises), gym.unit ?? 'kg', x?.kind ?? 'load') })
    }
    return { ids: sets.map(s => s.id), kinds, auto: !!ev }
  }
  const addSet = (input: Omit<GymSet, 'id' | 'occurredAt'>, day: string) => addSets(input, 1, day)
  // Deshace de una vez las series vivas de `ids`; la sesión automática solo se retira si el día se queda sin series vivas.
  function undoSets(ids: string[]): { undone: number; retracted: boolean } {
    const us = undoMany(gym.log, ids, () => crypto.randomUUID())
    if (us.length === 0) return { undone: 0, retracted: false }
    const log2 = [...gym.log, ...us]
    setGym({ ...gym, log: log2 })
    const evs = retractAuto(events, log2, us[0].occurredAt.slice(0, 10), () => crypto.randomUUID())
    if (evs.length) push(evs, gymTracker())
    return { undone: us.length, retracted: evs.length > 0 }
  }
  const undoSet = (s: GymSet) => undoSets([s.id])
  // Voz: el comando ya está completo (isComplete). Se guarda en la unidad dicha.
  const interpretVoice = (text: string): Promise<VoiceCommand> =>
    interpretGym(text, allExercises(gym.exercises).filter(x => !x.archived), gym.unit ?? 'kg', loadAiKey(), navigator.onLine !== false)
  const saveVoice = (cmd: VoiceCommand, day: string) => {
    const d = cmd.draft
    const r = addSets({ exerciseId: d.exerciseId!, weight: d.weight!, unit: d.unit, reps: d.reps! }, d.sets, day)
    return { ids: r.ids, auto: r.auto }
  }
  const setUnit = (u: WeightUnit) => setGym(g => { const { unit: _, ...rest } = g; return u === 'lbs' ? { ...rest, unit: u } : rest })

  const saveRoutine = (r: Routine) => setGym(g => ({ ...g, routines: [...(g.routines ?? []), r] }))
  const deleteRoutine = (id: string) => setGym(g => {
    const { routines: _, ...rest } = g
    const left = (g.routines ?? []).filter(r => r.id !== id)
    return left.length ? { ...rest, routines: left } : rest // sin rutinas: se omite el campo
  })

  const createExercise = (e: Exercise) => setGym(g => ({ ...g, exercises: [...g.exercises, e] }))
  const setExerciseArchived = (id: string, archived: boolean) => setGym(g => ({ ...g, exercises: g.exercises.map(x => {
    if (x.id !== id) return x
    const { archived: _, ...rest } = x
    return archived ? { ...rest, archived: true } : rest
  }) }))

  const activeExercises = allExercises(gym.exercises).filter(x => !x.archived)
  const openGymWith = (draft: GymDraft, note: string) => { setGymPrefill({ draft, note }); setModuleFrom('home'); setFocusCard(null); setFocusHoy(false); go('gym') }
  const interpretCapt = (text: string): Promise<CaptureCommand> =>
    interpretCapture(text, { exercises: activeExercises, trackers: trackers.filter(t => !t.archived), all: trackers, unit: gym.unit ?? 'kg', memo: loadMemo(), foods: food.foods }, loadAiKey(), navigator.onLine !== false)
  const learnCapture = (c: CaptureCommand) => { const m = loadMemo(), n = learn(m, c); if (n !== m) saveMemo(n) }
  const forgetCapture = (text: string) => { const m = loadMemo(), n = forget(m, text); if (n !== m) saveMemo(n) }

  const undo = (t: Tracker, e: ActivityEvent) => add(t, -e.amount, e.occurredAt.slice(0, 10), e)

  // Captura: apunta hoy y devuelve el evento (para «Deshacer»/«Editar»).
  function captureAdd(trackerId: string, amount: number): ActivityEvent | null {
    const t = trackers.find(x => x.id === trackerId)
    const a = t ? clampAmount(events, t.id, today, amount) : 0
    if (!t || !a) return null
    const ev: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount: a, occurredAt: nowStamp(today) }
    push([ev], t)
    return ev
  }

  const saveTracker = (input: Tracker) => {
    const { pastGoals: _, ...t } = input // derivado: no se persiste
    if (!t.custom && t.branch === 'villain') {
      setCustom(c => {
        const { limits: _l, ...rest } = c
        const limits = setLimit(c.limits, t.id, t.weeklyLimit ?? null)
        return Object.keys(limits).length ? { ...rest, limits } : rest
      })
      return
    }
    setCustom(c => {
      const old = t.custom ? c.trackers.find(x => x.id === t.id)?.weeklyGoal : (c.goals?.[t.id] ?? defaultGoal(t.id))
      let next: CustomData, now: number | undefined
      if (t.custom) { next = { ...c, trackers: c.trackers.map(x => (x.id === t.id ? t : x)) }; now = t.weeklyGoal }
      else {
        const { goals: _g, ...rest } = c
        const goals = setGoal(c.goals, t.id, t.weeklyGoal ?? null)
        next = Object.keys(goals).length ? { ...rest, goals } : rest // sin goals: {}
        now = goals[t.id] ?? defaultGoal(t.id)
      }
      const goalLog = logGoal(c.goalLog, t.id, old ?? null, now ?? null, today)
      return goalLog.length ? { ...next, goalLog } : next
    })
  }
  const unarchive = (t: Tracker) => saveTracker({ ...t, archived: false })
  const archived = useMemo(() => custom.trackers.filter(t => t.archived), [custom.trackers])
  const create = (t: Tracker) => setCustom(c => ({ ...c, trackers: [...c.trackers, t] }))

  // Captura: hábito nuevo + su primer registro; el deshacer lo archiva (no se borra: «Reactivar» lo recupera).
  function captureCreate(h: NewHabit): { tracker: Tracker; event: ActivityEvent } {
    const t = createTracker({ name: h.name, branch: h.branch, type: h.type, unit: h.unit, xpPerUnit: TYPE_DEFAULTS[h.type].xpPerUnit }, `custom-${crypto.randomUUID()}`)
    create(t)
    const event: ActivityEvent = { id: crypto.randomUUID(), trackerId: t.id, amount: h.amount ?? 1, occurredAt: nowStamp(today) }
    push([event], t, [...trackers, t])
    return { tracker: t, event }
  }
  function undoCreate(t: Tracker, ev: ActivityEvent) {
    add(t, -ev.amount, today, ev)
    saveTracker({ ...t, archived: true })
  }

  function propose(trackerId: string, partyIds: string[]) {
    const now = nowStamp()
    setCustom(c => ({ ...c, proposals: proposeTo(c.proposals, trackerId, partyIds, allTrackers(c.trackers, c.goals), now) }))
  }

  // Reglas vivas tras importar, fusionar o recuperar: «día con series ⇒ sesión de Gym» y «día en rango ⇒ +1 Dieta»
  const withAutos = (evs: ActivityEvent[], g: GymData, f: FoodData): ActivityEvent[] => {
    const a = [...evs, ...ensureAuto(evs, g.log, setDays(g.log))]
    return [...a, ...dietSync(a, f, dietDays(f, a), today, uuid)]
  }

  const loadExample = () => setEvents(seedFor(today))

  function reset() {
    if (stale) return setNotice(STALE_BLOCK_TEXT)
    if (copy.due && hasData && window.confirm('No tienes una copia reciente de tus datos. ¿Exportar una antes de borrar? Aceptar exporta y no borra nada; Cancelar sigue con el borrado.')) {
      void exportData().then(ok => setNotice(ok ? 'Copia exportada. Pulsa «Borrar todo» otra vez si quieres borrar.' : 'No se ha exportado la copia y no se ha borrado nada.')); return
    }
    if (!window.confirm('¿Borrar todos tus registros y misiones nuevas? No se puede deshacer. Exporta una copia antes si quieres conservarlos.')) return
    if (hasData && !backupCurrent()) return setNotice('No se pudo guardar la copia interna, así que no se ha borrado nada. Exporta una copia y vuelve a intentarlo.')
    setCanRestore(hasLastBackup())
    clearMemo()
    setEvents([]); setCustom(EMPTY_CUSTOM); setGym(EMPTY_GYM); setFood(EMPTY_FOOD); setToast(null); setGain(null); setOvertake(null); setRecord(null)
  }

  async function exportData(): Promise<boolean> {
    const stamp = new Date().toISOString(), name = `rpg-life-tracker-${stamp.slice(0, 10)}.json`
    const text = exportBackup(events, custom, stamp, gym, food)
    const done = () => { saveLastExport(stamp); setLastExport(stamp); requestPersist(); return true } // requestPersist en el primer gesto (no al arrancar: Firefox muestra un diálogo)
    const file = new File([text], name, { type: 'application/json' })
    // ponytail: Chrome Android no comparte application/json (canShare = false) → descarga. Solo en la app instalada en táctil:
    // en escritorio (incluida la PWA instalada) la hoja de compartir no tiene «Guardar archivo».
    if (window.matchMedia?.('(display-mode: standalone)').matches && window.matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return done() }
      catch (e) { if (e instanceof DOMException && e.name === 'AbortError') { setNotice('No se ha exportado la copia.'); return false } } // NotAllowedError (sin gesto, p. ej. tras confirm) u otro → descarga
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    // ponytail: la descarga cuenta como copia al lanzarse; el navegador no confirma que se guardó.
    return done()
  }

  function importData(text: string) {
    if (stale) return setNotice(STALE_BLOCK_TEXT)
    const b = parseBackup(text)
    if (!b) return setNotice('Ese archivo no es una copia válida de RPG Life Tracker.')
    const n = b.events.length, m = b.custom.trackers.length
    const kLocal = liveSets(gym.log).length, kCopia = b.gym ? liveSets(b.gym.log).length : 0
    const gymText = b.gym === null && kLocal > 0 ? ` Esta copia es anterior al módulo Gym: tus ${kLocal} series de gym también se reemplazan (quedan 0).`
      : kLocal + kCopia > 0 ? ` Series de gym: ${kLocal} → ${kCopia}.` : ''
    const rLocal = gym.routines?.length ?? 0, rCopia = b.gym?.routines?.length ?? 0
    const routinesText = rLocal + rCopia > 0 ? ` Rutinas: ${rLocal} → ${rCopia}.` : ''
    const fLocal = foodCount(food), fCopia = b.food ? foodCount(b.food) : 0
    const foodText = b.food === null && fLocal > 0 ? ` Esta copia es anterior al módulo Comida: tus ${fLocal} entradas de comida también se reemplazan (quedan 0).`
      : fLocal + fCopia > 0 ? ` Comida: ${fLocal} → ${fCopia} entradas.` : ''
    if (!window.confirm(`¿Importar esta copia? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${n} y ${m}.${b.dropped ? ` Se ignorarán ${b.dropped} elementos no válidos.` : ''}${b.fixed ? ` Se corregirán ${b.fixed} elementos con campos no válidos.` : ''}${gymText}${routinesText}${foodText} Exporta antes si quieres conservar lo actual.`)) return
    if (hasData && !backupCurrent()) return setNotice('No se pudo guardar la copia interna, así que no se ha importado nada. Exporta una copia y vuelve a intentarlo.')
    setCanRestore(hasLastBackup())
    unlockStorage()
    const g = b.gym ?? EMPTY_GYM, f = b.food ?? EMPTY_FOOD // las reglas de sesiones y de Dieta también rigen al importar (normalmente no añaden nada)
    setEvents(withAutos(b.events, g, f)); setCustom(b.custom); setGym(g); setFood(f); setToast(null); setGain(null); setOvertake(null)
    const nr = b.gym?.routines?.length ?? 0
    setNotice(`Copia importada: ${n} registros y ${m} misiones nuevas${nr > 0 ? ` y ${nr} rutinas` : ''}.`)
  }

  function mergeData(text: string) {
    if (stale) return setNotice(STALE_BLOCK_TEXT)
    const b = parseBackup(text)
    if (!b) return setNotice('Ese archivo no es una copia válida de RPG Life Tracker.')
    const r = mergeBackup({ events, custom, gym, food }, { ...b, gym: b.gym ?? undefined })
    if (!r.changed) return setNotice(`Esa copia no trae nada nuevo: ya tienes todos sus registros.${r.conflicts.length ? ` En ${r.conflicts.join(', ')} la copia tiene otros cambios; se mantiene lo de este dispositivo.` : ''}`)
    const gymAdded = r.setsAdded + r.exercisesAdded
    const foodAdded = r.foodAdded + r.foodsAdded + r.mealsAdded
    const gymText = (gymAdded > 0 ? ` y ${gymAdded} entradas de gym` : '') + (r.routinesAdded > 0 ? ` y ${r.routinesAdded} rutinas` : '') + (foodAdded > 0 ? ` y ${foodAdded} entradas de comida` : '')
    const msg = `¿Fusionar esta copia con tus datos? Se añaden ${r.added} registros nuevos (${r.existing} ya estaban) y ${r.trackersAdded} misiones nuevas${gymText}.`
      + (r.renamed > 0 ? ` ${r.renamed} registros coinciden en identificador con uno tuyo pero son distintos (p. ej. del ejemplo): se añaden aparte.` : '')
      + (r.conflicts.length ? ` En ${r.conflicts.join(', ')} la copia tiene otros cambios (nombre, incremento, objetivo, límite o archivado): se mantiene lo de este dispositivo.` : '')
      + (b.dropped ? ` Se ignorarán ${b.dropped} elementos no válidos.` : '') + (b.fixed ? ` Se corregirán ${b.fixed} elementos con campos no válidos.` : '')
      + ' No se borra nada. Lo que hayas borrado aquí y siga en la copia volverá a aparecer. Si no te convence, «Recuperar copia anterior» lo deshace.'
    if (!window.confirm(msg)) return
    if (hasData && !backupCurrent()) return setNotice('No se pudo guardar la copia interna, así que no se ha fusionado nada. Exporta una copia y vuelve a intentarlo.')
    setCanRestore(hasLastBackup()); unlockStorage()
    // una fusión puede juntar una serie viva de un dispositivo con la sesión retirada en el otro
    setEvents(withAutos(r.events, r.gym, r.food)); setCustom(r.custom); setGym(r.gym); setFood(r.food); setToast(null); setGain(null); setOvertake(null)
    setNotice(`Copia fusionada: ${r.added} registros y ${r.trackersAdded} misiones nuevas${gymText}.`)
  }

  function restore() {
    if (stale) return setNotice(STALE_BLOCK_TEXT)
    const r = readLast()
    if (r === 'none') { setCanRestore(false); return setNotice('No hay ninguna copia interna que recuperar.') }
    if (r === 'unreadable') return setNotice('La copia interna está dañada y no se puede recuperar. Tus datos actuales no se han tocado.')
    const ev = r.events ?? events, cu = r.custom ?? custom
    // copia anterior al módulo Gym (r.gym null): se conserva el gym actual y se recrean las sesiones de los días con series
    const gymF = r.gym ?? gym, foodF = r.food ?? food // copia anterior al módulo Comida (r.food null): se conserva la comida actual y se reevalúa Dieta
    const ev2 = withAutos(ev, gymF, foodF)
    const fLocal = foodCount(food)
    const foodText = r.food ? ` Comida: ${fLocal} → ${foodCount(r.food)} entradas.` : fLocal > 0 ? ` Esta copia es anterior al módulo Comida: tus ${fLocal} entradas se conservan.` : ''
    const kLocal = liveSets(gym.log).length
    const gymText = r.gym ? ` Series de gym: ${kLocal} → ${liveSets(r.gym.log).length}.`
      : kLocal > 0 ? ` Esta copia es anterior al módulo Gym: tus ${kLocal} series de gym se conservan y los días con series vuelven a contar como sesión.` : ''
    if (!window.confirm(`¿Recuperar la copia guardada antes de tu último «Importar» o «Borrar todo»? Se reemplazan tus ${events.length} registros y ${custom.trackers.length} misiones nuevas por ${ev.length} y ${cu.trackers.length}.${r.dropped ? ` Se ignorarán ${r.dropped} elementos no válidos.` : ''}${r.fixed ? ` Se corregirán ${r.fixed} elementos con campos no válidos.` : ''}${gymText}${foodText} Lo que tienes ahora queda guardado como copia: si cambias de idea, pulsa otra vez «Recuperar copia anterior».`)) return
    if (!restoreLast(r)) return setNotice('No se pudo recuperar la copia, así que no se ha cambiado nada. Exporta una copia y vuelve a intentarlo.')
    setEvents(ev2); setCustom(cu); setGym(gymF); setFood(foodF); setToast(null); setGain(null); setOvertake(null)
    setNotice(`Copia recuperada: ${ev.length} registros y ${cu.trackers.length} misiones nuevas.`)
  }

  return (
    <>
      {screen === 'home' && (
        <HomeView game={game} summary={summary} gymToday={gymToday} onOpenGym={() => openGym('home')} foodToday={foodToday} onOpenFood={() => openFood('home')} focusHoy={focusHoy} onCapture={openCapture} onWriteNew={() => openManual()} weeks={weeks} partyStates={partyStates} archived={archived} onUnarchive={unarchive} onNavigate={goTo} onAdd={t => add(t, t.increment)} onUndo={undo}
          onOpenParty={id => { setPartyId(id); go('party') }} onReset={reset} onLoadExample={events.length === 0 ? loadExample : undefined} onRestore={canRestore ? restore : undefined}
          onExport={exportData} onImport={importData} onMerge={mergeData} onImportError={() => setNotice('No se pudo leer el archivo.')} copy={copy}
          notice={notice} saveFailed={saveFailed} onDismissNotice={() => setNotice(null)} />
      )}
      {(screen === 'hero' || screen === 'villain') && (
        <MissionsView key={screen} branch={screen} game={game} partyStates={partyStates} gain={gain} events={events} today={today} onAdd={add} onUndo={undo} onSave={saveTracker} onPropose={propose} saveFailed={saveFailed} onExport={exportData} />
      )}
      {screen === 'new' && (
        newMode === 'capture'
          ? <CaptureView key={capture.key} start={capture.start} onConsumed={() => setCapture(c => ({ ...c, start: { mode: 'idle' } }))} ack={voiceAck} onAck={ackVoice}
              trackers={trackers} exercises={activeExercises} unit={gym.unit ?? 'kg'} onAdd={captureAdd} onUndoEvent={(t, ev) => { undo(t, ev) }} onInterpret={interpretCapt} onLearn={learnCapture} onForget={forgetCapture} onSaveGym={cmd => saveVoice(cmd, today)} onUndoGym={undoSets}
              onGymEdit={d => openGymWith(d, editNote(d, activeExercises, gym.unit ?? 'kg'))} onGymIncomplete={(d, missing: VoiceMissing[]) => openGymWith(d, incompleteNote(missing))}
              onCreate={captureCreate} onUndoCreate={undoCreate} onGoToMissions={go} onManual={openManual} onBusy={b => { captureBusy.current = b }}
              foods={food.foods} onSaveFood={adds => foodHandlers.addVoice(adds, today)} onUndoFood={foodHandlers.undoVoice} onOpenFood={openFoodWith} />
          : <UnknownView key={manualText} initialText={manualText} trackers={trackers} parties={PARTIES} onCreate={create} onAdd={add} onPropose={propose} onGoToMissions={go} onUnarchive={unarchive} />
      )}
      {screen === 'party' && (
        <PartyView states={partyStates} selectedId={partyId} onSelect={setPartyId} global={game} today={today} />
      )}
      {screen === 'me' && <MeView onOpenGym={() => openGym('me')} onOpenFood={() => openFood('me')} focusCard={focusCard} voiceAck={voiceAck} onVoiceAck={ackVoice} aiKey={{ ...aiKey, onSave: saveKey, onClear: clearKey, onTest: testKey }} />}
      {screen === 'gym' && <GymView gym={gym} today={today} prefill={gymPrefill ?? undefined} onAddSet={addSet} onUndoSet={undoSet} voice={{ ack: voiceAck, onAck: ackVoice, onInterpret: interpretVoice, onSave: saveVoice, onUndo: undoSets }} onSetUnit={setUnit} onCreateExercise={createExercise} onArchiveExercise={setExerciseArchived} onSaveRoutine={saveRoutine} onDeleteRoutine={deleteRoutine} onBack={backFromGym} saveFailed={saveFailed} onExport={exportData} />}
      {screen === 'food' && <FoodView food={food} today={today} onAddEntry={foodHandlers.addFoodEntry} onAddQuick={foodHandlers.addQuick} onUndo={foodHandlers.undoFood} onCreateFood={foodHandlers.createFood} onArchiveFood={foodHandlers.setFoodArchived} onSaveMeal={foodHandlers.saveMeal} onDeleteMeal={foodHandlers.deleteMeal} onAddMeal={foodHandlers.addMeal} onSaveGoal={foodHandlers.saveFoodGoal} onBack={backFromFood} saveFailed={saveFailed} onExport={exportData} prefill={foodPrefill ?? undefined}
        net={{ online: navigator.onLine !== false, hasKey: aiKey.hint !== null, ack: foodAck, onAck: ackFood, lookupEan: ean => (navigator.onLine === false ? Promise.resolve({ kind: 'error', error: 'network' }) : fetchOff(ean)), readLabel }} />}
      {toast && <LevelUpToast toast={toast} />}
      {overtake && !toast && (overtake.lost ? <PassedBanner o={overtake} lost={overtake.lost} /> : <OvertakeBanner o={overtake} />)}
      {/* ponytail: dos avisos seguidos con el mismo texto pueden no repetirse en el lector; añadir la key como texto oculto si molesta. */}
      {record && !toast && !overtake && <RecordBanner r={record} />}
      <p role="status" className="sr-only">{saveFailed ? SAVE_FAIL_TEXT : liveText(toast, overtake)}</p>
      <BottomNav screen={screen} onChange={goTo} />
      {stale ? <UpdateBanner tone={screen === 'hero' || screen === 'gym' || screen === 'food' ? 'hero' : screen === 'villain' ? 'villain' : 'app'} text={STALE_TAB_TEXT} onReload={() => location.reload()} />
        : update && <UpdateBanner tone={screen === 'hero' || screen === 'gym' || screen === 'food' ? 'hero' : screen === 'villain' ? 'villain' : 'app'} onReload={() => location.reload()} onClose={() => setUpdate(false)} />}
    </>
  )
}
