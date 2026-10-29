import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALANCE } from '../src/game/balance'
import { MATERIALS, SUPPLIERS, materialById } from '../src/game/catalog'
import { createNewGame, frontPrice, purchaseMaterial, quoteMaterial, stockQty, tickHour } from '../src/game/engine'
import { seasonMaterialPriceRate } from '../src/game/seasons'
import type { GameState } from '../src/game/types'

function freshState(money = 100_000_000): GameState {
  const state = createNewGame(42)
  state.money = money
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
}

function advanceToRestock(state: GameState): void {
  let guard = 0
  while (state.day % BALANCE.restockDays !== 0 && guard < 60) {
    tickHour(state)
    guard += 1
  }
  assert.ok(state.day % BALANCE.restockDays === 0, 'не дошли до дня рестока')
}

describe('рынок: стартовый сток и цены баз', () => {
  it('Север: цена = базовая, объём = stockMax (снижен на 15%)', () => {
    const state = freshState()
    for (const material of MATERIALS) {
      const price = frontPrice(state, material.id, 'north')
      assert.equal(price, material.basePrice, `${material.id}: стартовая цена Севера`)
      assert.equal(stockQty(state, material.id, 'north'), material.stockMax, `${material.id}: стартовый объём Севера`)
    }
  })

  it('Юг: скидка 5%, объём 75% stockMax, доставка завтра, комиссия 3.5%', () => {
    const state = freshState()
    assert.equal(SUPPLIERS.south.initialPrice, 0.95)
    assert.equal(SUPPLIERS.south.feeRate, 0.035)
    assert.equal(SUPPLIERS.south.deliveryDays, 1)
    const northStock = stockQty(state, 'concrete', 'north')
    const southStock = stockQty(state, 'concrete', 'south')
    assert.equal(southStock, Math.round(northStock * 0.75))
    assert.equal(frontPrice(state, 'concrete', 'south'), Math.round(materialById('concrete').basePrice * 0.95))
    const quote = quoteMaterial(state, 'concrete', 100, 'south')
    assert.equal(quote.arriveDay, state.day + 1)
    const expectedCost = Math.round(100 * Math.round(materialById('concrete').basePrice * 0.95) * (1 + seasonMaterialPriceRate(state)))
    assert.equal(quote.cost, expectedCost)
    assert.equal(quote.fee, Math.round(expectedCost * 0.035))
  })
})

describe('рынок: FIFO-покупка', () => {
  it('котировка набирает лоты по порядку и суммирует их цены', () => {
    const state = freshState()
    state.suppliers.north.concrete = [
      { qty: 1_000, initialQty: 1_000, price: 4_000, arrivedDay: 1 },
      { qty: 500, initialQty: 500, price: 5_000, arrivedDay: 2 },
    ]
    const quote = quoteMaterial(state, 'concrete', 1_200, 'north')
    assert.equal(quote.qty, 1_200)
    assert.equal(quote.available, 1_500)
    const raw = 1_000 * 4_000 + 200 * 5_000
    assert.equal(quote.cost, Math.round(raw * (1 + seasonMaterialPriceRate(state))))
    const result = purchaseMaterial(state, 'concrete', 1_200, 'north')
    assert.equal(result.ok, true)
    const share = 1_200 / 1_500
    const bump = Math.max(0, share - 0.25)
    const cap = Math.round(materialById('concrete').basePrice * BALANCE.priceCap)
    const bumped = Math.min(cap, Math.round(5_000 * (1 + BALANCE.priceSensitivity * bump)))
    assert.deepEqual(state.suppliers.north.concrete.map((lot) => ({ price: lot.price, qty: lot.qty })), [{ price: bumped, qty: 300 }])
    assert.equal(state.demand.north.concrete, 1_200)
  })

  it('невозможно купить больше остатка базы', () => {
    const state = freshState()
    const result = purchaseMaterial(state, 'concrete', materialById('concrete').stockMax + 1, 'north')
    assert.equal(result.ok, false)
    assert.equal(stockQty(state, 'concrete', 'north'), materialById('concrete').stockMax)
  })
})

describe('рынок: мгновенная реакция цены на массовую закупку', () => {
  it('покупка ≥25% остатка поднимает цену оставшихся лотов', () => {
    const state = freshState()
    const before = frontPrice(state, 'concrete', 'north')
    const stock = stockQty(state, 'concrete', 'north')
    const qty = Math.round(stock * 0.3)
    const result = purchaseMaterial(state, 'concrete', qty, 'north')
    assert.equal(result.ok, true)
    const after = frontPrice(state, 'concrete', 'north')
    const cap = Math.round(materialById('concrete').basePrice * BALANCE.priceCap)
    assert.ok(after > before, `цена должна вырасти (было ${before}, стало ${after})`)
    assert.ok(after <= cap, `цена не должна превышать потолок ${cap}`)
  })

  it('мелкая покупка (≤25%) цену остатка не меняет', () => {
    const state = freshState()
    const before = frontPrice(state, 'concrete', 'north')
    const qty = Math.max(1, Math.round(stockQty(state, 'concrete', 'north') * 0.05))
    const result = purchaseMaterial(state, 'concrete', qty, 'north')
    assert.equal(result.ok, true)
    assert.equal(frontPrice(state, 'concrete', 'north'), before)
  })
})

describe('рынок: пересчёт поставок раз в 3 дня', () => {
  it('нейтральный спрос: новый лот по базовой цене', () => {
    const state = freshState()
    state.demand.north.concrete = materialById('concrete').dailyDemand * BALANCE.restockDays
    advanceToRestock(state)
    const last = state.suppliers.north.concrete.at(-1)!
    assert.equal(last.price, materialById('concrete').basePrice)
  })

  it('спрос ×2: цена упирается в потолок ×1.35 при чувствительности 0.5', () => {
    const state = freshState()
    state.demand.north.concrete = 2 * materialById('concrete').dailyDemand * BALANCE.restockDays
    advanceToRestock(state)
    const last = state.suppliers.north.concrete.at(-1)!
    assert.equal(last.price, Math.round(materialById('concrete').basePrice * BALANCE.priceCap))
  })

  it('низкий спрос: цена не падает ниже пола ×0.8', () => {
    const state = freshState()
    state.demand.north.concrete = 0
    advanceToRestock(state)
    const last = state.suppliers.north.concrete.at(-1)!
    assert.equal(last.price, Math.round(materialById('concrete').basePrice * BALANCE.priceFloor))
  })

  it('объём рестока ограничен новым stockMax', () => {
    const state = freshState()
    purchaseMaterial(state, 'concrete', materialById('concrete').stockMax, 'north')
    assert.equal(stockQty(state, 'concrete', 'north'), 0)
    state.demand.north.concrete = 100_000
    advanceToRestock(state)
    assert.equal(stockQty(state, 'concrete', 'north'), materialById('concrete').stockMax)
  })

  it('старый лот с остатком ≥60% уценивается на 5% после 9 дней', () => {
    const state = freshState()
    const base = materialById('lumber').basePrice
    state.suppliers.north.lumber = [{ qty: 1_000, initialQty: 1_000, price: base, arrivedDay: state.day - 10 }]
    state.demand.north.lumber = 0
    advanceToRestock(state)
    const floor = Math.round(base * BALANCE.priceFloor)
    assert.ok(frontPrice(state, 'lumber', 'north') <= Math.round(base * (1 - BALANCE.agingDiscount)))
    assert.ok(frontPrice(state, 'lumber', 'north') >= floor)
  })
})