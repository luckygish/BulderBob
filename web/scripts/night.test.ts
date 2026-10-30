import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PROVISIONS } from '../src/game/catalog'
import { acquireEquipment, assignEquipment, createJob, createNewGame, crewHourly, nightEfficiency, tickHour } from '../src/game/engine'
import { assignCrew, buyMissingForProject, buyProvision, hireWorker, startFullProject, takeJob } from '../src/game/actions'
import { forecastProject } from '../src/game/selectors'
import type { BuildingId, GameState, Project } from '../src/game/types'

function quietBots(state: GameState): void {
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
}

function waitForDeliveries(state: GameState): void {
  let guard = 0
  while (state.deliveries.length > 0 && guard < 5) {
    if (state.paused) state.paused = false
    if (state.event) state.event = null
    tickHour(state)
    guard += 1
  }
  assert.equal(state.deliveries.length, 0, 'поставки не прибыли за время ожидания')
}

function setup(seed: number, owl = false, automation = false, building: BuildingId = 'reconstruction'): { state: GameState; project: Project } {
  const state = createNewGame(seed)
  state.money = 50_000_000
  quietBots(state)
  const job = createJob(state, building)
  state.jobs.push(job)
  const taken = takeJob(state, job.id)
  assert.equal(taken.ok, true, taken.message)
  const project = state.projects[0]
  while (state.crews[0].workers.length < 3 && state.candidates.length > 0) {
    const worker = state.candidates[0]
    hireWorker(state, worker.id, 0)
  }
  assert.equal(state.crews[0].workers.length, 3, 'бригада не укомплектована')
  state.crews[0].workers.forEach((worker) => {
    worker.skills = worker.skills.filter((skill) => skill !== 'owl')
  })
  if (owl) state.crews[0].workers[0].skills = ['owl']
  assignCrew(state, project.id, 0, 0)
  for (const provision of PROVISIONS) assert.equal(buyProvision(state, provision.id).ok, true)
  acquireEquipment(state, 'mixer', 'rented', 400)
  const asset = state.equipment.at(-1)!
  assert.equal(buyMissingForProject(state, project.id, 'north').ok, true)
  waitForDeliveries(state)
  assignEquipment(state, project, asset.assetId)
  const started = startFullProject(state, project.id)
  assert.equal(started.ok, true, started.message)
  if (automation) state.research.automation = { status: 'done', progress: 0 }
  return { state, project }
}

function hourDelta(state: GameState, project: Project, targetHour: number): { progress: number; wages: number } {
  state.hour = targetHour - 1
  const beforeProgress = project.stages[0].progress
  const beforeWages = project.laborCost
  tickHour(state)
  return { progress: project.stages[0].progress - beforeProgress, wages: project.laborCost - beforeWages }
}

