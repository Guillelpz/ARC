import type { ActivityEvent, GameState, GymSet, GymUndo, PartyMember, Proposal, Tracker, WeekRow } from './types'
import { DEMO_DATE, SEED_EVENTS, seedFor } from './seed'
import { allTrackers, logGoal, setGoal, setLimit, TRACKERS, unitFor } from './trackers'
import { addDays, byRecent, clampAmount, dayTotal, daysLeftInWeek, branchWeekly, history, localDate, mondayOf, streak, todaySummary, total, undoneIds, weekly } from './stats'
import { deriveGame, diffLevelDowns, diffLevelUps, weeklyXp } from './rpg'
import { buildRanking, countsIn, derivePartyState, overtakes, PARTIES, partyCriteria, proposeTo, rankScore, vote } from './party'
import { buttonLabel, classify, createTracker, editTracker, exactTracker, findSimilar, isDuplicateName, isValidName, trackerName } from './classify'
import { exportBackup, parseBackup, parseCustom, readFood, readGym } from './storage'
import { mergeBackup } from './merge'
import { ALIASES, draftText, fromAI, isComplete, matchExercise, normalizeVoice, parseGym, pickDraft, type GymDraft } from './voice'
import { MEMO_MAX, forget, learn, localCapture, memoKey, readMemo, recall, type Memo } from './memory'
import { capturePrompt, captureSchema, voicePrompt, voiceSchema } from './haiku'
import { ALL_UNITS, captureFromAI, captureNorm, convNote, deviceSure, isOtherDay, isReady, pickCapture, routeCapture, type CaptureCommand, type CaptureCtx } from './capture'
import { CATALOG } from './foodCatalog'
import { allFoods, dayTotals, fmtKcal, fold, dietActive, dietDays, dietSync, frequentFoods, goalOn, inRange, kcalRange, lastPortion, makeEntry, parseKcal, parseMacro, parsePct, parseQty, parseServings, portion, quickEntry, recentFoods, searchFoods, setFoodGoal, withDiet } from './food'
import type { Food, FoodData, FoodEntry, FoodGoal, FoodLogEntry } from './types'
import { EXERCISES, GROUPS, LB_KG, autoSession, beaten, convert, e1rm, ensureAuto, fmtWeight, fromKg, liveSets, parseWeight, retractAuto, recordText, records, groupVolume, undoMany, gymDay, routineFromDay, routineProgress, setDays, stepWeight, toKg, weeklyBest1rm } from './gym'

