import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS, INCIDENTS } from '../src/game/events'
import { EVENT_ART } from '../src/ui/eventArtMap'
import { acquireEquipment, assignEquipment, createJob, createNewGame, resolveEvent, tickHour } from '../src/game/engine'
import { buyMissingForProject, buyProvision, hireWorker, startFullProject, takeJob, assignCrew } from '../src/game/actions'
import { buildingById, PROVISIONS } from '../src/game/catalog'
import type { GameState, Project } from '../src/game/types'

const EFFECT_KEYS = ['cash', 'reputation', 'delayDays', 'seasonPriceBonus', 'seasonDeadlineBonus', 'seasonWageBonus', 'cashRate']
const IMAGES = ['wife', 'traider', 'worker', 'inspect', 'clients', 'happyman', 'happywife', 'investor', 'other', 'bulder']

function freshState(): GameState {
  const state = createNewGame(7)
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
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

function setupWorkingProject(state: GameState): Project {
  state.reputation = 90
  for (const provision of PROVISIONS) assert.equal(buyProvision(state, provision.id).ok, true)
  const job = createJob(state, 'reconstruction')
  state.jobs.push(job)
  assert.equal(takeJob(state, job.id).ok, true)
  const project = state.projects[0]
  while (state.crews[0].workers.length < 3 && state.candidates.length > 0) {
    const worker = state.candidates[0]
    assert.equal(hireWorker(state, worker.id, 0).ok, true)
  }
  assert.equal(assignCrew(state, project.id, 0, 0).ok, true)
  assert.equal(buyMissingForProject(state, project.id, 'north').ok, true)
  waitForDeliveries(state)
  acquireEquipment(state, 'mixer', 'rented', 400)
  const mixer = state.equipment.at(-1)!
  assignEquipment(state, project, mixer.assetId)
  assert.equal(startFullProject(state, project.id).ok, true)
  return project
}

describe('ивенты: инварианты набора', () => {
  it('всего 65 событий, id уникальны', () => {
    assert.equal(EVENTS.length, 65)
    assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length)
  })

  it('пары (season, day) уникальны, день в [1, 40], сезон в [0, 9]', () => {
    const slots = new Set<string>()
    for (const event of EVENTS) {
      assert.ok(event.day >= 1 && event.day <= 40, `${event.id}: день ${event.day}`)
      assert.ok(event.season >= 0 && event.season <= 9, `${event.id}: сезон ${event.season}`)
      if (event.when) continue
      const key = `${event.season}:${event.day}`
      assert.ok(!slots.has(key), `дубликат слота ${key} у ${event.id}`)
      slots.add(key)
    }
  })

  it('у каждого ивента ≥1 опции с label/outcome и только известными эффектами', () => {
    for (const event of EVENTS) {
      assert.ok(event.options.length >= 1, `${event.id}: нет опций`)
      assert.ok(event.eyebrow && event.title && event.text, `${event.id}: пустые заголовки/текст`)
      for (const option of event.options) {
        assert.ok(option.label, `${event.id}: нет label у опции`)
        assert.ok(option.outcome, `${event.id}: нет outcome у опции`)
        for (const key of Object.keys(option.effect)) {
          assert.ok(EFFECT_KEYS.includes(key), `${event.id}: неизвестный эффект «${key}»`)
        }
      }
    }
  })

  it('каждый id имеет портрет, ключи мапы указывают на существующие картинки', () => {
    for (const event of [...EVENTS, ...INCIDENTS]) {
      const art = EVENT_ART[event.id]
      assert.ok(art, `нет портрета для ${event.id}`)
      assert.ok(IMAGES.includes(art), `${event.id}: неизвестная картинка «${art}»`)
    }
    assert.equal(Object.keys(EVENT_ART).length, EVENTS.length + INCIDENTS.length)
    for (const [id, art] of Object.entries(EVENT_ART)) {
      assert.ok([...EVENTS, ...INCIDENTS].some((event) => event.id === id), `портрет для несуществующего ивента ${id}`)
      assert.ok(IMAGES.includes(art), `неизвестная картинка «${art}» для ${id}`)
    }
  })
})