describe('ночь: Сова и Автоматизация', () => {
  it('вечером без Совы и без Автоматизации стройка стоит', () => {
    const { state, project } = setup(500)
    assert.equal(project.stages[0].status, 'in_progress')
    const day = hourDelta(state, project, 10)
    const evening = hourDelta(state, project, 20)
    assert.ok(day.progress > 0, 'днём стройка идёт')
    assert.equal(evening.progress, 0, 'вечером без разрешения прогресса быть не должно')
    assert.equal(evening.wages, 0, 'вечером без разрешения зарплата не начисляется')
  })

  it('Сова открывает вечер до полуночи с КПД 90% и тарифом ×1.5', () => {
    const day = setup(500, true)
    const dayProgress = hourDelta(day.state, day.project, 10).progress
    assert.ok(dayProgress > 0)
    const { state, project } = setup(500, true)
    const evening = hourDelta(state, project, 20)
    assert.ok(evening.progress > 0, 'вечер с Совой должен строиться')
    assert.ok(Math.abs(evening.progress - 0.9 * dayProgress) < 1e-9, `вечерний КПД ${evening.progress}, ожидалось ${0.9 * dayProgress}`)
    const hourly = crewHourly(state.crews[0].workers)
    assert.equal(evening.wages, Math.round(hourly * 1.5), 'ночной тариф ×1.5')
  })

  it('Сова не работает ранним утром (0–7) и на границе полуночи', () => {
    const { state, project } = setup(600, true)
    const morning = hourDelta(state, project, 3)
    assert.equal(morning.progress, 0, 'в 3 часа ночи Сова не работает')
    const last = hourDelta(state, project, 23)
    assert.ok(last.progress > 0, 'в 23 часа вечернее окно ещё открыто')
    const midnight = hourDelta(state, project, 0)
    assert.equal(midnight.progress, 0, 'после полуночи вечернее окно закрыто')
  })

  it('Автоматизация: стройка 24/7 с КПД ночи 75% без Совы и 95% с Совой', () => {
    const plain = setup(700, false, true)
    const plainDay = hourDelta(plain.state, plain.project, 10).progress
    const plainNight = hourDelta(plain.state, plain.project, 3)
    assert.ok(plainNight.progress > 0, 'автоматизация позволяет ночную работу')
    assert.ok(Math.abs(plainNight.progress - 0.75 * plainDay) < 1e-9, `КПД без совы ${plainNight.progress}, ожидалось ${0.75 * plainDay}`)

    const owl = setup(700, true, true)
    const owlDay = hourDelta(owl.state, owl.project, 10).progress
    const owlNight = hourDelta(owl.state, owl.project, 3)
    assert.ok(Math.abs(owlNight.progress - 0.95 * owlDay) < 1e-9, `КПД с совой ${owlNight.progress}, ожидалось ${0.95 * owlDay}`)
  })

  it('Зима IV: ночная эффективность −10% и тариф +25%', () => {
    const { state, project } = setup(800, false, true)
    state.seasonIndex = 7
    const day = hourDelta(state, project, 10).progress
    const night = hourDelta(state, project, 3)
    assert.ok(Math.abs(night.progress - 0.75 * 0.9 * day) < 1e-9, `зимний КПД ${night.progress}, ожидалось ${0.75 * 0.9 * day}`)
    const hourly = crewHourly(state.crews[0].workers)
    assert.equal(night.wages, Math.round(hourly * 1.5 * 1.25), 'тариф в Зиму IV: 1.5 × 1.25')
  })

  it('Сова дорожает ставку на 10%', () => {
    const owl = { id: 'w1', name: 'С', type: 'handyman' as const, rate: 1_000, skills: ['owl' as const] }
    const plain = { id: 'w2', name: 'П', type: 'handyman' as const, rate: 1_000, skills: [] }
    assert.equal(crewHourly([owl]), 1_100, 'ставка совы +10%')
    assert.equal(crewHourly([plain]), 1_000)
  })

  it('nightEfficiency: базовые режимы', () => {
    const state = createNewGame(1)
    assert.equal(nightEfficiency(state, true), 0.9, 'сова без автоматизации')
    state.research.automation = { status: 'done', progress: 0 }
    assert.equal(nightEfficiency(state, false), 0.75, 'автоматизация без совы')
    assert.equal(nightEfficiency(state, true), 0.95, 'автоматизация + сова')
    state.seasonIndex = 7
    assert.ok(Math.abs(nightEfficiency(state, false) - 0.75 * 0.9) < 1e-9, 'зима IV: ×0.9 к ночному КПД')
  })

  it('прогноз учитывает ночные часы и автоматизацию', () => {
    const { state, project } = setup(900, true, false, 'frame_house')
    const withOwl = forecastProject(state, project).days
    state.crews[0].workers.forEach((worker) => {
      worker.skills = worker.skills.filter((skill) => skill !== 'owl')
    })
    const withoutOwl = forecastProject(state, project).days
    state.research.automation = { status: 'done', progress: 0 }
    const withAutomation = forecastProject(state, project).days
    assert.ok(withOwl < withoutOwl, `ночной прогноз ${withOwl} дн. должен быть меньше дневного ${withoutOwl}`)
    assert.ok(withAutomation < withOwl, `прогноз с автоматизацией ${withAutomation} дн. должен быть меньше ${withOwl}`)
  })
})