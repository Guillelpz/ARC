import type { ActivityEvent, GameState, Proposal, Tracker } from './types'
import { DEMO_DATE, SEED_EVENTS, seedFor } from './seed'
import { allTrackers, TRACKERS } from './trackers'
import { addDays, byRecent, clampAmount, dayTotal, history, localDate, mondayOf } from './stats'
import { deriveGame, diffLevelDowns, diffLevelUps } from './rpg'
import { buildRanking, countsIn, derivePartyState, overtakes, PARTIES, partyCriteria, proposeTo, vote } from './party'
import { buttonLabel, classify, createTracker, editTracker, findSimilar, isDuplicateName, isValidName, trackerName } from './classify'
import { parseCustom } from './storage'

// Oráculo: §5 y §10 de TECH_SPEC. Si falla, se arregla el motor, nunca los asserts.
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
  ok(buildRanking(g0).map(r => r.id).join() === 'carlos,alex,you,dani', 'ranking inicial')

  const e1 = tap(SEED_EVENTS, 'gym')
  const g1 = deriveGame(e1, DEMO_DATE)
  const gym = get(g1, 'gym')
  ok(e1.length === 29 && gym.week === 4 && gym.allTime === 6 && gym.xp.xp === 180 && gym.diff === 2, '+Gym: 4/4, 6, 180, +2')
  ok(gym.xp.level === 4 && g1.hero.level === 4 && g1.player.level === 4, '+Gym: Lv 4 gym/hero/player')
  ok(g1.hero.xp === 600 && g1.villain.xp === 150, '+Gym: hero 600, villain 150')
  const up = diffLevelUps(g0, g1)
  ok(up?.title === 'LEVEL UP — PLAYER 4' && up.detail === 'Gym Lv. 4 · Hero Lv. 4', '+Gym: toast')
  ok(buildRanking(g1).map(r => r.id).join() === 'carlos,you,alex,dani' && g1.weeklyHeroXp === 360, 'ranking tras +Gym')
  ok(overtakes(buildRanking(g1), buildRanking(g0)).join() === 'Alex' && !overtakes(buildRanking(g0), buildRanking(g1)).length, 'adelantamientos en ambos sentidos')
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


  // ---- V2 (PRD-V2 §8) ----
  const [gymP, ofi] = PARTIES
  const NOW = `${DEMO_DATE}T12:00:00`
  const ids = (ts: { id: string }[]) => ts.map(t => t.id).join()
  const sum = (g: GameState) => [g.hero.xp, g.hero.level, g.villain.xp, g.villain.level, g.player.xp, g.player.level, g.weeklyHeroXp].join()
  const ps = (events: ActivityEvent[], trackers: Tracker[] = TRACKERS, proposals: Proposal[] = []) =>
    PARTIES.map(p => derivePartyState(p, events, DEMO_DATE, trackers, proposals))

  ok(ids(partyCriteria(gymP, TRACKERS, [])) === 'gym,bjj,running,reading,beer,burgers', 'criterios Los del Gym')
  ok(ids(partyCriteria(ofi, TRACKERS, [])) === 'running,reading,burgers', 'criterios La Oficina')
  const [sg0, so0] = ps(SEED_EVENTS)
  ok(sum(sg0.game) === sum(g0), 'Los del Gym = global al abrir')
  ok(sum(so0.game) === '300,2,60,1,360,2,180', 'La Oficina: HERO 300 L2, VILLAIN 60 L1, PLAYER 360 L2, sem 180')
  ok(ids(so0.ranking) === 'lucia,you,marta,pablo' && so0.position === 2, 'ranking La Oficina')
  ok(ids(sg0.ranking) === 'carlos,alex,you,dani' && sg0.position === 3, 'ranking Los del Gym inicial')
  ok(ids(buildRanking(sg0.game, gymP.members, 'villain')) === 'dani,alex,you,carlos', 'ranking VILLAIN Los del Gym')
  ok(ids(buildRanking(so0.game, ofi.members, 'depth')) === 'lucia,pablo,marta,you', 'ranking profundidad La Oficina')
  const [sg1, so1] = ps(e1)
  ok(ids(sg1.ranking) === 'carlos,you,alex,dani' && sg1.game.weeklyHeroXp === 360, 'Los del Gym tras +Gym')
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

  ok(ids(byRecent(TRACKERS, SEED_EVENTS)) === 'gym,bjj,running,reading,beer,burgers', 'orden por uso: seed')
  ok(ids(byRecent([...TRACKERS, med], [...tap(SEED_EVENTS, 'burgers'), { id: 'check-fix', trackerId: 'gym', amount: -1, occurredAt: `${DEMO_DATE}T13:00:00` }])) === 'custom-meditar,burgers,gym,bjj,running,reading,beer', 'orden por uso: sin uso primero, corrección no cuenta')

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

  console.info('[selfcheck] done')
}