describe('ивенты: смоук resolveEvent', () => {
  it('client_change: +50 000 ₽, пауза снимается, слот очищается', () => {
    const state = freshState()
    const before = state.money
    const repBefore = state.reputation
    state.paused = true
    const result = resolveEvent(state, 'client_change', 0)
    assert.equal(result.ok, true)
    assert.equal(state.money, before + 50_000)
    assert.equal(state.reputation, repBefore)
    assert.equal(state.event, null)
    assert.equal(state.paused, false)
  })

  it('holiday_deadline: −50 000 ₽ и +5 репутации', () => {
    const state = freshState()
    const moneyBefore = state.money
    const repBefore = state.reputation
    state.paused = true
    const result = resolveEvent(state, 'holiday_deadline', 0)
    assert.equal(result.ok, true)
    assert.equal(state.money, moneyBefore - 50_000)
    assert.equal(state.reputation, repBefore + 5)
    assert.equal(state.event, null)
    assert.equal(state.paused, false)
  })

  it('недостаточно средств — вариант отклоняется, пауза остаётся', () => {
    const state = freshState()
    state.money = 10_000
    state.paused = true
    const result = resolveEvent(state, 'holiday_deadline', 0)
    assert.equal(result.ok, false)
    assert.equal(state.paused, true)
    assert.equal(state.event, null)
  })
})

describe('ивенты: новые механики сезона', () => {
  it('investor_offer: +2 000 000 ₽, сезонный бонус 15% к срокам продлевает заказы', () => {
    const state = freshState()
    state.money = 1_000_000
    const job = createJob(state, 'reconstruction')
    state.jobs.push(job)
    assert.equal(takeJob(state, job.id).ok, true)
    const project = state.projects[0]
    const boardJob = state.jobs[0]
    const day = state.day
    const projectDeadlineBefore = project!.job.deadline
    const jobDeadlineBefore = boardJob.deadline
    const result = resolveEvent(state, 'investor_offer', 0)
    assert.equal(result.ok, true)
    assert.equal(state.money, 1_000_000 + 2_000_000)
    assert.equal(state.seasonDeadlineBonus, 0.15)
    const projectExpectation = projectDeadlineBefore + Math.max(1, Math.round(Math.max(0, projectDeadlineBefore - day) * 0.15))
    assert.equal(project!.job.deadline, projectExpectation)
    const jobExpectation = jobDeadlineBefore + Math.max(1, Math.round(Math.max(0, jobDeadlineBefore - day) * 0.15))
    assert.equal(boardJob.deadline, jobExpectation)
  })

  it('createJob: сезонный бонус сроков умножает длительность', () => {
    const state = freshState()
    state.seasonDeadlineBonus = 0.15
    const job = createJob(state, 'reconstruction')
    const manHours = buildingById('reconstruction').stages.reduce((sum, stage) => sum + stage.manHours, 0)
    const rawBase = 4 + Math.ceil(manHours / 35)
    const duration = job.deadline - state.day
    assert.ok(duration >= Math.round(rawBase * 1.15) - 1, `длительность ${duration} меньше ожидаемой`)
    assert.ok(duration <= Math.round((rawBase + 2) * 1.15) + 1, `длительность ${duration} больше ожидаемой`)
  })

  it('corp_recruit: зарплата всех бригад +30% учитывается в начислении часов', () => {
    const state = freshState()
    state.money = 50_000_000
    const project = setupWorkingProject(state)
    const baseWage = project.laborCost
    state.paused = false
    tickHour(state)
    const normalGain = project.laborCost - baseWage

    const stateB = freshState()
    stateB.money = 50_000_000
    const projectB = setupWorkingProject(stateB)
    const baseWageB = projectB.laborCost
    assert.equal(resolveEvent(stateB, 'corp_recruit', 0).ok, true)
    assert.equal(stateB.seasonWageBonus, 0.3)
    stateB.paused = false
    tickHour(stateB)
    const bonusGain = projectB.laborCost - baseWageB
    assert.ok(bonusGain > normalGain, `зарплата с бонусом ${bonusGain} должна быть выше обычной ${normalGain}`)
  })

  it('corp_final: продажа → окно "преданная мечта" на 9:39', () => {
    const state = freshState()
    state.seasonIndex = 9
    state.day = 38
    state.hour = 23
    state.paused = false
    const result = resolveEvent(state, 'corp_final', 0)
    assert.equal(result.ok, true)
    assert.equal(state.corpFinalChoice, 'sold')
    tickHour(state)
    assert.equal(state.day, 39)
    assert.equal(state.event, 'corp_final_sold')
  })

  it('corp_final: отказ → окно "настоящая акула" на 9:39', () => {
    const state = freshState()
    state.seasonIndex = 9
    state.day = 38
    state.hour = 23
    state.paused = false
    const result = resolveEvent(state, 'corp_final', 1)
    assert.equal(result.ok, true)
    assert.equal(state.corpFinalChoice, 'fight')
    tickHour(state)
    assert.equal(state.day, 39)
    assert.equal(state.event, 'corp_final_fight')
  })
})