// Oráculo de dominio. Si falla, se arregla el motor, nunca los asserts.
export function runSelfCheck() {
  const ok = (cond: boolean, msg: string) => console.assert(cond, msg)
  const tap = (events: ActivityEvent[], id: string): ActivityEvent[] => {
    const t = TRACKERS.find(t => t.id === id)!
    return [...events, { id: `check-${events.length}`, trackerId: id, amount: t.increment, occurredAt: `${DEMO_DATE}T12:00:00` }]
  }
  const get = (g: ReturnType<typeof deriveGame>, id: string) => g.trackers.find(s => s.tracker.id === id)!

  const sum0 = (g: GameState) => [g.hero.xp, g.villain.xp, g.player.xp, g.weeklyHeroXp].join()
  ok(SEED_EVENTS.length === 28, 'seed: 28 eventos')
  ok(mondayOf(DEMO_DATE) === '2026-10-05' && addDays(mondayOf(DEMO_DATE), -7) === '2026-09-28', 'semanas: lun 5 oct / lun 28 sep')
  ok(addDays(DEMO_DATE, 1) === '2026-10-08' && addDays(DEMO_DATE, -6) === '2026-10-01', 'tramos: [.., 8 oct) / [.., 1 oct)')

  const g0 = deriveGame(SEED_EVENTS, DEMO_DATE)
  const expected: Record<string, [number, number, number, number, number, number]> = {
    // week, prev, diff, allTime, xp, level
    gym: [3, 2, 1, 5, 150, 3], bjj: [2, 2, 0, 4, 120, 3], running: [18, 12, 6, 30, 150, 3],
    reading: [90, 60, 30, 150, 150, 3], beer: [4, 2, 2, 6, 90, 2], burgers: [1, 2, -1, 3, 60, 2],
  }
  for (const [id, [w, p, d, a, xp, lv]] of Object.entries(expected)) {
    const s = get(g0, id)
    ok(s.week === w && s.prev === p && s.diff === d && s.allTime === a && s.xp.xp === xp && s.xp.level === lv, `inicial ${id}`)
  }
  ok(get(g0, 'beer').goalPct === null && get(g0, 'burgers').goalPct === null, 'villain sin objetivo')
  ok(g0.hero.xp === 570 && g0.hero.level === 3, 'hero 570 Lv3')
  ok(g0.villain.xp === 150 && g0.villain.level === 1, 'villain 150 Lv1')
  ok(g0.player.xp === 720 && g0.player.level === 3, 'player 720 Lv3')
  ok(g0.heroPct === 79, 'composición 79/21')
  ok(g0.weeklyHeroXp === 330, 'hero semanal 330')
  const SUN = '2026-10-11'
  const rk = (g: GameState) => buildRanking(g, PARTIES[0].members, 'hero', SUN)
  ok(rk(g0).map(r => r.id).join() === 'carlos,alex,you,dani', 'ranking inicial')

  const e1 = tap(SEED_EVENTS, 'gym')
  const g1 = deriveGame(e1, DEMO_DATE)
  const gym = get(g1, 'gym')
  ok(e1.length === 29 && gym.week === 4 && gym.allTime === 6 && gym.xp.xp === 180 && gym.diff === 2, '+Gym: 4/4, 6, 180, +2')
  ok(gym.xp.level === 4 && g1.hero.level === 4 && g1.player.level === 4, '+Gym: Lv 4 gym/hero/player')
  ok(g1.hero.xp === 600 && g1.villain.xp === 150, '+Gym: hero 600, villain 150')
  const up = diffLevelUps(g0, g1)
  ok(up?.title === 'LEVEL UP — PLAYER 4' && up.detail === 'Gym Lv. 4 · Hero Lv. 4', '+Gym: toast')
  ok(rk(g1).map(r => r.id).join() === 'carlos,you,alex,dani' && g1.weeklyHeroXp === 360, 'ranking tras +Gym')
  ok(overtakes(rk(g1), rk(g0)).join() === 'Alex' && !overtakes(rk(g0), rk(g1)).length, 'adelantamientos en ambos sentidos')
  const down = diffLevelDowns(g1, g0)
  ok(down?.title === 'LEVEL DOWN — PLAYER 3' && down.detail === 'Gym Lv. 3 · Hero Lv. 3', '−Gym: toast de bajada')
  ok(diffLevelDowns(g0, g1) === null && diffLevelUps(g1, g0) === null, 'subidas y bajadas no se cruzan')

  const g2 = deriveGame(tap(e1, 'beer'), DEMO_DATE)
  ok(get(g2, 'beer').allTime === 7 && g2.villain.xp === 165 && g2.hero.xp === 600, '+Beer: +1, +15 VILLAIN, nada resta')
  const gr = deriveGame(tap(SEED_EVENTS, 'running'), DEMO_DATE)
  ok(get(gr, 'running').allTime === 35 && gr.hero.xp === 595, '+5 km: +25 HERO XP')
  const gd = deriveGame(tap(SEED_EVENTS, 'reading'), DEMO_DATE)
  ok(get(gd, 'reading').allTime === 180 && gd.hero.xp === 600, '+30 min: +30 HERO XP')
  ok(deriveGame([], DEMO_DATE).heroPct === null, 'sin eventos: heroPct null')
  const gc = deriveGame([...tap(SEED_EVENTS, 'running'), { id: 'check-undo', trackerId: 'running', amount: -5, occurredAt: `${DEMO_DATE}T12:01:00` }], DEMO_DATE)
  ok(sum0(gc) === sum0(g0), 'corrección −5 km deshace +5 km')
  ok(localDate(new Date(2026, 9, 7, 23, 59)) === '2026-10-07' && localDate(new Date(2026, 0, 5, 0, 0)) === '2026-01-05', 'fecha local YYYY-MM-DD')
  const sx = seedFor('2026-12-16') // miércoles, +10 semanas
  ok(sx.length === 28 && sx[0].occurredAt === '2026-12-07T09:00:00' && sum0(deriveGame(sx, '2026-12-16')) === sum0(g0), 'seedFor: semanas enteras, mismas stats')
  const sl = seedFor('2026-10-12') // lunes: mar y mié de la semana base caerían en el futuro
  ok(sl.length === 16 && sl.every(e => e.occurredAt.slice(0, 10) <= '2026-10-12'), 'seedFor: sin eventos futuros')


  // ---- V2: parties, nuevo y ranking ----
  const [gymP, ofi] = PARTIES
  const NOW = `${DEMO_DATE}T12:00:00`
  const ids = (ts: { id: string }[]) => ts.map(t => t.id).join()
  const sum = (g: GameState) => [g.hero.xp, g.hero.level, g.villain.xp, g.villain.level, g.player.xp, g.player.level, g.weeklyHeroXp].join()
  const ps = (events: ActivityEvent[], trackers: Tracker[] = TRACKERS, proposals: Proposal[] = [], today = DEMO_DATE) =>
    PARTIES.map(p => derivePartyState(p, events, today, trackers, proposals))

  ok(ids(partyCriteria(gymP, TRACKERS, [])) === 'gym,bjj,running,reading,beer,burgers', 'criterios Los del Gym')
  ok(ids(partyCriteria(ofi, TRACKERS, [])) === 'running,reading,burgers', 'criterios La Oficina')
  const [sg0, so0] = ps(SEED_EVENTS)
  ok(sum(sg0.game) === sum(g0), 'Los del Gym = global al abrir')
  ok(sum(so0.game) === '300,2,60,1,360,2,180', 'La Oficina: HERO 300 L2, VILLAIN 60 L1, PLAYER 360 L2, sem 180')
  const [sgS, soS] = ps(SEED_EVENTS, TRACKERS, [], SUN)
  ok(ids(soS.ranking) === 'lucia,you,marta,pablo' && soS.position === 2, 'ranking La Oficina')
  ok(ids(sgS.ranking) === 'carlos,alex,you,dani' && sgS.position === 3, 'ranking Los del Gym inicial')
  ok(ids(buildRanking(sgS.game, gymP.members, 'villain', SUN)) === 'dani,alex,you,carlos', 'ranking VILLAIN Los del Gym')
  ok(ids(buildRanking(soS.game, ofi.members, 'depth', SUN)) === 'lucia,pablo,marta,you', 'ranking profundidad La Oficina')
  const [sg1, so1] = ps(e1)
  const sg1S = ps(e1, TRACKERS, [], SUN)[0]
  ok(ids(sg1S.ranking) === 'carlos,you,alex,dani' && sg1S.game.weeklyHeroXp === 360, 'Los del Gym tras +Gym')
  ok(sum(so1.game) === sum(so0.game) && ids(so1.ranking) === ids(so0.ranking), '+Gym: La Oficina no cambia')
  const eb = tap(SEED_EVENTS, 'beer'); const [sgb, sob] = ps(eb)
  ok(deriveGame(eb, DEMO_DATE).villain.xp === 165 && sgb.game.villain.xp === 165 && sob.game.villain.xp === 60, '+Beer: 165 / 165 / 60')
  ok(countsIn('beer', [sg0, so0]).join(' · ') === 'Los del Gym', 'Beer cuenta en Los del Gym')
  ok(countsIn('running', [sg0, so0]).join(' · ') === 'Los del Gym · La Oficina', 'Running cuenta en ambas')

  const c = classify
  const m = c('meditar'); ok(m.branch === 'hero' && m.type === 'count' && m.increment === 1 && m.xpPerUnit === 20, 'IA meditar')
  const p = c('comer pizza a las 3am')
  ok(p.branch === 'villain' && p.confidence === 'alta' && p.reasons.includes('pizza') && p.reasons.includes('3am'), 'IA pizza 3am')
  const r = c('correr 5 km'); ok(r.branch === 'hero' && r.type === 'distance' && r.unit === 'km' && r.increment === 5 && r.xpPerUnit === 5, 'IA correr km')
  const l = c('leer 30 minutos'); ok(l.branch === 'hero' && l.type === 'duration' && l.unit === 'min' && l.increment === 30 && l.xpPerUnit === 1, 'IA leer min')
  const x = c('xyzzy'); ok(x.branch === 'hero' && x.confidence === 'baja' && x.reason.startsWith('Sin pistas claras'), 'IA sin pistas')
  ok(JSON.stringify(c('Pizza')) === JSON.stringify(c('pizza')) && JSON.stringify(c('comer pizza a las 3am')) === JSON.stringify(p), 'IA determinista')
  ok(c('caminar').type === 'count', 'caminar no es duración')

  const med = createTracker({ name: 'Meditar', branch: 'hero', type: 'count', xpPerUnit: 20 }, 'custom-meditar')
  const pizza = createTracker({ name: trackerName('comer pizza a las 3am'), branch: 'villain', type: 'count', xpPerUnit: 20 }, 'custom-pizza')
  const all = allTrackers([med, pizza])
  ok(pizza.name === 'Comer pizza a las 3am' && med.buttonLabel === '+1' && med.custom === true && !med.weeklyGoal, 'createTracker')
  const pag = createTracker({ name: 'Leer', branch: 'hero', type: 'custom', unit: ' páginas ', xpPerUnit: 10 }, 'custom-pag')
  ok(pag.unit === 'páginas' && pag.increment === 1 && pag.buttonLabel === '+1 páginas', 'createTracker tipo custom')
  ok(countsIn(med.id, ps(SEED_EVENTS, all)).length === 0, 'Meditar: ninguna party')
  const em = [...SEED_EVENTS, { id: 'check-med', trackerId: med.id, amount: 1, occurredAt: NOW }]
  ok(deriveGame(em, DEMO_DATE, all).hero.xp === 590 && ps(em, all)[1].game.hero.xp === 300, 'Meditar: +20 global, Oficina 300')
  const pm = proposeTo([], med.id, PARTIES.map(q => q.id), all, NOW)
  ok(pm.length === 2 && PARTIES.every(q => { const v = vote('hero', q); return v.accepted && v.yes === 3 && v.total === 3 }), 'Meditar 3/3 en ambas')
  const [smg, smo] = ps(em, all, pm)
  ok(smg.criteria.some(t => t.id === med.id) && smo.criteria.some(t => t.id === med.id), 'Meditar en criterios')
  ok(smo.game.hero.xp === 320, 'retroactivo: Oficina 300 → 320')
  ok(proposeTo(pm, med.id, [ofi.id], all, NOW).length === 2, 'no proponer dos veces')
  ok(proposeTo([], 'beer', [gymP.id], all, NOW).length === 0, 'no proponer un criterio existente')

  // E1–E5 — editar actividades propias
  ok(buttonLabel('unidades', 1) === '+1' && buttonLabel('unidades', 3) === '+3 unidades' && buttonLabel('km', 5) === '+5 km', 'E1 buttonLabel')
  const e2 = editTracker(med, { name: '  meditar   mucho ', increment: 2.6, weeklyGoal: 4.4 })
  ok(e2.name === 'Meditar mucho' && e2.increment === 3 && e2.buttonLabel === '+3 unidades' && e2.weeklyGoal === 4 &&
    e2.id === med.id && e2.branch === med.branch && e2.unit === med.unit && e2.xpPerUnit === med.xpPerUnit && e2.custom === med.custom, 'E2 editTracker')
  const e3 = editTracker(med, { name: 'Meditar', increment: 0, weeklyGoal: null })
  ok(e3.increment === 1 && !('weeklyGoal' in e3) && !('weeklyGoal' in editTracker(pizza, { name: 'Pizza', increment: 1, weeklyGoal: 5 })), 'E3 editTracker límites')
  ok(editTracker(TRACKERS[0], { name: 'X', increment: 9, weeklyGoal: 1 }) === TRACKERS[0], 'E4 fija intacta')
  const sumE = (g: GameState) => [g.hero.xp, g.villain.xp, g.player.xp, g.weeklyHeroXp].join()
  ok(sumE(deriveGame(em, DEMO_DATE, allTrackers([{ ...editTracker(med, { name: 'M2', increment: 5, weeklyGoal: 3 }), archived: true }, pizza]))) === sumE(deriveGame(em, DEMO_DATE, all)), 'E5 XP invariante')

  // BW1–BW3 — XP por rama y semana
  const bw = branchWeekly(SEED_EVENTS, TRACKERS, DEMO_DATE)
  ok(bw.length === 8 && bw[0].monday === '2026-08-17' && bw[7].current && bw.filter(r => r.current).length === 1
    && bw[7].hero === g0.weeklyHeroXp && bw[7].villain === weeklyXp(g0, 'villain'), 'BW1 semana en curso = XP semanal')
  ok((['hero', 'villain'] as const).every(b => bw.reduce((s, r) => s + r[b], 0) ===
    TRACKERS.filter(t => t.branch === b).reduce((s, t) => s + total(SEED_EVENTS, t.id, '2026-08-17', addDays(DEMO_DATE, 1)) * t.xpPerUnit, 0)), 'BW2 suma = XP del rango')
  // em = semilla + 1 registro de med (20 XP) hoy; archivada o no, cuenta igual
  const bwa = (archived: boolean) => branchWeekly(em, allTrackers([archived ? { ...med, archived: true } : med, pizza]), DEMO_DATE)
  ok(JSON.stringify(bwa(true)) === JSON.stringify(bwa(false)) && bwa(true)[7].hero === bw[7].hero + 20, 'BW3 archivadas cuentan')

  // P1 — singular coherente con los buttonLabel de las fijas
  ok(unitFor(1, 'sesiones') === 'sesión' && unitFor(-1, 'clases') === 'clase' && unitFor(1, 'unidades') === 'unidad'
    && unitFor(2, 'sesiones') === 'sesiones' && unitFor(1, 'km') === 'km' && unitFor(1, 'páginas') === 'páginas' && unitFor(1, 'constructor') === 'constructor'
    && TRACKERS.filter(t => t.increment === 1 && t.unit !== 'unidades').every(t => t.buttonLabel === `+1 ${unitFor(1, t.unit)}`), 'P1 unitFor')

  const vg = vote('villain', gymP), vo = vote('villain', ofi)
  ok(vg.accepted && vg.yes === 2 && vg.votes.find(v => v.name === 'Carlos')?.yes === false, 'VILLAIN: Gym 2/3, Carlos no')
  ok(!vo.accepted && vo.yes === 1 && vo.votes.find(v => v.name === 'Pablo')?.yes === true, 'VILLAIN: Oficina 1/3, Pablo sí')
  const pp = proposeTo([], pizza.id, PARTIES.map(q => q.id), all, NOW)
  const ep = [...SEED_EVENTS, { id: 'check-pizza', trackerId: pizza.id, amount: 1, occurredAt: NOW }]
  const [spg, spo] = ps(ep, all, pp)
  ok(deriveGame(ep, DEMO_DATE, all).villain.xp === 170 && spg.game.villain.xp === 170 && spo.game.villain.xp === 60, 'pizza: +20 global, +20 Gym, +0 Oficina')
  ok(spo.rejected.map(q => `${q.tracker.id}:${q.result.yes}/${q.result.total}`).join() === 'custom-pizza:1/3', 'Oficina: No aceptados')

  ok(['beer', 'Beer', 'Béer'].every(n => isDuplicateName(n, all)) && !isDuplicateName('Meditar yoga', all), 'nombres únicos')
  ok(findSimilar('cerveza con amigos', all)?.id === 'beer' && findSimilar('correr 5km', all)?.id === 'running' && findSimilar('Burger', all)?.id === 'burgers' && findSimilar('burguer', all)?.id === 'burgers' &&!findSimilar('comer pizza a las 3am', TRACKERS), 'misiones parecidas')
  ok(!isValidName(' a ') && isValidName('ab') && !isValidName('x'.repeat(41)), 'longitud 2–40')
  ok(parseCustom('{roto').trackers.length === 0 && parseCustom(null).proposals.length === 0, 'clave corrupta → vacío')
  ok(parseCustom(JSON.stringify({ trackers: [med], proposals: pm })).proposals.length === 2, 'roundtrip custom')

  ok(ids(byRecent(TRACKERS, SEED_EVENTS)) === 'dieta,gym,bjj,running,reading,beer,burgers', 'orden por uso: seed')
  ok(ids(byRecent([...TRACKERS, med], [...tap(SEED_EVENTS, 'burgers'), { id: 'check-fix', trackerId: 'gym', amount: -1, occurredAt: `${DEMO_DATE}T13:00:00` }])) === 'dieta,custom-meditar,burgers,gym,bjj,running,reading,beer', 'orden por uso: sin uso primero, corrección no cuenta')

  // A1 — un evento en un día pasado cuenta en su semana (mar 29 sep: tramo comparable de la semana anterior a DEMO_DATE)
  const past = get(deriveGame([...SEED_EVENTS, { id: 'check-past', trackerId: 'gym', amount: 1, occurredAt: '2026-09-29T20:00:00' }], DEMO_DATE), 'gym')
  ok(past.week === 3 && past.prev === 3 && past.allTime === 6, 'día pasado: cuenta en su semana')
  // A2 — límite de la corrección por día
  const dd: ActivityEvent[] = [
    { id: 'd1', trackerId: 'gym', amount: 2, occurredAt: '2026-10-05T10:00:00' },
    { id: 'd2', trackerId: 'gym', amount: 1, occurredAt: '2026-10-06T10:00:00' },
    { id: 'd3', trackerId: 'beer', amount: -1, occurredAt: '2026-10-07T10:00:00' },
  ]
  ok(dayTotal(dd, 'gym', '2026-10-05') === 2 && dayTotal(dd, 'gym', '2026-10-07') === 0, 'dayTotal')
  ok(clampAmount(dd, 'gym', '2026-10-05', -5) === -2 && clampAmount(dd, 'gym', '2026-10-07', -1) === 0, 'corrección: el día no baja de 0')
  ok(clampAmount(dd, 'beer', '2026-10-07', -1) === 0 && clampAmount(dd, 'gym', '2026-10-05', 2.6) === 3, 'día negativo: 0; positivos redondeados')

  // A3 — history: orden, deshecho y canUndo
  const hu: ActivityEvent[] = [
    { id: 'h1', trackerId: 'running', amount: 5, occurredAt: '2026-10-05T09:00:00' },
    { id: 'h2', trackerId: 'running', amount: 3, occurredAt: '2026-10-06T09:00:00' },
    { id: 'h3', trackerId: 'running', amount: -5, occurredAt: '2026-10-05T09:00:00', undoes: 'h1' },
  ]
  const hr = history(hu, 'running')
  ok(hr.map(r => r.event.id).join() === 'h2,h3,h1', 'history: orden desc, empate último primero')
  ok(hr[2].undone && !hr[2].canUndo && hr[0].canUndo && !hr[1].canUndo, 'history: deshecho y canUndo')
  // A4 — un registro compensado con «−» (sin undoes) no se puede deshacer
  ok(!history([hu[0], { id: 'h4', trackerId: 'running', amount: -2, occurredAt: '2026-10-05T10:00:00' }], 'running')[1].canUndo, 'history: día insuficiente')
  // A5 — límite de 10
  ok(history(Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, trackerId: 'gym', amount: 1, occurredAt: NOW })), 'gym').length === 10, 'history: 10')

  // R1/R2 — solo un negativo con undoes anula; un deshecho ya anulado no se repite
  const rp: ActivityEvent[] = [hu[0], { id: 'p', trackerId: 'running', amount: 5, occurredAt: hu[0].occurredAt, undoes: 'h1' }]
  ok(!undoneIds(rp).has('h1') && !history(rp, 'running').find(r => r.event.id === 'h1')!.undone, 'R1 positivo con undoes no anula')
  ok(undoneIds(hu).has('h1'), 'R2 deshecho ya anulado')

  // S1–S6 — racha semanal
  const ev = (trackerId: string, amount: number, day: string, id = `${trackerId}-${day}`): ActivityEvent => ({ id, trackerId, amount, occurredAt: `${day}T10:00:00` })
  let wid = 0
  const wk = (mon: string, n: number, id = 'gym') => Array.from({ length: n }, (_, i) => ev(id, 1, addDays(mon, i), `wk${++wid}`))
  const G = TRACKERS[0], st = (e: ActivityEvent[], t: Tracker = G) => streak(e, t, DEMO_DATE)
  ok(st(SEED_EVENTS) === 0 && st(SEED_EVENTS, TRACKERS[4]) === 0, 'S1 racha: semilla y sin objetivo')
  const s2 = [...wk('2026-09-21', 4), ...wk('2026-09-28', 4), ...wk('2026-10-05', 2)]
  ok(st(s2) === 2 && st([...s2, ...wk('2026-10-05', 3)]) === 3, 'S2 racha: semana en curso suma')
  const s3 = [...wk('2026-09-14', 4), ...wk('2026-09-21', 3), ...wk('2026-09-28', 4)]
  ok(st(s3) === 1, 'S3 racha rota')
  ok(st([...s3, ev('gym', 1, '2026-09-26', 'wk-fix')]) === 3, 'S4 un día pasado recompone')
  ok(st(s3, { ...G, weeklyGoal: 3 }) === 3, 'S5 sin registro: objetivo actual retroactivo')
  const s6 = wk('2026-09-28', 4)
  ok(st(s6) === 1 && get(deriveGame(s6, DEMO_DATE), 'gym').streak === 1, 'S6 corte en el primer evento')

  const s2b = [...s2, ...wk('2026-10-05', 3)]
  const hb = todaySummary(s2b, deriveGame(s2b, DEMO_DATE).trackers, DEMO_DATE).best
  ok(hb?.tracker.id === 'gym' && hb.weeks === 3 && todaySummary([], deriveGame([], DEMO_DATE).trackers, DEMO_DATE).best === null, 'H5 mejor racha')

  // H1–H4 — resumen de hoy
  const hv = [ev('gym', 1, DEMO_DATE), ev('beer', 1, DEMO_DATE), ev('running', 5, '2026-10-06')]
  const hs = todaySummary(hv, deriveGame(hv, DEMO_DATE).trackers, DEMO_DATE)
  ok(hs.xp.hero === 30 && hs.xp.villain === 15 && hs.done.map(d => d.tracker.id).join() === 'gym,beer', 'H1 hoy: XP y registrado')
  ok(hs.missing.map(x => `${x.tracker.id}:${x.left}`).join() === 'gym:3,bjj:3,running:15,reading:120' && hs.daysLeft === 5, 'H2 hoy: te faltan')
  ok(daysLeftInWeek('2026-10-11') === 1 && daysLeftInWeek('2026-10-12') === 7, 'H3 días que quedan')
  const arch = { ...med, archived: true }, ha = [ev(med.id, 1, DEMO_DATE)]
  const hsa = todaySummary(ha, deriveGame(ha, DEMO_DATE, allTrackers([arch])).trackers, DEMO_DATE)
  ok(!hsa.done.length && hsa.xp.hero === 0, 'H4 archivada fuera de hoy')
  const ua = [ev('gym', 1, DEMO_DATE, 'u1'), ev('gym', 1, DEMO_DATE, 'u2')]
  const ud = (es: ActivityEvent[]) => todaySummary(es, deriveGame(es, DEMO_DATE).trackers, DEMO_DATE).done.find(d => d.tracker.id === 'gym')
  ok(ud(ua)?.undo?.id === 'u2'
    && ud([...ua, { ...ev('gym', -1, DEMO_DATE, 'u3'), undoes: 'u2' }])?.undo?.id === 'u1'
    && ud([ev('gym', 2, DEMO_DATE, 'u4'), ev('gym', -1, DEMO_DATE, 'u5')])?.undo === undefined
    && ud([ev('gym', 1, '2026-10-06', 'u6'), ev('gym', 1, DEMO_DATE, 'u7')])?.undo?.id === 'u7', 'H7 hoy: último registro que se puede deshacer')
  const many = [ev('gym', 1, DEMO_DATE, 'm0'), ...Array.from({ length: 10 }, (_, i) => [ev('gym', 1, DEMO_DATE, `p${i}`), { ...ev('gym', -1, DEMO_DATE, `n${i}`), undoes: `p${i}` }]).flat()]
  ok(ud(many)?.undo?.id === 'm0', 'H8 hoy: deshacer no se corta en 10')

  // G1–G4 — objetivos editables de las fijas
  const ga = allTrackers([], { gym: 2 })
  ok(ga[0].weeklyGoal === 2 && ga[1].weeklyGoal === 3 && TRACKERS[0].weeklyGoal === 4 && allTrackers([]).length === 7, 'G1 override sin mutar TRACKERS')
  ok(JSON.stringify(setGoal({}, 'gym', 2.6)) === '{"gym":3}' && [setGoal({ gym: 3 }, 'gym', null), setGoal({ gym: 3 }, 'gym', 4), setGoal({ gym: 3 }, 'gym', 0), setGoal({}, 'beer', 5), setGoal({}, 'custom-x', 5)].every(g => Object.keys(g).length === 0), 'G2 setGoal')
  ok(sumE(deriveGame(SEED_EVENTS, DEMO_DATE, allTrackers([], { gym: 1, running: 50 }))) === sumE(deriveGame(SEED_EVENTS, DEMO_DATE)), 'G3 XP invariante')
  const gt = allTrackers([], { gym: 3 }), gg = deriveGame(hv, DEMO_DATE, gt)
  ok(streak(s3, gt[0], DEMO_DATE) === 3, 'G4 racha retroactiva con override')
  ok(Math.abs(get(gg, 'gym').goalPct! - 100 / 3) < 1e-9, 'G4 goalPct')
  ok(todaySummary(hv, gg.trackers, DEMO_DATE).missing.find(x => x.tracker.id === 'gym')?.left === 2, 'G4 te faltan')

  // GL1–GL6 — racha con el objetivo vigente en cada semana
  ok(st(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: 4, until: '2026-10-05' }] }) === 1, 'GL1 bajar objetivo no crece la racha')
  ok(st(s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] }) === 3, 'GL2 subir objetivo conserva la racha')
  ok(st(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] }) === 1, 'GL3 null→objetivo corta')
  const l1 = logGoal(undefined, 'gym', 4, 3, DEMO_DATE), l2 = logGoal(l1, 'gym', 3, 5, '2026-10-12')
  ok(JSON.stringify(l1) === '[{"trackerId":"gym","goal":4,"until":"2026-10-05"}]' && logGoal(l1, 'gym', 3, 2, '2026-10-09') === l1 && logGoal(l1, 'gym', 3, 3, DEMO_DATE) === l1
    && l2.length === 2 && JSON.stringify(l2[1]) === '{"trackerId":"gym","goal":3,"until":"2026-10-12"}', 'GL4 logGoal: el primero de la semana manda')
  const ga6 = allTrackers([], { gym: 3 }, [{ trackerId: 'gym', goal: 2, until: '2026-10-05' }, { trackerId: 'gym', goal: 4, until: '2026-09-28' }])
  ok(ga6[0].pastGoals?.map(p => p.until).join() === '2026-09-28,2026-10-05' && ga6[1] === TRACKERS[1] && TRACKERS[0].pastGoals === undefined && streak(s3, ga6[0], DEMO_DATE) === 1, 'GL5 allTrackers: orden e inmutabilidad')
  ok(get(deriveGame(s3, DEMO_DATE, allTrackers([], { gym: 3 }, [{ trackerId: 'gym', goal: 4, until: '2026-10-05' }])), 'gym').streak === 1, 'GL6 el registro llega al motor')

  // W1–W3 — tendencia semanal coherente con streak y total
  const run = (w: WeekRow[]) => { let n = 0; for (let i = w.length - 2; i >= 0 && w[i].met; i--) n++; return n + (w[w.length - 1].met ? 1 : 0) }
  const wc: [ActivityEvent[], Tracker][] = [[s2, G], [s2b, G], [s3, G], [[...s3, ev('gym', 1, '2026-09-26', 'wk-fix')], G], [s6, G], [SEED_EVENTS, G], [SEED_EVENTS, TRACKERS[4]],
    [s3, { ...G, weeklyGoal: 3 }], [s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: 4, until: '2026-10-05' }] }],
    [s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] }], [s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] }]]
  ok(wc.every(([e, t]) => run(weekly(e, t, DEMO_DATE)) === streak(e, t, DEMO_DATE)), 'W1 weekly coherente con streak')
  const w2 = weekly(s3, { ...G, weeklyGoal: 5, pastGoals: [{ goal: 3, until: '2026-10-05' }] }, DEMO_DATE)
  const w3 = weekly(s3, { ...G, weeklyGoal: 3, pastGoals: [{ goal: null, until: '2026-09-28' }] }, DEMO_DATE)
  ok(w2.map(r => `${r.total}/${r.goal}/${+r.met}`).join() === '0/3/0,0/3/0,0/3/0,0/3/0,4/3/1,3/3/1,4/3/1,0/5/0'
    && w2[0].monday === '2026-08-17' && w2[7].monday === '2026-10-05' && w2.filter(r => r.current).length === 1 && w2[7].current
    && w3.map(r => `${r.goal}/${+r.met}`).slice(4).join() === 'null/0,null/0,3/1,3/0'
    && weekly(SEED_EVENTS, TRACKERS[4], DEMO_DATE).every(r => r.goal === null && !r.met), 'W2 objetivos por semana a mano')
  ok(TRACKERS.every(t => weekly(SEED_EVENTS, t, DEMO_DATE).reduce((s, r) => s + r.total, 0) === total(SEED_EVENTS, t.id, '2026-08-17', addDays(DEMO_DATE, 1))), 'W3 suma = total del rango')
  const hg = deriveGame(hv, DEMO_DATE), hm = todaySummary(hv, hg.trackers, DEMO_DATE).missing
  const hn = '2026-10-12', hmn = todaySummary(hv, deriveGame(hv, hn).trackers, hn).missing
  ok(hm.every(m => m.left === m.tracker.weeklyGoal! - get(hg, m.tracker.id).week) && hmn.find(m => m.tracker.id === 'gym')?.left === 4, 'H6 missing con el mismo today')

  // K1–K5 — ranking prorrateado: amigos a ritmo lineal (lun 1/7 … dom 7/7)
  const MON = '2026-10-12'
  const fr = (r: PartyMember[], id: string) => r.find(m => m.id === id)!
  const rkMon = buildRanking(g0, gymP.members, 'hero', MON)
  ok(fr(rkMon, 'carlos').weeklyHeroXp === 74 && fr(rkMon, 'carlos').weeklyVillainXp === 4 && fr(sg0.ranking, 'carlos').weeklyHeroXp === 221 &&
    fr(rk(g0), 'carlos').weeklyHeroXp === 515 && gymP.members[0].weeklyHeroXp === 515, 'K1 prorrateo lun/mié/dom sin mutar PARTIES')
  ok(ids(sg0.ranking) === 'you,carlos,alex,dani' && sg0.position === 1 && ids(so0.ranking) === 'you,lucia,marta,pablo' && so0.position === 1, 'K2 ranking HERO miércoles')
  const depthO = buildRanking(so0.game, ofi.members, 'depth', DEMO_DATE)
  ok(ids(buildRanking(sg0.game, gymP.members, 'villain', DEMO_DATE)) === 'dani,you,alex,carlos' && ids(depthO) === 'you,lucia,pablo,marta' &&
    rankScore(fr(depthO, 'pablo'), 'depth') === 102, 'K3 VILLAIN y profundidad miércoles (suma de campos redondeados)')
  ok(ids(sg1.ranking) === 'you,carlos,alex,dani' && !overtakes(sg1.ranking, sg0.ranking).length, 'K4 +Gym miércoles: sin adelantamiento')
  const rm = (n: number) => buildRanking(deriveGame(Array.from({ length: n }, (_, i) => ev('gym', 1, MON, `mon${i}`)), MON), gymP.members, 'hero', MON)
  ok(ids(rm(2)) === 'carlos,you,alex,dani' && ids(rm(3)) === 'you,carlos,alex,dani' && overtakes(rm(3), rm(2)).join() === 'Carlos', 'K5 adelantamiento en lunes')

  // L1–L6 — límite semanal VILLAIN
  {
    const lim = { beer: 2 }, limBefore = JSON.stringify(lim)
    ok(JSON.stringify(setLimit({}, 'beer', 2.6)) === '{"beer":3}' && Object.keys(setLimit({ beer: 2 }, 'beer', null)).length === 0 &&
      Object.keys(setLimit({ beer: 2 }, 'beer', 0)).length === 0 && Object.keys(setLimit({}, 'gym', 2)).length === 0 &&
      Object.keys(setLimit({}, 'custom-x', 2)).length === 0 && (setLimit(lim, 'beer', 5), JSON.stringify(lim) === limBefore), 'L1 setLimit')
    const l2 = allTrackers([], {}, [], { beer: 2, gym: 5 })
    ok(l2[4].weeklyLimit === 2 && l2[0].weeklyLimit === undefined && l2[0].weeklyGoal === 4 && TRACKERS[4].weeklyLimit === undefined && l2[1] === TRACKERS[1], 'L2 allTrackers con límites')
    const overOf = (limits: Record<string, number>) => get(deriveGame(SEED_EVENTS, DEMO_DATE, allTrackers([], {}, [], limits)), 'beer').over
    ok(overOf({ beer: 2 }) === 2 && overOf({ beer: 4 }) === 0 && overOf({ beer: 5 }) === 0 && overOf({}) === null, 'L3 over')
    const lt = allTrackers([], {}, [], { beer: 1, burgers: 1 })
    const gl = deriveGame(SEED_EVENTS, DEMO_DATE, lt)
    const tsL = todaySummary(SEED_EVENTS, gl.trackers, DEMO_DATE), ts0 = todaySummary(SEED_EVENTS, g0.trackers, DEMO_DATE)
    const [lg, lo] = ps(SEED_EVENTS, lt)
    ok(sum(gl) === sum(g0) && get(gl, 'beer').streak === 0 && get(gl, 'beer').goalPct === null &&
      tsL.missing.every(m => m.tracker.branch === 'hero') && tsL.best?.tracker.id === ts0.best?.tracker.id && tsL.best?.weeks === ts0.best?.weeks &&
      sum(lg.game) === sum(sg0.game) && sum(lo.game) === sum(so0.game) && ids(lg.ranking) === ids(sg0.ranking) && ids(lo.ranking) === ids(so0.ranking) &&
      weekly(SEED_EVENTS, lt[4], DEMO_DATE).every(w => w.goal === null), 'L4 el límite solo avisa')
    const lp = createTracker({ name: 'Pizza', branch: 'villain', type: 'count', xpPerUnit: 10 }, 'custom-lp')
    const lm = createTracker({ name: 'Meditar', branch: 'hero', type: 'count', xpPerUnit: 10 }, 'custom-lm')
    const lpl = editTracker(lp, { name: 'Pizza', increment: 1, weeklyGoal: null, weeklyLimit: 2.4 })
    ok(lpl.weeklyLimit === 2 && !('weeklyLimit' in editTracker(lpl, { name: 'Pizza', increment: 1, weeklyGoal: null, weeklyLimit: null })) &&
      editTracker(lpl, { name: 'Pizza', increment: 1, weeklyGoal: null }).weeklyLimit === 2 &&
      !('weeklyLimit' in editTracker(lm, { name: 'Meditar', increment: 1, weeklyGoal: null, weeklyLimit: 3 })) &&
      editTracker(TRACKERS[4], { name: 'X', increment: 9, weeklyGoal: null, weeklyLimit: 3 }) === TRACKERS[4], 'L5 editTracker')
  }

  // M1–M8 — fusión de copias
  {
    const e = (id: string, t: string, a: number, d: string, undoes?: string): ActivityEvent => ({ id, trackerId: t, amount: a, occurredAt: `${d}T12:00:00`, ...(undoes && { undoes }) })
    const cA = createTracker({ name: 'Yoga', branch: 'hero', type: 'count', xpPerUnit: 10 }, 'custom-a')
    const L = { events: [e('seed-01', 'gym', 1, '2026-10-05'), e('l2', 'bjj', 1, '2026-10-06'), e('l3', 'gym', 1, '2026-10-07')], custom: { trackers: [cA], proposals: [] as Proposal[] } }
    const m1 = mergeBackup(L, L)
    ok(m1.added === 0 && m1.existing === 3 && !m1.changed, 'M1 copia igual: nada nuevo')
    const m2 = mergeBackup(L, { events: [e('u-1', 'gym', 1, '2026-10-08')], custom: L.custom })
    ok(m2.added === 1 && m2.events.map(x => x.id).join() === 'seed-01,l2,l3,u-1', 'M2 nuevo al final, locales en orden')
    const inc3 = { events: [e('seed-01', 'gym', 1, '2026-09-01')], custom: L.custom }
    const m3 = mergeBackup(L, inc3)
    ok(m3.renamed === 1 && m3.events[3].id === 'seed-01~2' && mergeBackup({ events: m3.events, custom: m3.custom }, inc3).added === 0, 'M3 colisión → seed-01~2, idempotente')
    const m4 = mergeBackup(L, { events: [e('seed-01', 'gym', 1, '2026-09-01'), e('d1', 'gym', -1, '2026-09-02', 'seed-01')], custom: L.custom })
    ok(m4.events[4].undoes === 'seed-01~2', 'M4 undoes reasignado al renombrado')
    const LU = { events: [...L.events, e('d0', 'gym', -1, '2026-10-08', 'l3')], custom: L.custom }
    const m5 = mergeBackup(LU, { events: [e('d9', 'gym', -1, '2026-10-09', 'l3')], custom: L.custom })
    ok(m5.added === 0 && m5.existing === 1, 'M5 deshacer duplicado = ya estaba')
    const cB = { ...cA, id: 'custom-b', name: 'Chess' }
    const gl = (t: string) => ({ trackerId: t, goal: 2, until: '2026-10-05' })
    const m6 = mergeBackup(L, { events: [], custom: { trackers: [cB], proposals: [], goalLog: [gl('custom-b'), gl('gym'), gl('custom-a')] } })
    ok(m6.trackersAdded === 1 && m6.custom.goalLog?.length === 1 && m6.custom.goalLog[0].trackerId === 'custom-b', 'M6 tracker nuevo con su goalLog; el resto no')
    const m7 = mergeBackup({ events: [], custom: { ...L.custom, goals: { gym: 5 } } }, { events: [], custom: { trackers: [{ ...cA, name: 'Otro' }], proposals: [] } })
    ok(m7.custom.trackers[0].name === 'Yoga' && m7.conflicts.includes('Yoga') && m7.conflicts.includes('Gym') && !m7.changed, 'M7 conflictos: gana lo local')
    const P = (t: string, p: string): Proposal => ({ trackerId: t, partyId: p, proposedAt: '2026-10-05T10:00:00' })
    const lp = { events: L.events, custom: { trackers: [cA], proposals: [P('custom-a', 'gym')] } }
    const ip = { events: [e('z', 'gym', 1, '2026-10-09')], custom: { trackers: [cA], proposals: [P('custom-a', 'gym'), P('custom-a', 'office')] } }
    const before = JSON.stringify([lp, ip]), m8 = mergeBackup(lp, ip)
    ok(m8.custom.proposals.length === 2 && JSON.stringify([lp, ip]) === before, 'M8 propuestas por (tracker, party), sin mutar')
    // L6 — límite semanal en la fusión
    {
      const lb = { events: [] as ActivityEvent[], custom: { trackers: [] as Tracker[], proposals: [] as Proposal[] } }
      const l6a = mergeBackup({ ...lb, custom: { ...lb.custom, limits: { beer: 2 } } }, { ...lb, custom: { ...lb.custom, limits: { beer: 3 } } })
      const l6b = mergeBackup(lb, { ...lb, custom: { ...lb.custom, limits: { beer: 3 } } })
      const pz = createTracker({ name: 'Pizza', branch: 'villain', type: 'count', xpPerUnit: 10 }, 'custom-pz')
      const l6c = mergeBackup({ ...lb, custom: { ...lb.custom, trackers: [pz] } }, { ...lb, custom: { ...lb.custom, trackers: [{ ...pz, weeklyLimit: 4 }] } })
      ok(l6a.conflicts.includes('Beer') && JSON.stringify(l6a.custom.limits) === '{"beer":2}' && !l6a.changed &&
        l6b.conflicts.includes('Beer') && !('limits' in l6b.custom) && l6c.conflicts.includes('Pizza'), 'L6 fusión de límites')
    }
  }

  // GY1–GY13 — módulo Gym
  {
    const gs = (id: string, weight: number, unit: 'kg' | 'lbs', reps: number, day = DEMO_DATE): GymSet => ({ id, exerciseId: 'bench-press', weight, unit, reps, occurredAt: `${day}T10:00:00` })
    ok(EXERCISES.length === 21 && new Set(EXERCISES.map(x => x.id)).size === 21 && GROUPS.length === 6 && GROUPS.every(g => EXERCISES.some(x => x.group === g.id)) &&
      !EXERCISES.some(x => x.id === 'plank') && EXERCISES.filter(x => x.kind === 'bodyweight').map(x => x.id).sort().join() === 'dips,leg-raise,pull-up', 'GY1 catálogo')
    ok(Math.abs(toKg(100, 'lbs') - 45.359) < 0.001 && convert(100, 'kg', 'lbs') === 220.5 && convert(102.5, 'kg', 'kg') === 102.5 &&
      fmtWeight(102.5, 'kg') === '102,5 kg' && parseWeight('102,5') === 102.5 && parseWeight('102.555') === 102.56 &&
      parseWeight('-1') === null && parseWeight('abc') === null && parseWeight('2001') === null &&
      stepWeight(100, 'kg', 1) === 102.5 && stepWeight(100, 'lbs', 1) === 105 && stepWeight(1, 'kg', -1) === 0, 'GY2 unidades')
    ok(Math.abs((e1rm(100, 5) ?? 0) - 116.667) < 0.01 && e1rm(100, 1) === 100 && e1rm(100, 13) === null && e1rm(0, 5) === null, 'GY3 Epley')
    const base = [gs('a', 100, 'kg', 5), gs('b', 225, 'lbs', 3), gs('c', 80, 'kg', 12), gs('d', 80, 'kg', 10)]
    const r4 = records(liveSets(base))
    const undoB: GymUndo = { id: 'u', undoes: 'b', occurredAt: base[1].occurredAt }
    const r4b = records(liveSets([...base, undoB]))
    ok(r4.maxWeight?.id === 'b' && r4.best1rm?.set.id === 'a' && r4.mostReps?.id === 'c' && r4b.maxWeight?.id === 'a', 'GY4 récords')
    const nm = 'Press banca'
    ok(beaten([], gs('x', 105, 'kg', 1)).length === 0 && beaten(base, gs('x', 105, 'kg', 1)).join() === 'weight' &&
      beaten(base, gs('x', 80, 'kg', 13)).join() === 'reps' && beaten(base, gs('x', 100, 'kg', 6)).join() === '1rm,reps' &&
      beaten(base, gs('x', 100, 'kg', 5)).length === 0 &&
      recordText(['weight'], gs('x', 105, 'kg', 1), nm, 'kg', 'load') === 'Nuevo récord en Press banca: peso máximo 105 kg', 'GY5 récord batido')
  }

  // GY11 (parte de importar) — copia sin `gym`
  {
    const old = parseBackup(JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: SEED_EVENTS, custom: { trackers: [], proposals: [] } }))
    ok(old !== null && old.gym === null && old.events.length === SEED_EVENTS.length, 'GY11 copia sin gym → gym null y eventos leídos')
  }

  // GY11 (fusión) y GY12 — gym en la fusión
  {
    const gsx = (id: string, weight: number): GymSet => ({ id, exerciseId: 'bench-press', weight, unit: 'kg', reps: 5, occurredAt: `${DEMO_DATE}T10:00:00` })
    const cu = { trackers: [] as Tracker[], proposals: [] as Proposal[] }
    const lg = { log: [gsx('s1', 100)], exercises: [], unit: 'lbs' as const }
    const L = { events: [] as ActivityEvent[], custom: cu, gym: lg }
    const g11 = mergeBackup(L, { events: [], custom: cu })
    ok(JSON.stringify(g11.gym) === JSON.stringify(lg) && g11.setsAdded === 0 && !g11.changed, 'GY11 fusión con copia sin gym: gym local igual')
    const inc = { events: [], custom: cu, gym: { log: [gsx('s1', 110), { id: 'u1', undoes: 's1', occurredAt: `${DEMO_DATE}T10:00:00` }, gsx('s9', 50)], exercises: [{ id: 'custom-1', name: 'Remo', group: 'back' as const, kind: 'load' as const }] } }
    const before = JSON.stringify([L, inc])
    const g12 = mergeBackup(L, inc)
    ok(g12.gym.log.map(x => x.id).join() === 's1,s1~2,u1,s9' && (g12.gym.log[2] as GymUndo).undoes === 's1~2' && g12.setsAdded === 3 && g12.exercisesAdded === 1 &&
      g12.gym.unit === 'lbs' && JSON.stringify([L, inc]) === before, 'GY12 colisión: id~2, undoes reasignado, sin mutar')
    const again = mergeBackup({ events: [], custom: cu, gym: g12.gym }, inc)
    ok(again.setsAdded === 0 && again.exercisesAdded === 0 && !again.changed, 'GY12 idempotente')
    const L2 = { ...L, gym: { ...lg, log: [gsx('s1', 100), { id: 'u0', undoes: 's1', occurredAt: `${DEMO_DATE}T10:00:00` }] } }
    const dup = mergeBackup(L2, { events: [], custom: cu, gym: { log: [gsx('s1', 100), { id: 'u7', undoes: 's1', occurredAt: `${DEMO_DATE}T10:00:00` }], exercises: [] } })
    ok(dup.setsAdded === 0 && dup.gym.log.length === 2, 'GY12 deshacer duplicado = ya estaba')
  }

  // GY6–GY10, GY13 — sesión automática
  {
    const D = DEMO_DATE, P = '2026-10-05'
    const man = (id: string, amount = 1, day = D): ActivityEvent => ({ id, trackerId: 'gym', amount, occurredAt: `${day}T09:00:00` })
    const gsx = (id: string, day = D): GymSet => ({ id, exerciseId: 'bench-press', weight: 60, unit: 'kg', reps: 8, occurredAt: `${day}T10:00:00` })
    const un = (id: string, of: string, day = D): GymUndo => ({ id, undoes: of, occurredAt: `${day}T10:00:00` })
    const a1 = autoSession([], D)!
    ok(a1.id === `gym-auto-${D}` && a1.occurredAt === `${D}T12:00:00` && a1.amount === 1 && autoSession([a1], D) === null && autoSession([man('m')], D) === null &&
      autoSession([], P)!.occurredAt.startsWith(P), 'GY6 sesión automática')
    const ids = () => `u${Math.random()}`
    const two = [gsx('s1'), gsx('s2')]
    const evA = [a1]
    const r1 = retractAuto(evA, [...two, un('x1', 's1')], D, ids)
    const r2 = retractAuto(evA, [...two, un('x1', 's1'), un('x2', 's2')], D, ids)
    const after = [...evA, ...r2]
    const manMinus = [man('m'), man('m2', -1)]
    const withMan = [man('m'), a1]
    const rm = retractAuto(withMan, [], D, ids)
    ok(r1.length === 0 && r2.length === 1 && r2[0].amount === -1 && r2[0].undoes === a1.id && r2[0].occurredAt === `${D}T12:00:00` &&
      dayTotal(after, 'gym', D) === 0 && autoSession(after, D)!.id === `gym-auto-${D}-2` &&
      retractAuto(manMinus, [], D, ids).length === 0 && rm.length === 1 && dayTotal([...withMan, ...rm], 'gym', D) === 1, 'GY7 deshacer')
    const cu = { trackers: [] as Tracker[], proposals: [] as Proposal[] }
    const A = { events: [a1], custom: cu, gym: { log: [gsx('a1'), gsx('a2')], exercises: [] } }
    const B = { events: [{ ...a1 }], custom: cu, gym: { log: [gsx('b1'), gsx('b2')], exercises: [] } }
    const m8 = mergeBackup(A, B)
    const m8b = mergeBackup({ events: m8.events, custom: cu, gym: m8.gym }, B)
    ok(m8.events.filter(e => e.id === a1.id).length === 1 && dayTotal(m8.events, 'gym', D) === 1 && liveSets(m8.gym.log).length === 4 && m8b.added === 0 && m8b.setsAdded === 0, 'GY8 dos dispositivos')
    const m9 = mergeBackup({ events: [man('rand')], custom: cu }, { events: [a1], custom: cu })
    ok(dayTotal(m9.events, 'gym', D) === 2, 'GY9 manual + automática')
    const ua = { id: 'ua', trackerId: 'gym', amount: -1, occurredAt: a1.occurredAt, undoes: a1.id }, ub = { ...ua, id: 'ub' }
    const m10 = mergeBackup({ events: [a1, ua], custom: cu }, { events: [a1, ub], custom: cu })
    const a2 = { id: `gym-auto-${D}-2`, trackerId: 'gym', amount: 1, occurredAt: a1.occurredAt }
    const m10b = mergeBackup({ events: [a1, ua, a2], custom: cu }, { events: [a1, ub], custom: cu })
    ok(dayTotal(m10.events, 'gym', D) === 0 && m10.existing === 2 && m10.added === 0 && dayTotal(m10b.events, 'gym', D) === 1, 'GY10 deshacer entre dispositivos')
    ok(get(deriveGame([a1], D), 'gym').xp.xp === 30 && get(deriveGame([man('m')], D), 'gym').xp.xp === 30, 'GY13 XP de la sesión automática = manual')
    // GY14 — ensureAuto
    {
      const P2 = '2026-10-05'
      const log1 = [gsx('s1'), un('x1', 's1'), gsx('s2')]
      const e14 = ensureAuto([man('m'), man('m2', -1)], log1, [D])
      const e14b = ensureAuto([a1, { id: 'ua', trackerId: 'gym', amount: -1, occurredAt: a1.occurredAt, undoes: a1.id }], log1, [D])
      const two14 = [gsx('t1'), gsx('t2', P2)]
      const e14c = ensureAuto([], two14, [D, P2, D])
      ok(e14.length === 1 && e14[0].id === `gym-auto-${D}` && e14b.length === 1 && e14b[0].id === `gym-auto-${D}-2` &&
        ensureAuto([man('m')], log1, [D]).length === 0 && ensureAuto([], [gsx('s1'), un('x1', 's1')], [D]).length === 0 &&
        e14c.map(e => e.id).join() === `gym-auto-${D},gym-auto-${P2}` && ensureAuto(e14c, two14, [D, P2]).length === 0 &&
        setDays([gsx('a', P2), gsx('b'), gsx('c', P2), un('u', 'b')]).join() === P2, 'GY14 ensureAuto')
    }
    // GY15 — weeklyBest1rm
    {
      const D15 = D, mon = mondayOf(D15)
      const mk = (id: string, w: number, u: 'kg' | 'lbs', r: number, day: string): GymSet => ({ id, exerciseId: 'bench-press', weight: w, unit: u, reps: r, occurredAt: `${day}T10:00:00` })
      const wb = weeklyBest1rm([mk('a', 100, 'kg', 5, D15), mk('b', 220, 'lbs', 3, D15), mk('c', 200, 'kg', 5, D15), un('uc', 'c'), mk('d', 80, 'kg', 13, addDays(mon, -7)),
        mk('e', 60, 'kg', 5, addDays(D15, -63)), { ...mk('f', 90, 'kg', 5, D15), exerciseId: 'squat' }], 'bench-press', D15)
      ok(wb.length === 8 && wb.filter(w => w.current).length === 1 && wb[7].current && wb[7].monday === mon && Math.abs((wb[7].kg ?? 0) - 116.667) < 0.01 &&
        wb[6].kg === null && wb[0].kg === null && wb.slice(0, 7).every(w => w.kg === null) &&
        Math.abs((weeklyBest1rm([mk('b', 220, 'lbs', 3, D15)], 'bench-press', D15)[7].kg ?? 0) - 109.77) < 0.01, 'GY15 weeklyBest1rm')
    }
    // GY16 — groupVolume
    {
      const mk = (id: string, ex: string, w: number, u: 'kg' | 'lbs', r: number, day: string): GymSet => ({ id, exerciseId: ex, weight: w, unit: u, reps: r, occurredAt: `${day}T10:00:00` })
      const mon = mondayOf(D), cx = { id: 'custom-1', name: 'Remo', group: 'back' as const, kind: 'load' as const }
      const log16 = [mk('a', 'bench-press', 100, 'kg', 5, D), mk('b', 'bench-press', 220, 'lbs', 5, D), mk('c', 'pull-up', 0, 'kg', 10, D), mk('d', 'custom-1', 50, 'kg', 10, D),
        mk('e', 'ghost', 50, 'kg', 10, D), mk('f', 'bench-press', 100, 'kg', 10, mon), mk('g', 'bench-press', 80, 'kg', 5, addDays(mon, -7)), mk('h', 'bench-press', 80, 'kg', 5, addDays(D, -7)),
        mk('i', 'bench-press', 80, 'kg', 5, addDays(D, -6)), mk('j', 'bench-press', 999, 'kg', 5, D)]
      const v = groupVolume([...log16, un('uj', 'j')], [cx], D)
      const chest = v[0], back = v[1]
      ok(v.map(r => r.group).join() === GROUPS.map(g => g.id).join() && chest.sets === 3 && Math.abs(chest.kg - (500 + 220 * LB_KG * 5 + 1000)) < 0.01 &&
        Math.abs(fromKg(500 + 220 * LB_KG * 5, 'lbs') - 2202.3) < 0.1 && back.sets === 2 && Math.abs(back.kg - 500) < 0.01 &&
        chest.prevSets === 2 && Math.abs(chest.prevKg - 800) < 0.01 && v.slice(2).every(r => r.sets === 0 && r.prevSets === 0), 'GY16 groupVolume')
    }
    // GY17 — gymDay
    {
      const mk = (id: string, ex: string): GymSet => ({ id, exerciseId: ex, weight: 50, unit: 'kg', reps: 5, occurredAt: `${D}T10:00:00` })
      const g17 = gymDay([mk('a', 'bench-press'), mk('b', 'bench-press'), mk('c', 'squat'), un('uc', 'c')], D)
      const g17b = gymDay([mk('a', 'bench-press'), mk('b', 'bench-press'), mk('c', 'squat')], D)
      ok(g17.sets === 2 && g17.exercises === 1 && g17b.sets === 3 && g17b.exercises === 2 && gymDay([mk('a', 'squat')], P).sets === 0 && gymDay([], D).exercises === 0, 'GY17 gymDay')
    }
    // GY18 — routineFromDay / routineProgress
    {
      const mk = (id: string, ex: string, day = D): GymSet => ({ id, exerciseId: ex, weight: 50, unit: 'kg', reps: 5, occurredAt: `${day}T10:00:00` })
      const l18 = [mk('a', 'squat'), mk('b', 'bench-press'), mk('c', 'squat'), mk('d', 'bench-press'), mk('e', 'bench-press', P)]
      const r18 = routineFromDay(l18, D, 'Pierna', 'routine-1')!
      const big = routineFromDay(Array.from({ length: 12 }, (_, i) => mk(`x${i}`, 'squat')), D, 'Grande', 'routine-2')!
      const p18 = routineProgress({ id: 'routine-1', name: 'R', items: [{ exerciseId: 'squat', sets: 2 }, { exerciseId: 'bench-press', sets: 3 }] }, l18, D)
      ok(r18.items.map(i => `${i.exerciseId}:${i.sets}`).join() === 'squat:2,bench-press:2' && big.items[0].sets === 10 && routineFromDay([mk('a', 'squat')], P, 'X', 'routine-3') === null &&
        p18[0].done === 2 && p18[0].complete && p18[1].done === 2 && !p18[1].complete && routineProgress(r18, l18, P)[1].done === 1, 'GY18 rutinas del día')
    }
    // GY19 — readGym con rutinas
    {
      const rt = { id: 'routine-a', name: 'Push', items: [{ exerciseId: 'bench-press', sets: 3 }] }
      const g0 = readGym({ log: [], exercises: [] })!, g1 = readGym({ log: [], exercises: [], routines: [rt] })!
      const g2 = readGym({ log: [], exercises: [], routines: [{ ...rt, items: [...rt.items, { exerciseId: 'squat', sets: 0 }] }] })!
      const g3 = readGym({ log: [], exercises: [], routines: [{ ...rt, items: [{ exerciseId: 'squat', sets: 0 }] }] })!
      const g4 = readGym({ log: [], exercises: [], routines: 5 })!
      const old = parseBackup(JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: [], custom: { trackers: [], proposals: [] }, gym: { log: [], exercises: [], unit: 'lbs' } }))
      ok(!('routines' in g0.data) && g0.dropped === 0 && JSON.stringify(g1.data.routines) === JSON.stringify([rt]) && g1.dropped === 0 && g1.fixed === 0 &&
        g2.fixed === 1 && g2.data.routines?.[0].items.length === 1 && g3.dropped === 1 && !('routines' in g3.data) && g4.dropped === 1 && !('routines' in g4.data) &&
        old !== null && old.gym?.unit === 'lbs' && !('routines' in (old.gym ?? {})), 'GY19 readGym con rutinas')
    }
    // GY20 — fusión de rutinas
    {
      const cu = { trackers: [] as Tracker[], proposals: [] as Proposal[] }
      const ra = { id: 'routine-a', name: 'Push', items: [{ exerciseId: 'bench-press', sets: 3 }] }
      const rb = { id: 'routine-b', name: 'Pull', items: [{ exerciseId: 'pull-up', sets: 4 }] }
      const L = { events: [] as ActivityEvent[], custom: cu, gym: { log: [], exercises: [], routines: [ra] } }
      const inc = { events: [], custom: cu, gym: { log: [], exercises: [], routines: [{ ...ra, items: [{ exerciseId: 'squat', sets: 1 }] }, rb] } }
      const before = JSON.stringify([L, inc])
      const m = mergeBackup(L, inc)
      const again = mergeBackup({ events: [], custom: cu, gym: m.gym }, inc)
      const none = mergeBackup(L, { events: [], custom: cu, gym: { log: [], exercises: [] } })
      const nog = mergeBackup({ events: [], custom: cu, gym: { log: [], exercises: [] } }, { events: [], custom: cu })
      ok(m.gym.routines?.map(r => r.id).join() === 'routine-a,routine-b' && m.routinesAdded === 1 && m.changed && m.conflicts.join() === 'Push' && JSON.stringify(m.gym.routines?.[0]) === JSON.stringify(ra) &&
        again.routinesAdded === 0 && !again.changed && JSON.stringify([L, inc]) === before &&
        !none.changed && JSON.stringify(none.gym.routines) === JSON.stringify([ra]) && !('routines' in nog.gym), 'GY20 fusión de rutinas')
    }
    // GY21 — la sesión repuesta tras deshacer la manual no cambia la XP de gym
    {
      const m21 = man('m'), u21 = { id: 'um', trackerId: 'gym', amount: -1, occurredAt: m21.occurredAt, undoes: 'm' }
      ok(get(deriveGame([m21, u21, a1], D), 'gym').xp.xp === get(deriveGame([m21], D), 'gym').xp.xp, 'GY21 XP neta 0 al reponer la sesión')
    }
    // GY22 — undoMany (deshacer un comando de voz de varias series)
    {
      const D22 = DEMO_DATE, ids22 = () => `u${Math.random()}`
      const g22 = (id: string): GymSet => ({ id, exerciseId: 'bench-press', weight: 80, unit: 'kg', reps: 5, occurredAt: `${D22}T10:00:00` })
      const auto22 = autoSession([], D22)!
      const prev = g22('p'), three = [g22('c1'), g22('c2'), g22('c3')]
      const log22 = [prev, ...three]
      const us = undoMany(log22, ['c1', 'c2', 'c3'], ids22)
      const only = [...three], us2 = undoMany(only, ['c1', 'c2', 'c3'], ids22)
      const dup = undoMany([...log22, { id: 'x', undoes: 'c1', occurredAt: `${D22}T10:00:00` }], ['c1', 'c2', 'c2', 'ghost'], ids22)
      ok(us.length === 3 && us.every(u => u.occurredAt === `${D22}T10:00:00`) && retractAuto([auto22], [...log22, ...us], D22, ids22).length === 0 &&
        retractAuto([auto22], [...only, ...us2], D22, ids22).length === 1 && dup.length === 1 && dup[0].undoes === 'c2', 'GY22 undoMany: solo series vivas, una vez; la sesión se retira solo sin series vivas')
    }
  }

  // VZ1–VZ13 — parser de voz (ES/EN)
  {
    const EX = [...EXERCISES, { id: 'custom-x', name: 'Press 45 grados', group: 'chest' as const, kind: 'load' as const }]
    const p = (t: string, u: 'kg' | 'lbs' = 'kg') => parseGym(t, EX, u)
    const f = (d: GymDraft) => `${d.exerciseId}/${d.weight} ${d.unit}/${d.reps}/${d.sets}`
    const aliasesOf = (id: string) => [normalizeVoice(EXERCISES.find(x => x.id === id)!.name), ...(ALIASES[id] ?? []).map(normalizeVoice)]
    const all = EXERCISES.flatMap(x => aliasesOf(x.id).map(a => [x.id, a] as const))
    ok(EXERCISES.every(x => aliasesOf(x.id).length >= 2) && all.every(([id, a]) => all.filter(([, b]) => b === a).every(([i2]) => i2 === id)) &&
      EXERCISES.every(x => matchExercise(normalizeVoice(x.name), EXERCISES)?.id === x.id), 'VZ1 alias: ≥ 2 por ejercicio, sin repetidos entre ids, el nombre resuelve a sí mismo')
    ok(['peso muerto rumano 100 kg 8', 'peso muerto 140 5', 'curl martillo de biceps 14 10', 'incline bench 30 kg 10'].map(t => p(t).exerciseId).join() === 'romanian-deadlift,deadlift,hammer-curl,incline-db-press', 'VZ2 gana el alias más largo')
    ok(f(p('80 kilos press banca 5 repeticiones')) === 'bench-press/80 kg/5/1' && f(p('press banca 5 kg 8')) === 'bench-press/5 kg/8/1', 'VZ3 con unidad gana la unidad')
    ok(f(p('press banca 5 80')) === 'bench-press/80 kg/5/1' && f(p('sentadilla 100 por 5')) === 'squat/100 kg/5/1', 'VZ4 sin unidad, el mayor es el peso')
    ok(f(p('squat 225 pounds 5 reps')) === 'squat/225 lbs/5/1' && f(p('sentadilla 100 libras 5')) === 'squat/100 lbs/5/1' &&
      f(p('bench 185 5', 'lbs')) === 'bench-press/185 lbs/5/1' && f(p('bench 185 5')) === 'bench-press/185 kg/5/1', 'VZ5 libras, y unidad por defecto')
    ok(f(p('dominadas 12')) === 'pull-up/0 kg/12/1' && f(p('fondos 20 kilos 8')) === 'dips/20 kg/8/1' && f(p('pull ups 10 reps')) === 'pull-up/0 kg/10/1', 'VZ6 peso corporal')
    ok(f(p('press banca 80 kg 3x5')) === 'bench-press/80 kg/5/3' && f(p('sentadilla 100 kilos 3 series de 5')) === 'squat/100 kg/5/3' &&
      f(p('bench press 3 sets of 5 100 kg')) === 'bench-press/100 kg/5/3' && f(p('dominadas 3x8')) === 'pull-up/0 kg/8/3' &&
      f(p('press banca tres series de cinco 80 kilos')) === 'bench-press/80 kg/5/3', 'VZ7 varias series')
    ok(f(p('press banca 80x5')) === 'bench-press/80 kg/5/1' && f(p('curl martillo 12,5 por 10')) === 'hammer-curl/12.5 kg/10/1' &&
      f(p('sentadilla 3x5')) === 'squat/null kg/5/3' && !isComplete(p('sentadilla 3x5'), EX), 'VZ8 par «A x B»')
    ok(f(p('press banca 62,5 kg 8')) === 'bench-press/62.5 kg/8/1' && f(p('press banca 62.5 kg 8')) === 'bench-press/62.5 kg/8/1' &&
      f(p('press banca 80, 5 repeticiones')) === 'bench-press/80 kg/5/1', 'VZ9 decimales y comas')
    const v10 = ['80 kilos 5 repeticiones', 'press banca 80', 'press banca 5 repeticiones', ''].map(t => p(t))
    ok(v10.map(f).join('|') === 'null/80 kg/5/1|bench-press/80 kg/null/1|bench-press/null kg/5/1|null/null kg/null/1' && v10.every(d => !isComplete(d, EX)), 'VZ10 incompletos')
    ok(f(p('press 45 grados 40 kg 10')) === 'custom-x/40 kg/10/1' && f(p('hip thrust 100 10') /* el propio archivado no está en la lista activa */) === 'null/100 kg/10/1', 'VZ11 ejercicio propio, el 45 del nombre no cuenta; archivado fuera')
    const v12 = ['press banca 2500 kg 5', 'press banca 80 kg 1000 reps', 'press banca 80 kg 12 series de 5', 'press banca 0 kg 5'].map(t => p(t))
    ok(v12[0].weight === null && v12[1].reps === null && v12[2].sets === 12 && !isComplete(v12[2], EX) && v12[3].weight === null, 'VZ12 rangos')
    // VZ17 — números en palabra: decenas, compuestos, centenas; palabra-número sin resolver = incompleto
    ok(f(p('press banca treinta y cinco kilos 8')) === 'bench-press/35 kg/8/1' && f(p('press banca ochenta y cinco kilos cinco')) === 'bench-press/85 kg/5/1' &&
      f(p('press banca ochenta kilos cinco')) === 'bench-press/80 kg/5/1' && f(p('press banca veinticinco kilos diez')) === 'bench-press/25 kg/10/1' &&
      f(p('sentadilla ciento veinte kilos cinco')) === 'squat/120 kg/5/1' && f(p('sentadilla ciento treinta y cinco kilos cinco')) === 'squat/135 kg/5/1' &&
      f(p('squat thirty-five kilos 8')) === 'squat/35 kg/8/1' && f(p('squat thirty five kilos 8')) === 'squat/35 kg/8/1' && f(p('squat one hundred twenty kilos 5')) === 'squat/120 kg/5/1' &&
      f(p('bench ninety kilos 3 sets of five')) === 'bench-press/90 kg/5/3', 'VZ17 números en palabra')
    ok(f(p('press banca ochenta cinco kilos 5 repeticiones')) === 'bench-press/85 kg/5/1' && f(p('sentadilla ochenta cinco por cinco')) === 'squat/85 kg/5/1' &&
      f(p('press banca 3 series de ochenta cinco')) === 'bench-press/null kg/85/3' && !isComplete(p('press banca 3 series de ochenta cinco'), EX), 'VZ19 decena + unidad sin «y» se fusiona (ES como EN)')
    ok(!isComplete(p('press banca mil kilos 5'), EX) && !isComplete(p('press banca cero kilos 5'), EX) && !isComplete(p('press banca medio kilo 5'), EX) &&
      p('press banca mil kilos 5').exerciseId === 'bench-press', 'VZ17 palabra-número sin resolver: incompleto')
    ok(f(p('dominadas 2500 kg 5')) === 'pull-up/null kg/5/1' && !isComplete(p('dominadas 2500 kg 5'), EX) && f(p('dominadas 5')) === 'pull-up/0 kg/5/1' && isComplete(p('dominadas 5'), EX) &&
      fromAI({ exerciseId: 'pull-up', weight: 2500, unit: 'none', reps: 5, sets: 1 }, EX, 'kg')?.weight === null && fromAI({ exerciseId: 'pull-up', weight: null, unit: 'none', reps: 5, sets: 1 }, EX, 'kg')?.weight === 0,
      'VZ18 peso corporal: no dicho = 0, dicho fuera de rango = incompleto')
    const bd = (id: string, w: number, u: 'kg' | 'lbs', r: number, s: number): GymDraft => ({ exerciseId: id, weight: w, unit: u, reps: r, sets: s })
    ok(draftText(bd('bench-press', 80, 'kg', 5, 1), EX, 'kg') === 'Press banca · 80 kg × 5' && draftText(bd('bench-press', 80, 'kg', 5, 3), EX, 'kg') === 'Press banca · 3 series · 80 kg × 5' &&
      draftText(bd('pull-up', 0, 'kg', 12, 1), EX, 'kg') === 'Dominadas · 12 reps' && draftText({ ...bd('x', 1, 'kg', 1, 1), exerciseId: null }, EX, 'kg') === 'Ejercicio sin reconocer', 'VZ13 draftText')
    // VZ14–VZ16 — respuesta de Haiku, elección y esquema
    const fa = (o: unknown) => fromAI(o, EX, 'kg')
    const base14 = { exerciseId: 'squat', weight: 100, unit: 'none', reps: 5, sets: 3 }
    ok(f(fa(base14)!) === 'squat/100 kg/5/3' && fa({ ...base14, exerciseId: 'ghost' }) === null && fa({ ...base14, exerciseId: 'none' })?.exerciseId === null &&
      fa({ ...base14, sets: 0 }) === null && fa({ ...base14, weight: '80' })?.weight === null && fa({ exerciseId: 'pull-up', weight: null, unit: 'none', reps: 8, sets: 1 })?.weight === 0 &&
      fa({ ...base14, unit: 'lbs' })?.unit === 'lbs' && fa(null) === null && fa([]) === null, 'VZ14 fromAI')
    {
      const full1 = bd('bench-press', 80, 'kg', 5, 1), full2 = bd('squat', 100, 'kg', 5, 3), hole = { ...full1, reps: null }
      const a = pickDraft(full2, full1, EX), b = pickDraft(hole, full1, EX), c = pickDraft(null, full1, EX), d = pickDraft(hole, { ...full1, weight: null }, EX)
      ok(a.source === 'ai' && a.draft === full2 && b.source === 'parser' && b.draft === full1 && c.source === 'parser' && d.source === 'ai' && d.draft === hole, 'VZ15 pickDraft')
    }
    {
      const sch = voiceSchema(['a', 'b']), pr = voicePrompt('a <b> c', [{ id: 'a', name: 'X<>Y', group: 'chest', kind: 'load' }], 'kg')
      ok(JSON.stringify(sch.properties.exerciseId.enum) === '["a","b","none"]' && sch.required.length === 5 && sch.additionalProperties === false &&
        pr.includes('<frase>a  b  c</frase>') && pr.includes('a: X  Y (carga)') && !pr.includes('<b>'), 'VZ16 esquema y prompt')
    }
  }

  // CV1–CV11 — captura por voz: router determinista
  {
    const mk = (name: string, type: Tracker['type'], unit?: string) => createTracker({ name, branch: 'hero', type, xpPerUnit: 1, unit }, `custom-${name}`)
    const archived = { ...mk('Ajedrez', 'duration'), archived: true }
    const act = [...TRACKERS, mk('Theatre', 'count'), mk('Offline', 'count'), mk('Mindfulness', 'duration'), mk('Cómics', 'custom', 'páginas')]
    const ctx: CaptureCtx = { exercises: EXERCISES, trackers: act, all: [...act, archived], unit: 'kg' }
    const f = (t: string): string => {
      const c = routeCapture(t, ctx)
      if (c.kind === 'gym') return `gym/${c.draft.exerciseId}/${c.draft.weight}x${c.draft.reps}/${isComplete(c.draft, EXERCISES)}`
      if (c.kind === 'tracker') return `tracker/${c.trackerId}/${c.amount}/${c.problem}`
      if (c.kind === 'new') return `new/${c.habit.name}/${c.habit.type}${c.habit.unit ? `:${c.habit.unit}` : ''}/${c.habit.amount}/${c.habit.confidence}${c.habit.archivedDup ? `/dup:${c.habit.archivedDup}` : ''}`
      return c.kind
    }
    ok(f('80kg bench press 5 reps') === 'gym/bench-press/80x5/true' && f('Read 50 pages of the name of the wind') === 'tracker/reading/100/null' &&
      ['ate a burguer', 'eat a burguer', 'burguer'].every(t => f(t) === 'tracker/burgers/1/null') && f('grounding 30 min') === 'new/Grounding/duration/30/baja', 'CV1 aceptación')
    ok(f('comí una hamburguesa') === 'tracker/burgers/1/null' && f('he leído 20 páginas') === 'tracker/reading/40/null' && f('30 minutos de grounding') === 'new/Grounding/duration/30/baja' &&
      f('I read for 1 hour') === 'tracker/reading/60/null' && f('media hora de lectura') === 'tracker/reading/30/null' && f('corrí 5 km') === 'tracker/running/5/null' &&
      f('drank 3 beers') === 'tracker/beer/3/null' && f('dos cervezas') === 'tracker/beer/2/null' && f('fui al gimnasio') === 'tracker/gym/1/null', 'CV2 variantes ES/EN')
    ok(['ayer leí 20 páginas', 'yesterday I ate a burger', 'mañana correré 5 km', 'el otro día fui al gym', 'the other day I ran 5 km', 'hace dos días bebí 3 cervezas', 'el lunes corrí 5 km'].every(t => f(t) === 'other-day') &&
      f('esta mañana corrí 5 km') === 'tracker/running/5/null' && f('this morning I read 10 pages') === 'tracker/reading/20/null', 'CV3 otro día')
    ok(f('cómics 10 páginas') === 'tracker/custom-Cómics/10/null' && f('corrí 30 minutos') === 'tracker/running/null/unit' && f('gym 1 hora') === 'tracker/gym/null/unit' &&
      f('leí 2 km') === 'tracker/reading/null/unit' && convNote({ value: 50, family: 'pages', word: 'pages' }, 100) === '50 páginas ≈ 100 min', 'CV4 páginas → min solo en Reading')
    ok(!f('the cat of a neighbour').startsWith('tracker') && !f('30 min de grounding').startsWith('tracker') && f('a theatre play') === 'tracker/custom-Theatre/1/null', 'CV5 stopwords')
    ok(f('bench press 80 kg 5 reps at the gym') === 'gym/bench-press/80x5/true' && f('fui al gym') === 'tracker/gym/1/null', 'CV6 orden: un ejercicio gana al hábito')
    ok(f('fui a bjj') === 'tracker/bjj/1/null' && f('leí un libro') === 'tracker/reading/30/null' && f('corrí 5') === 'tracker/running/5/null' && f('corrí 5,5 km') === 'tracker/running/6/null' &&
      f('leí 5000 minutos') === 'tracker/reading/null/range' && f('3 cervezas') === 'tracker/beer/3/null', 'CV7 cantidades')
    ok(f('medité 10 minutos') === 'new/Medité/duration/10/baja' && f('hice 20 flexiones') === 'new/Flexiones/count/20/baja' && f('3 vasos de agua') === 'new/Agua/custom:vasos/3/media' &&
      f('ajedrez 1 hora') === 'new/Ajedrez/duration/60/baja/dup:Ajedrez' && !isReady(routeCapture('ajedrez 1 hora', ctx), ctx), 'CV10 nombre del hábito nuevo')
    ok(captureNorm('una hora') === '1 hora' && captureNorm('half an hour') === '30 min' && isOtherDay(captureNorm('el viernes')) && !isOtherDay(captureNorm('esta mañana')), 'CV11 captureNorm e isOtherDay')
    {
      const ex = (t: string) => exactTracker(captureNorm(t), ctx.trackers, ALL_UNITS)?.id
      const two = [mk('Cold shower', 'count'), mk('Hot shower', 'count')]
      ok(ex('Read 50 pages of the name of the wind') === 'reading' && ex('corrí 5 km') === 'running' && ex('fui al gimnasio') === 'gym' && ex('ate a burguer') === undefined &&
        ex('lectur') === undefined && exactTracker('shower 10 min', two) === undefined, 'CV12 exactTracker')
      const sure = (t: string) => deviceSure(routeCapture(t, ctx), ctx)
      ok(['80kg bench press 5 reps', 'Read 50 pages of the name of the wind', 'corrí 30 minutos'].every(sure) &&
        !['press banca 80', 'ate a burguer', 'grounding 30 min', 'ayer leí 20 páginas'].some(sure), 'CV13 deviceSure')
    }
    // MC1–MC5 — memoria de frases
    {
      ok(memoKey('Read 50 pages of the name of the wind') === 'read name wind' && memoKey('Read 30 pages of the name of the wind') === 'read name wind' &&
        ['ate a burguer', 'eat a burguer', 'burguer'].every(t => memoKey(t) === 'burguer') &&
        memoKey('la máquina de piernas 100 10') === 'maquina piernas' && memoKey('máquina de piernas 120 kilos 8 repeticiones') === 'maquina piernas' &&
        memoKey('30') === null && memoKey('ayer leí 20 páginas') === null, 'MC1 memoKey')
      const aiTrk = (text: string, id: string, source: 'ai' | 'parser' | 'memory' = 'ai'): CaptureCommand => ({ kind: 'tracker', text, source, trackerId: id, amount: 1, said: null, problem: null })
      const same = [] as Memo
      const m1 = learn(same, aiTrk('burguer', 'beer'))
      const m2 = learn(m1, aiTrk('ate a burguer', 'burgers'))
      const many = Array.from({ length: MEMO_MAX + 1 }, (_, i) => 'zq' + String.fromCharCode(97 + Math.floor(i / 26), 97 + i % 26)).reduce<Memo>((m, k) => learn(m, aiTrk(k, 'beer')), [])
      const old = learn(learn(learn([], aiTrk('alpha', 'beer')), aiTrk('bravo', 'beer')), aiTrk('alpha', 'beer', 'memory'))
      ok(learn(same, aiTrk('burguer', 'beer', 'parser')) === same && m1.length === 1 && m2.length === 1 && m2[0].id === 'burgers' &&
        many.length === MEMO_MAX && !many.some(e => e.k === 'zqaa') && old[old.length - 1].k === 'alpha' &&
        forget(m2, 'burguer').length === 0 && forget(m2, 'zzzz yyyy') === m2, 'MC2 learn/forget')
      const good = { v: 1, entries: [{ k: 'a', kind: 'gym', id: 'x' }] }
      const big = { v: 1, entries: Array.from({ length: 250 }, (_, i) => ({ k: `k${i}`, kind: 'tracker', id: 'x' })) }
      const dirty = readMemo({ v: 1, entries: [{ k: 'a', kind: 'otro', id: 'x' }, { k: '', kind: 'gym', id: 'x' }, { k: 'b', kind: 'gym', id: 5 }, { k: 'c', kind: 'gym', id: 'x' }, { k: 'c', kind: 'tracker', id: 'y' }] })
      const bigR = readMemo(big)
      ok(readMemo(null).length === 0 && readMemo('x').length === 0 && readMemo({ v: 2, entries: [] }).length === 0 && readMemo(good).length === 1 &&
        dirty.length === 1 && dirty[0].kind === 'tracker' && bigR.length === MEMO_MAX && bigR[0].k === 'k50', 'MC3 readMemo')
      const mctx = (memo?: Memo, extra: Partial<CaptureCtx> = {}): CaptureCtx => ({ ...ctx, memo, ...extra })
      const gm: Memo = [{ k: 'maquina piernas', kind: 'gym', id: 'leg-press' }, { k: 'barra alta', kind: 'gym', id: 'pull-up' }, { k: 'bread', kind: 'tracker', id: 'reading' }, { k: 'viejo', kind: 'tracker', id: 'custom-Ajedrez' }]
      const g1 = recall('máquina de piernas 120 kilos 8', mctx(gm)), g2 = recall('barra alta 12', mctx(gm)), t1 = recall('bread 20 pages', mctx(gm))
      ok(g1?.kind === 'gym' && g1.source === 'memory' && g1.draft.exerciseId === 'leg-press' && g1.draft.weight === 120 && g1.draft.reps === 8 && isComplete(g1.draft, EXERCISES) &&
        g2?.kind === 'gym' && g2.draft.weight === 0 && g2.draft.reps === 12 && isComplete(g2.draft, EXERCISES) &&
        t1?.kind === 'tracker' && t1.trackerId === 'reading' && t1.amount === 40 && recall('viejo 10 min', mctx(gm)) === null && recall('bread 20 pages', mctx()) === null &&
        recall('máquina de piernas 120 8', mctx(gm, { exercises: EXERCISES.filter(e => e.id !== 'leg-press') })) === null, 'MC4 recall')
      const lc = (t: string, memo?: Memo) => localCapture(t, mctx(memo))
      const a = lc('ayer leí 20 páginas'), b = lc('80kg bench press 5 reps'), c = lc('ate a burguer'), d = lc('ate a burguer', [{ k: 'burguer', kind: 'tracker', id: 'burgers' }])
      const e = lc('máquina de piernas 100', gm), f2 = lc('ate a burguer', [{ k: 'burguer', kind: 'tracker', id: 'custom-Ajedrez' }])
      ok(a.done && a.cmd.kind === 'other-day' && b.done && b.cmd.source === 'parser' && !c.done && c.cmd.source === 'parser' &&
        d.done && d.cmd.source === 'memory' && d.cmd.kind === 'tracker' && d.cmd.trackerId === 'burgers' && d.cmd.amount === 1 &&
        !e.done && e.cmd.source === 'memory' && !f2.done && f2.cmd.source === 'parser', 'MC5 localCapture')
    }
    // CV6 (combinación) y CV8 — captureFromAI
    {
      const ai: CaptureCommand = { kind: 'new', text: 'x', source: 'ai', habit: { name: 'Zumba', branch: 'hero', type: 'count', amount: 1, confidence: 'alta', reason: 'r' }, said: null }
      const gymFull = (src: 'ai' | 'parser'): CaptureCommand => ({ kind: 'gym', text: 'x', source: src, draft: { exerciseId: 'bench-press', weight: 80, unit: 'kg', reps: 5, sets: 1 } })
      const trk = (src: 'ai' | 'parser', id = 'beer', problem: 'unit' | null = null): CaptureCommand => ({ kind: 'tracker', text: 'x', source: src, trackerId: id, amount: problem ? null : 1, said: null, problem })
      const unk: CaptureCommand = { kind: 'unknown', text: 'x', source: 'parser' }
      const od: CaptureCommand = { kind: 'other-day', text: 'x', source: 'parser' }
      ok(pickCapture(ai, trk('parser'), ctx).kind === 'new' && pickCapture(gymFull('ai'), trk('parser'), ctx).kind === 'gym' && pickCapture(unk, trk('parser'), ctx).kind === 'unknown' &&
        pickCapture(null, trk('parser'), ctx).source === 'parser' && pickCapture(trk('ai', 'beer', 'unit'), trk('parser'), ctx).source === 'parser' &&
        pickCapture(trk('ai', 'beer'), trk('parser', 'burgers'), ctx).source === 'ai' && (pickCapture(trk('ai', 'running', 'unit'), unk, ctx) as { trackerId: string }).trackerId === 'running' &&
        pickCapture(trk('ai'), od, ctx).kind === 'other-day' && pickCapture(od, trk('parser'), ctx).kind === 'other-day', 'CV6 pickCapture: si la IA respondió, decide la IA')
      const base = { kind: 'tracker', otherDay: false, exerciseId: 'none', weight: null, weightUnit: 'none', reps: null, sets: 1, trackerId: 'reading', amount: 50, amountUnit: 'pages', unitWord: 'pages',
        name: '', branch: 'hero', confidence: 'baja', type: 'count', customUnit: '', reason: '' }
      const fa = (o: Record<string, unknown>) => captureFromAI({ ...base, ...o }, 'x', ctx)
      const newo = { kind: 'new', trackerId: 'none', amount: 30, amountUnit: 'min', unitWord: 'min', name: 'Grounding', confidence: 'alta', type: 'duration', reason: 'r' }
      const r8 = fa({}) as { amount: number } | null, b8 = fa({ kind: 'new', trackerId: 'none', name: 'beer', amountUnit: 'none', amount: 2, unitWord: '' }) as { kind: string; trackerId: string; amount: number } | null
      ok(fa({ trackerId: 'ghost' }) === null && fa({ trackerId: 'custom-Ajedrez' }) === null && fa({ ...newo, name: 'X' }) === null && fa({ ...newo, type: 'custom', customUnit: '' }) === null &&
        fa({ ...newo, confidence: 'seguro' }) === null && fa({ otherDay: true })?.kind === 'other-day' && b8?.kind === 'tracker' && b8.trackerId === 'beer' && b8.amount === 2 && r8?.amount === 100 &&
        (fa(newo) as { habit: { amount: number; confidence: string } }).habit.amount === 30 && (fa(newo) as { habit: { confidence: string } }).habit.confidence === 'alta' && fa({ kind: 'none' })?.kind === 'unknown' && captureFromAI(null, 'x', ctx) === null, 'CV8 captureFromAI')
      const sch = captureSchema(['a'], ['b']), pr = capturePrompt('hola <b>', ctx)
      ok(sch.properties.exerciseId.enum.join() === 'a,none' && sch.properties.trackerId.enum.join() === 'b,none' && sch.required.length === 17 && sch.required.every(k => k in sch.properties) &&
        sch.additionalProperties === false && !pr.includes('Ajedrez') && !pr.includes('<b>') && pr.includes('<habitos>') && pr.includes('reading: Reading · HERO · min'), 'CV9 esquema y prompt')
    }
  }

  // FD — módulo Comida
  {
    const fd = DEMO_DATE, fdY = addDays(DEMO_DATE, -1)
    const arroz = CATALOG.find(f => f.id === 'rice-white-cooked')!
    const cat = CATALOG, uniq = (xs: string[]) => new Set(xs).size === xs.length
    ok(cat.length >= 100 && cat.length <= 150 && uniq(cat.map(f => f.id)) && cat.every(f => /^[a-z0-9-]+$/.test(f.id) && !f.id.startsWith('food-')) && uniq(cat.map(f => fold(f.name))) &&
      cat.every(f => [f.kcal, f.p, f.c, f.f].every(x => Number.isFinite(x) && x >= 0) && f.kcal <= 900 && f.p + f.c + f.f <= 100 && Math.abs(f.kcal - (4 * f.p + 4 * f.c + 9 * f.f)) <= Math.max(20, 0.12 * f.kcal) &&
        (f.source === 'usda' || f.source === 'bedca') && !!f.ref && (f.source !== 'usda' || /^\d+$/.test(f.ref!)) && (f.servings ?? []).every(s => s.qty > 0) && uniq((f.servings ?? []).map(s => s.name))), 'FD1 catálogo coherente')
    const fe = makeEntry({ ...arroz, kcal: 130 }, { qty: 100, serving: { name: 'Unidad', n: 2 } }, 'e', `${fd}T10:00:00`)
    ok(portion({ ...arroz, kcal: 130 }, 150).kcal === 195 && fe.qty === 100 && fe.serving?.n === 2 && fe.name === arroz.name && fe.foodId === arroz.id && fe.base === 'g' && fe.kcal === 130 &&
      !('via' in fe) && quickEntry({ kcal: 300 }, 'q', `${fd}T10:00:00`).name === 'Añadido rápido' && quickEntry({ kcal: 300 }, 'q', `${fd}T10:00:00`).qty === 0, 'FD2 portion/makeEntry')
    const en = (id: string, kcal: number, day = fd, o: Partial<FoodEntry> = {}): FoodEntry => ({ id, occurredAt: `${day}T10:00:00`, name: 'x', kcal, qty: 100, p: 5, c: 10, f: 2, foodId: 'rice-white-cooked', base: 'g', ...o })
    const log3: FoodLogEntry[] = [en('a', 100), en('b', 200), { id: 'u', undoes: 'b', occurredAt: `${fd}T10:00:00` }, quickEntry({ kcal: 300 }, 'q', `${fd}T11:00:00`), en('o', 500, fdY)]
    const t3 = dayTotals(log3, fd)
    ok(t3.kcal === 400 && t3.p === 5 && t3.c === 10 && t3.f === 2 && t3.entries === 2 && dayTotals(log3, fdY).kcal === 500 && dayTotals([], fd).entries === 0, 'FD3 dayTotals')
    const g0: FoodGoal[] = [{ from: '2026-10-05', kcal: 2000, p: 20, c: 50, f: 30 }], g1 = setFoodGoal(g0, { kcal: 2200, p: 20, c: 50, f: 30 }, '2026-10-08'), g2 = setFoodGoal(g1, { kcal: 2400, p: 20, c: 50, f: 30 }, '2026-10-08')
    ok(goalOn(g0, '2026-09-01')?.kcal === 2000 && goalOn(g1, fd)?.kcal === 2000 && goalOn(g1, '2026-10-08')?.kcal === 2200 && goalOn(g1, '2026-12-01')?.kcal === 2200 && g2.length === 2 && g2[1].kcal === 2400 && g1.length === 2 && g0.length === 1 && goalOn([], fd) === null &&
      goalOn(undefined, fd) === null, 'FD4 goalOn/setFoodGoal')
    const gd = (k: number, goal = 2200): FoodData => ({ log: [en('z', k)], foods: [], goals: [{ from: fd, kcal: goal, p: 20, c: 50, f: 30 }] })
    ok(kcalRange(2200).min === 1980 && kcalRange(2200).max === 2420 && kcalRange(1990).min === 1791 && kcalRange(1990).max === 2189 && kcalRange(2000).min === 1800 && kcalRange(2000).max === 2200 &&
      inRange(gd(1800, 2000), fd) && inRange(gd(2200, 2000), fd) && !inRange(gd(1799, 2000), fd) && !inRange(gd(2201, 2000), fd) && inRange(gd(1980), fd) && !inRange(gd(1979), fd) && !inRange({ log: [en('z', 2000)], foods: [] }, fd), 'FD5 kcalRange/inRange')
    const mine = (id: string, name: string, o: Partial<Food> = {}): Food => ({ id, name, base: 'g', kcal: 100, p: 1, c: 1, f: 1, ...o })
    const sf = (q: string, custom: Food[] = []) => searchFoods(q, allFoods(custom)).map(f => f.name)
    const own = [mine('food-1', 'Arroz casero'), mine('food-2', 'Arroz viejo', { archived: true }), mine('food-3', 'Tarta de arroz')]
    const ord = searchFoods('arroz', [mine('food-a', 'Pan de arroz'), mine('food-b', 'Arroz'), mine('food-c', 'Arroz con leche'), mine('food-d', 'Tortitas de arroz tostadas'), mine('food-e', 'Sopa de arroz y pollo')])
    ok(sf('platano')[0] === 'Plátano' && sf('PLÁTANO ')[0] === 'Plátano' && sf('papa')[0].startsWith('Patata') && sf('judias verdes')[0] === 'Judías verdes' && sf('').length === 0 && sf('  ').length === 0 &&
      ord.map(f => f.id).join() === 'food-b,food-c,food-a,food-d,food-e' && !sf('arroz', own).includes('Arroz viejo') && sf('arroz', own).indexOf('Arroz casero') < sf('arroz', own).indexOf('Arroz blanco cocido') &&
      searchFoods('a', allFoods([]), 5).length === 5 && searchFoods('a', allFoods([])).length <= 20 && sf('zzzz').length === 0, 'FD12 searchFoods')
    const l13: FoodLogEntry[] = [en('1', 100, '2026-10-01', { foodId: 'egg', qty: 50 }), en('2', 100, '2026-10-03', { foodId: 'oats', qty: 40 }), en('3', 100, '2026-10-03', { foodId: 'apple', qty: 90, serving: { name: 'Unidad', n: 0.5 } }),
      en('4', 100, '2026-10-05', { foodId: 'egg', qty: 100, serving: { name: 'Unidad', n: 2 } }), en('5', 100, '2026-10-06', { foodId: 'milk-whole', qty: 250 }), { id: 'u5', undoes: '5', occurredAt: '2026-10-06T10:00:00' },
      en('6', 100, '2026-08-01', { foodId: 'banana', qty: 120 }), quickEntry({ kcal: 50 }, 'q', '2026-10-06T12:00:00')]
    const rc = recentFoods(l13), fr = frequentFoods(l13, fd)
    ok(rc.map(r => r.foodId).join() === 'egg,apple,oats,banana' && rc[0].last.qty === 100 && rc[0].last.serving?.n === 2 && recentFoods(l13, 2).length === 2 && !rc.some(r => r.foodId === 'milk-whole') &&
      fr.map(r => r.foodId).join() === 'egg,apple,oats' && !fr.some(r => r.foodId === 'banana') && lastPortion(l13, 'apple')?.serving?.n === 0.5 && lastPortion(l13, 'milk-whole') === null &&
      frequentFoods(l13, '2026-10-30').map(r => r.foodId).join() === 'egg,apple,oats' && frequentFoods(l13, '2026-11-20').length === 0, 'FD13 recientes/frecuentes')
    ok(parseQty('150,5') === 150.5 && parseQty('150.55') === 150.6 && parseQty('0') === null && parseQty('2001') === null && parseQty('2000') === 2000 && parseQty('x') === null && parseQty(' 12 ') === 12 &&
      parseServings('1,3') === 1.25 && parseServings('0.1') === null && parseServings('51') === null && parseKcal('1000') === 1000 && parseKcal('0') === null && parseKcal('10001') === null &&
      parseMacro('') === undefined && parseMacro('12,34') === 12.3 && parseMacro('x') === null && parsePct('30') === 30 && parsePct('101') === null && parsePct('3.5') === null &&
      fmtKcal(1640) === '1.640' && fmtKcal(999) === '999' && fmtKcal(12345.4) === '12.345', 'FD17 parsers y fmtKcal')

    // FD9, FD10 — persistencia de la comida
    {
      const fo = { id: 'food-1', name: 'Mi tarta', base: 'g', kcal: 300, p: 5, c: 40, f: 12, servings: [{ name: 'Trozo', qty: 80 }], source: 'off' }
      const dat = { log: [{ ...en('e1', 195), via: 'voice' }, { id: 'u1', undoes: 'e1', occurredAt: `${fd}T10:00:00` }], foods: [fo], futuro: { a: 1 }, goals: [{ from: fd, kcal: 2000, p: 20, c: 50, f: 30 }], meals: [{ id: 'meal-1', name: 'Desayuno', items: [{ foodId: 'egg', qty: 100 }] }] }
      const r9 = readFood(JSON.parse(JSON.stringify(dat)))
      const bad9 = readFood({ log: [en('ok', 1), { ...en('b1', 1), kcal: -1 }, { ...en('b2', 1), qty: 0 }, null], foods: [{ ...fo, servings: [{ name: 'a', qty: 5 }, { name: '', qty: 5 }] }, fo, { ...fo, id: 'sin' }],
        goals: [{ from: fd, kcal: 2000, p: 20, c: 50, f: 20 }], meals: [{ id: 'meal-1', name: 'a', items: [{ foodId: 'x', qty: 1 }] }, { id: 'meal-1', name: 'b', items: [{ foodId: 'x', qty: 1 }] }] })
      ok(r9 !== null && r9.dropped === 0 && r9.fixed === 0 && JSON.stringify(r9.data) === JSON.stringify(dat) && bad9?.data.log.length === 1 && bad9.data.foods.length === 1 && bad9.data.foods[0].servings?.length === 1 &&
        !bad9.data.goals && bad9.data.meals?.length === 1 && bad9.dropped === 7 && bad9.fixed === 1 && readFood('x') === null && readFood({ log: 3 }) === null, 'FD9 readFood')
      const bk = parseBackup(exportBackup([], { trackers: [], proposals: [] }, 'x', undefined, dat as FoodData)), raw = (f: unknown) => JSON.stringify({ app: 'rpg-life-tracker', version: 1, exportedAt: 'x', events: [], custom: { trackers: [], proposals: [] }, food: f })
      ok(JSON.stringify(bk?.food) === JSON.stringify(dat) && parseBackup(exportBackup([], { trackers: [], proposals: [] }, 'x'))?.food === null && parseBackup(raw('roto')) === null && parseBackup(raw({ log: [null] }))?.dropped === 1, 'FD10 copias con comida')
    }

    // FD6-FD8, FD16 — Dieta en vivo
    {
      let n = 0
      const u = () => `fd-${++n}`, D = fd, goal = (kcal: number, from = '2026-10-01'): FoodGoal[] => [{ from, kcal, p: 20, c: 50, f: 30 }]
      const fdata = (kcal: number, day = D, goals = goal(2000)): FoodData => ({ log: [en(`e-${day}`, kcal, day)], foods: [], goals })
      const dev = (e: Partial<ActivityEvent>): ActivityEvent => ({ id: 'm', trackerId: 'dieta', amount: 1, occurredAt: `${D}T09:00:00`, ...e })
      const add6 = dietSync([], fdata(1900), [D], D, u)
      ok(add6.length === 1 && add6[0].id === `dieta-auto-${D}` && add6[0].occurredAt === `${D}T12:00:00` && add6[0].amount === 1 && add6[0].trackerId === 'dieta' &&
        dietSync(add6, fdata(1900), [D], D, u).length === 0 && dietSync([dev({})], fdata(1900), [D], D, u).length === 0 &&
        dietSync([], fdata(1900, addDays(D, 1)), [addDays(D, 1)], D, u).length === 0 && dietSync([], fdata(3000), [D], D, u).length === 0 && dietSync([], { log: [], foods: [] }, [D], D, u).length === 0, 'FD6 dietSync: añadir')
      const auto = add6[0], out7 = dietSync(add6, fdata(3000), [D], D, u), after7 = [...add6, ...out7]
      const mix = dietSync([auto, dev({})], fdata(3000), [D], D, u)
      const minus = dev({ id: 'mm', amount: -1, undoes: auto.id, occurredAt: auto.occurredAt })
      const back = dietSync(after7, fdata(1900), [D], D, u), rep = dietSync([auto, minus], fdata(1900), [D], D, u)
      ok(out7.length === 1 && out7[0].amount === -1 && out7[0].undoes === auto.id && out7[0].occurredAt === auto.occurredAt && dayTotal(after7, 'dieta', D) === 0 && dietSync(after7, fdata(3000), [D], D, u).length === 0 &&
        mix.length === 1 && mix[0].undoes === auto.id && dayTotal([auto, dev({}), ...mix], 'dieta', D) === 1 &&
        back.length === 1 && back[0].id === `dieta-auto-${D}-2` && rep.length === 1 && rep[0].id === `dieta-auto-${D}-2` && dayTotal([auto, minus, ...rep], 'dieta', D) === 1, 'FD7 dietSync: retirar y reponer')
      const d1 = addDays(D, -2), d2 = addDays(D, -1), tlog = [d1, d2, D].map(d => en(`t-${d}`, 1900, d))
      const base8: FoodData = { log: tlog, foods: [], goals: goal(2000, addDays(D, -5)) }
      const ev8 = dietSync([], base8, dietDays(base8, []), D, u)
      const g8 = { ...base8, goals: setFoodGoal(base8.goals, { kcal: 1000, p: 20, c: 50, f: 30 }, D) }
      const ch8 = dietSync(ev8, g8, dietDays(g8, ev8), D, u)
      const first = { log: tlog, foods: [] } as FoodData, first2 = { ...first, goals: setFoodGoal(undefined, { kcal: 2000, p: 20, c: 50, f: 30 }, D) }
      const fe8 = dietSync([], first2, dietDays(first2, []), D, u)
      ok(ev8.length === 3 && ch8.length === 1 && ch8[0].undoes === `dieta-auto-${D}` && ch8[0].occurredAt.startsWith(D) && fe8.map(e => e.id.slice(-10)).join() === [d1, d2, D].join() && dietDays(g8, ev8).join() === [d1, d2, D].join(), 'FD8 cambio de objetivo')
      const act = (f: FoodData, evs: ActivityEvent[] = []) => dietActive(f, evs), off = withDiet(TRACKERS, false), on = withDiet(TRACKERS, true)
      ok(off.find(t => t.id === 'dieta')?.archived === true && !TRACKERS.find(t => t.id === 'dieta')?.archived && off.filter(t => t.id !== 'dieta').every(t => TRACKERS.includes(t)) && on === TRACKERS &&
        !act({ log: [], foods: [] }) && !act({ log: [en('x', 1)], foods: [] }) && act({ log: [], foods: [], goals: goal(2000) }) && act({ log: [], foods: [] }, [dev({})]) && !act({ log: [], foods: [] }, [dev({ trackerId: 'gym' })]), 'FD16 withDiet/dietActive')
    }
  }

  console.info('[selfcheck] done')
}
