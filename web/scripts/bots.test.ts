import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALANCE } from '../src/game/balance'
import { buildingById } from '../src/game/catalog'
import { botProjectLimit, createJob, createNewGame, maxProjects, tickHour } from '../src/game/engine'
import { startResearch } from '../src/game/actions'
import { COMPANY_STATUSES } from '../src/game/selectors'
import type { GameState } from '../src/game/types'

function quietBots(state: GameState, activeIndex: number): void {
  state.bots.forEach((bot, index) => {
    if (index === activeIndex) {
      bot.state = 'idle'
      bot.cooldown = 0
    } else {
      bot.state = 'cooldown'
      bot.cooldown = 9_999
      bot.projects = []
    }
  })
}

function demandTotal(state: GameState, supplier: 'north' | 'south'): number {
  return Object.values(state.demand[supplier]).reduce((sum, value) => sum + value, 0)
}

function tickDays(state: GameState, days: number): void {
  for (let i = 0; i < days * 24; i += 1) tickHour(state)
}

describe('боты: выбор базы закупки', () => {
  it('покупают на базе с меньшей общей ценой (стартовые цены — Юг)', () => {
    const state = createNewGame(99)
    quietBots(state, 0)
    state.bots[0].money = 20_000_000
    let southPeak = 0
    let northPeak = 0
    for (let i = 0; i < 6 * 24; i += 1) {
      tickHour(state)
      southPeak = Math.max(southPeak, demandTotal(state, 'south'))
      northPeak = Math.max(northPeak, demandTotal(state, 'north'))
    }
    assert.ok(southPeak > 0, 'спрос должен уходить на Юг')
    assert.equal(northPeak, 0, 'при стартовых ценах Север не должен выигрывать')
  })
})

describe('боты: размер бригады по сезонам', () => {
  it('в первом сезоне бригада не больше 2 человек', () => {
    const state = createNewGame(11)
    quietBots(state, 0)
    state.bots[0].money = 20_000_000
    let maxCrew = 0
    for (let i = 0; i < 5 * 24; i += 1) {
      tickHour(state)
      maxCrew = Math.max(maxCrew, state.bots[0].crew.length)
    }
    assert.ok(maxCrew >= 1, 'бригада должна наняться')
    assert.ok(maxCrew <= 2, `в сезоне 0 бригада не больше 2, а вышло ${maxCrew}`)
  })

  it('после первого сезона бригада достигает 3–6 человек', () => {
    const state = createNewGame(12)
    quietBots(state, 0)
    state.seasonIndex = 1
    state.bots[0].money = 50_000_000
    state.bots[0].crewTarget = 4
    let maxCrew = 0
    for (let i = 0; i < 4 * 24; i += 1) {
      tickHour(state)
      maxCrew = Math.max(maxCrew, state.bots[0].crew.length)
    }
    assert.ok(maxCrew >= 4, `бригада должна вырасти до цели 4, максимум ${maxCrew}`)
  })
})

describe('боты: параллельные объекты', () => {
  it('лимит объектов: 1 в сезоне 0, 2 после 2-го сезона или с «Планированием I»', () => {
    const state = createNewGame(7)
    assert.equal(botProjectLimit(state), 1)
    state.seasonIndex = 2
    assert.equal(botProjectLimit(state), 2)
    state.seasonIndex = 0
    state.research.planning_1 = { status: 'done', progress: 0 }
    assert.equal(botProjectLimit(state), 2)
  })

  it('после 2-го сезона бот реально ведёт два объекта', () => {
    const state = createNewGame(13)
    quietBots(state, 0)
    state.seasonIndex = 2
    state.bots[0].money = 50_000_000
    let peak = 0
    for (let i = 0; i < 7 * 24; i += 1) {
      tickHour(state)
      peak = Math.max(peak, state.bots[0].projects.length)
    }
    assert.ok(peak >= 2, `после 2-го сезона бот должен вести 2 объекта, пик ${peak}`)
  })
})

describe('кадры: доска кандидатов', () => {
  it('пополняется раз в 3 дня, а не ежедневно', () => {
    const state = createNewGame(21)
    state.bots.forEach((bot) => {
      bot.state = 'cooldown'
      bot.cooldown = 9_999
      bot.projects = []
    })
    state.candidates = []
    tickDays(state, 1)
    assert.equal(state.candidates.length, 0, 'до рестока кандидаты не должны появляться')
    while (state.day % BALANCE.restockDays !== 0) tickHour(state)
    assert.ok(state.candidates.length >= BALANCE.minCandidates, `на день рестока кандидатов ${state.candidates.length} < ${BALANCE.minCandidates}`)
  })
})

describe('лицензии', () => {
  it('без лицензии лицензионные объекты не появляются на доске', () => {
    const state = createNewGame(14)
    state.reputation = 90
    for (let i = 0; i < 100; i += 1) {
      const job = createJob(state)
      assert.ok(!buildingById(job.building).requiredLicense, `до лицензии появился ${job.building}`)
    }
  })

  it('после изучения городской лицензии её объекты выходят на доску', () => {
    const state = createNewGame(15)
    state.reputation = 90
    state.research.city_license = { status: 'done', progress: 0 }
    let seen = false
    for (let i = 0; i < 500; i += 1) {
      const job = createJob(state)
      const def = buildingById(job.building)
      if (def.id === 'park' || def.id === 'kindergarten' || def.id === 'hospital') {
        seen = true
        break
      }
    }
    assert.equal(seen, true, 'городские объекты не появились после лицензии')
  })

  it('городская лицензия требует репутацию 70 и капитал 10 млн', () => {
    const lowReputation = createNewGame(16)
    lowReputation.research.planning_1 = { status: 'done', progress: 0 }
    lowReputation.money = 11_000_000
    lowReputation.reputation = 60
    const blocked = startResearch(lowReputation, 'city_license')
    assert.equal(blocked.ok, false)
    assert.ok(blocked.message.includes('репутац'), blocked.message)

    lowReputation.reputation = 75
    const started = startResearch(lowReputation, 'city_license')
    assert.equal(started.ok, true, started.message)

    const lowCapital = createNewGame(17)
    lowCapital.research.planning_1 = { status: 'done', progress: 0 }
    lowCapital.money = 9_000_000
    lowCapital.reputation = 90
    const blockedCapital = startResearch(lowCapital, 'city_license')
    assert.equal(blockedCapital.ok, false)
    assert.ok(blockedCapital.message.includes('капитал'), blockedCapital.message)
  })
})

describe('технологии и статусы', () => {
  it('«Планирование II/III» убраны, лимит объектов не выше 2', () => {
    const state = createNewGame(18)
    assert.equal(maxProjects(state), 1)
    state.research.planning_1 = { status: 'done', progress: 0 }
    assert.equal(maxProjects(state), 2)
    assert.equal(state.research.planning_2, undefined)
  })

  it('пороги статусов компании повышены на 20%', () => {
    assert.deepEqual(
      COMPANY_STATUSES.map((item) => item.capital),
      [0, 3_000_000, 6_000_000, 12_000_000, 21_600_000, 36_000_000],
    )
  })
})