describe('ЧП: инварианты набора', () => {
  it('INCIDENTS непустой, 13 шт, id уникальны и не пересекаются с EVENTS', () => {
    assert.equal(INCIDENTS.length, 13)
    assert.equal(new Set(INCIDENTS.map((incident) => incident.id)).size, INCIDENTS.length)
    for (const incident of INCIDENTS) {
      assert.ok(!EVENTS.some((event) => event.id === incident.id), `id совпадает с плановым событием: ${incident.id}`)
    }
  })

  it('у каждого ЧП ровно 1 опция, эффект ⊆ {cashRate, delayDays}, данные непустые', () => {
    for (const incident of INCIDENTS) {
      assert.equal(incident.options.length, 1, `${incident.id}: ожидается 1 опция`)
      assert.ok(incident.eyebrow && incident.title && incident.text, `${incident.id}: пустые заголовки/текст`)
      const option = incident.options[0]
      assert.ok(option.label && option.outcome, `${incident.id}: нет label/outcome`)
      for (const key of Object.keys(option.effect)) {
        assert.ok(['cashRate', 'delayDays'].includes(key), `${incident.id}: недопустимый эффект «${key}»`)
      }
    }
  })

  it('каждый id ЧП присутствует в EVENT_ART', () => {
    for (const incident of INCIDENTS) {
      const art = EVENT_ART[incident.id]
      assert.ok(art, `нет портрета для ${incident.id}`)
      assert.ok(IMAGES.includes(art), `${incident.id}: неизвестная картинка «${art}»`)
    }
  })
})

describe('ЧП: resolveEvent', () => {
  it('site_theft: списывает round(money × 0.04) и снимает паузу', () => {
    const state = freshState()
    state.money = 1_000_000
    state.paused = true
    state.event = 'site_theft'
    const result = resolveEvent(state, 'site_theft', 0)
    assert.equal(result.ok, true)
    assert.equal(state.money, 1_000_000 - Math.round(1_000_000 * 0.04))
    assert.equal(state.paused, false)
    assert.equal(state.event, null)
  })

  it('opening_mistake: +2 дня ко всем срокам', () => {
    const state = freshState()
    const project = setupWorkingProject(state)
    const before = project.job.deadline
    const result = resolveEvent(state, 'opening_mistake', 0)
    assert.equal(result.ok, true)
    assert.equal(project.job.deadline, before + 2)
    assert.equal(state.paused, false)
  })

  it('utility_damage: cashRate и delayDays применяются вместе', () => {
    const state = freshState()
    const project = setupWorkingProject(state)
    state.money = 5_000_000
    const before = project.job.deadline
    const result = resolveEvent(state, 'utility_damage', 0)
    assert.equal(result.ok, true)
    assert.equal(state.money, 5_000_000 - Math.round(5_000_000 * 0.03))
    assert.equal(project.job.deadline, before + 1)
  })

  it('ЧП с cashRate классифицируются в журнале как money', () => {
    const state = freshState()
    state.money = 1_000_000
    const before = state.journal.length
    resolveEvent(state, 'site_theft', 0)
    const entry = state.journal.slice(before).find((item) => item.kind === 'money')
    assert.ok(entry, 'нет записи kind=money в журнале')
  })
})

describe('ЧП: детерминированный триггер', () => {
  it('со 2-го сезона при активном проекте ЧП ставит паузу в течение 40 тиков', () => {
    const state = createNewGame(3)
    for (const bot of state.bots) {
      bot.state = 'cooldown'
      bot.cooldown = 9_999
      bot.projects = []
    }
    state.seasonIndex = 0
    const project = setupWorkingProject(state)
    assert.ok(project)
    state.seasonIndex = 1
    state.day = 1
    state.hour = 23
    state.incidentCooldown = 0
    state.paused = false
    let fired = false
    let guard = 0
    while (guard < 40 && !fired) {
      tickHour(state)
      guard += 1
      fired = state.event !== null && INCIDENTS.some((incident) => incident.id === state.event)
    }
    assert.equal(fired, true, 'ЧП не сработало за 40 тиков')
    assert.ok(INCIDENTS.some((incident) => incident.id === state.event), `state.event = ${state.event}`)
    assert.equal(state.paused, true, 'ЧП должно ставить игру на паузу')
  })
})