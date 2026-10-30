import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyTutorialProgress, TUTORIAL_STEPS } from '../src/game/progression'
import { createNewGame } from '../src/game/engine'
import { hireWorker, takeJob } from '../src/game/actions'
import type { GameState } from '../src/game/types'

function freshState(): GameState {
  const state = createNewGame(7)
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
}

describe('прогресс: награды за обучение', () => {
  it('репутацию дают только шаги 1 и 5 — по +2, последний — +3', () => {
    assert.equal(TUTORIAL_STEPS.length, 18)
    for (const [index, step] of TUTORIAL_STEPS.entries()) {
      const expected = index === TUTORIAL_STEPS.length - 1 ? 3 : index === 0 || index === 4 ? 2 : 0
      assert.equal(step.reward, expected, `шаг ${index + 1} («${step.title}»): награда`)
    }
  })

  it('шаг с наградой даёт +2 репутации, шаг без награды репутацию не меняет', () => {
    const state = freshState()
    const start = state.reputation
    const taken = takeJob(state, state.jobs[0].id)
    assert.equal(taken.ok, true)
    assert.equal(hireWorker(state, state.candidates[0].id, 0).ok, true)
    assert.equal(hireWorker(state, state.candidates[0].id, 0).ok, true)
    const firstStep = applyTutorialProgress(state)
    assert.equal(firstStep?.id, 'first_job')
    assert.equal(state.reputation, start + 2)
    assert.ok(state.journal.some((entry) => entry.text.includes('Reward +2 reputation')))
    const secondStep = applyTutorialProgress(state)
    assert.equal(secondStep?.id, 'hire_two')
    assert.equal(state.reputation, start + 2)
    const latest = state.journal.at(-1)!.text
    assert.ok(!latest.includes('Reward'), `журнал не должен обещать награду: «${latest}»`)
  })
})