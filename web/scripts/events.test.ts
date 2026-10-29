import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EVENTS } from '../src/game/events'
import { EVENT_ART } from '../src/ui/eventArtMap'
import { createNewGame, resolveEvent } from '../src/game/engine'
import type { GameState } from '../src/game/types'

const EFFECT_KEYS = ['cash', 'reputation', 'delayDays', 'seasonPriceBonus']
const IMAGES = ['wife', 'traider', 'worker', 'inspect', 'clients', 'happyman']

function freshState(): GameState {
  const state = createNewGame(7)
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
}

describe('ивенты: инварианты набора', () => {
  it('всего 32 события, id уникальны', () => {
    assert.equal(EVENTS.length, 32)
    assert.equal(new Set(EVENTS.map((event) => event.id)).size, EVENTS.length)
  })

  it('пары (season, day) уникальны, день в [1, 90], сезон в [0, 9]', () => {
    const slots = new Set<string>()
    for (const event of EVENTS) {
      assert.ok(event.day >= 1 && event.day <= 90, `${event.id}: день ${event.day}`)
      assert.ok(event.season >= 0 && event.season <= 9, `${event.id}: сезон ${event.season}`)
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
    for (const event of EVENTS) {
      const art = EVENT_ART[event.id]
      assert.ok(art, `нет портрета для ${event.id}`)
      assert.ok(IMAGES.includes(art), `${event.id}: неизвестная картинка «${art}»`)
    }
    assert.equal(Object.keys(EVENT_ART).length, EVENTS.length)
    for (const [id, art] of Object.entries(EVENT_ART)) {
      assert.ok(EVENTS.some((event) => event.id === id), `портрет для несуществующего ивента ${id}`)
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