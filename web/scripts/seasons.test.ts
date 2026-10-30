import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALANCE } from '../src/game/balance'
import { createNewGame, tickHour } from '../src/game/engine'
import { SEASONS } from '../src/game/seasons'
import type { GameState } from '../src/game/types'

function freshState(): GameState {
  const state = createNewGame(3)
  state.money = 100_000_000
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
}

describe('сезоны: цели капитала', () => {
  it('цели подняты на +25% и округлены вверх до 500 000', () => {
    const expected = [4_000_000, 5_500_000, 8_000_000, 10_500_000, 12_500_000, 16_000_000, 19_000_000, 23_500_000, 28_500_000, 34_500_000]
    SEASONS.forEach((season, index) => {
      assert.equal(season.goal.capital, expected[index], season.name)
    })
  })

  it('каждая цель больше старой на ~25% и кратна 500 000', () => {
    const old = [3_125_000, 4_375_000, 6_250_000, 8_125_000, 10_000_000, 12_500_000, 15_000_000, 18_750_000, 22_500_000, 27_500_000]
    SEASONS.forEach((season, index) => {
      const target = Math.ceil(old[index] * 1.25 / 500_000) * 500_000
      assert.equal(season.goal.capital, target, season.name)
      assert.equal(season.goal.capital % 500_000, 0, season.name)
    })
  })
})

describe('сезоны: репутация между сезонами', () => {
  it('успешный сезон даёт +5, день и сезон сбрасываются, репутация не обнуляется', () => {
    const state = freshState()
    state.reputation = 60
    state.seasonCompleted = 1
    state.day = BALANCE.seasonDays
    state.hour = 23
    state.paused = false
    const seasonIndexBefore = state.seasonIndex
    tickHour(state)
    assert.equal(state.day, 1)
    assert.equal(state.seasonIndex, seasonIndexBefore + 1)
    assert.equal(state.reputation, 65)
    assert.ok(state.journal.some((entry) => entry.text.includes('+5 reputation')))
    assert.equal(state.seasonNotice?.success, true)
  })

  it('проваленный сезон даёт −15 с минимумом 0', () => {
    const state = freshState()
    state.reputation = 10
    state.money = 0
    state.day = BALANCE.seasonDays
    state.hour = 23
    state.paused = false
    tickHour(state)
    assert.equal(state.day, 1)
    assert.equal(state.seasonIndex, 1)
    assert.equal(state.reputation, 0)
    assert.equal(state.seasonNotice?.success, false)
    assert.ok(state.journal.some((entry) => entry.text.includes('−15 reputation')))
  })
})