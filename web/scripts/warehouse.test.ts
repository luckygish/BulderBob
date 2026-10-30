import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALANCE } from '../src/game/balance'
import { materialById } from '../src/game/catalog'
import { createNewGame, createJob, inventoryQty, makeStages, purchaseMaterial, quoteMaterial, requiredMaterials, stockQty, tickHour, warehouseCost, warehouseSpace, warehouseStorageFee } from '../src/game/engine'
import { missingForProject, restockMaterialFromWarehouse, restockProjectFromWarehouse, takeJob } from '../src/game/actions'
import type { GameState, MaterialId, Project } from '../src/game/types'

function freshState(money = 100_000_000): GameState {
  const state = createNewGame(9)
  state.money = money
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  return state
}

function takeReconstruction(state: GameState): Project {
  const job = createJob(state, 'reconstruction')
  state.jobs.push(job)
  const result = takeJob(state, job.id)
  assert.equal(result.ok, true)
  return state.projects[0]!
}

describe('склад: потолок покупки', () => {
  it('покупка сверх потолка на склад отклоняется, деньги и базу не тратит', () => {
    const state = freshState()
    state.inventory.concrete.push({ qty: 900, unitCost: 4_000 })
    const moneyBefore = state.money
    const stockBefore = stockQty(state, 'concrete', 'north')
    const result = purchaseMaterial(state, 'concrete', 200, 'north')
    assert.equal(result.ok, false)
    assert.match(result.message, /Склад не вмещает/)
    assert.equal(state.money, moneyBefore)
    assert.equal(inventoryQty(state, 'concrete'), 900)
    assert.equal(stockQty(state, 'concrete', 'north'), stockBefore)
    assert.equal(warehouseSpace(state, 'concrete'), 100)
  })

  it('покупка ровно до потолка проходит', () => {
    const state = freshState()
    state.inventory.concrete.push({ qty: 990, unitCost: 4_000 })
    const result = purchaseMaterial(state, 'concrete', 10, 'north')
    assert.equal(result.ok, true)
    assert.equal(inventoryQty(state, 'concrete'), 1_000)
  })

  it('покупка в резерв объекта потолком не ограничивается', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    state.inventory.concrete.push({ qty: 1_000, unitCost: 4_000 })
    const result = purchaseMaterial(state, 'concrete', 100, 'north', project.id)
    assert.equal(result.ok, true)
    assert.equal(inventoryQty(state, 'concrete'), 1_000)
    const reserved = project.reserved.concrete ?? []
    assert.equal(reserved.reduce((sum, batch) => sum + batch.qty, 0), 100)
  })
})

describe('склад: продажа излишка сверх потолка', () => {
  it('возврат неиспользованного резерва продаёт излишек за 70% себестоимости', () => {
    const state = freshState()
    state.crews[0].workers.push({ id: 'w1', name: 'Тест', type: 'foreman', rate: 2_000, skills: [] })
    const project: Project = {
      id: 'proj-1',
      job: { id: 'job-1', client: 'Тест', building: 'reconstruction', budget: 800_000, deadline: state.day + 30, createdDay: state.day, special: false, expiresDay: state.day + 30 },
      stages: makeStages('reconstruction'), currentStage: 0, crewIds: [0], equipmentAssetId: null,
      reserved: { concrete: [{ qty: 700, unitCost: 100 }] }, autoAdvance: false, started: true,
      materialCost: 0, laborCost: 0, laborPaid: 0, logisticsCost: 0, equipmentCost: 0, rentCost: 0, factoringFee: 0, advance: 0, penalty: 0, totalHours: 0, completedDay: null, profit: 0,
    }
    state.projects.push(project)
    state.inventory.concrete.push({ qty: 900, unitCost: 50 })
    const last = project.stages.length - 1
    project.currentStage = last
    project.stages[last].status = 'in_progress'
    project.stages[last].progress = 0.999
    state.hour = BALANCE.workDayStart
    state.paused = false
    const moneyBefore = state.money
    tickHour(state)
    assert.equal(project.completedDay, state.day)
    assert.equal(inventoryQty(state, 'concrete'), 1_000)
    assert.equal(inventoryQty(state, 'concrete') <= BALANCE.warehouseCap, true)
    const soldQty = 700 - (1_000 - 900)
    const income = Math.round(soldQty * 100 * BALANCE.warehouseSaleRate)
    assert.equal(state.money, moneyBefore - 2_000 + 800_000 + income)
    assert.ok(state.journal.some((entry) => entry.text.includes('сверх лимита')))
  })

  it('поставка без объекта при почти полном складе продаёт излишек', () => {
    const state = freshState()
    const unitCost = Math.round(quoteMaterial(state, 'concrete', 500, 'south').cost / 500)
    const result = purchaseMaterial(state, 'concrete', 500, 'south')
    assert.equal(result.ok, true)
    assert.equal(state.deliveries.length, 1)
    state.inventory.concrete.push({ qty: 700, unitCost: 90 })
    const moneyAfterPurchase = state.money
    state.hour = 23
    state.paused = false
    tickHour(state)
    assert.equal(inventoryQty(state, 'concrete'), 1_000)
    const income = Math.round(200 * unitCost * BALANCE.warehouseSaleRate)
    const fee = warehouseStorageFee(state)
    assert.equal(state.money, moneyAfterPurchase + income - fee)
    assert.ok(state.journal.some((entry) => entry.text.includes('сверх лимита')))
  })
})

describe('склад: тарифы хранения', () => {
  it('0 при пустом складе', () => {
    const state = freshState()
    assert.equal(warehouseStorageFee(state), 0)
    assert.equal(warehouseCost(state), 0)
  })

  it('1% от стоимости запаса при 1–500 ед.', () => {
    const state = freshState()
    state.inventory.concrete.push({ qty: 100, unitCost: 100 })
    assert.equal(warehouseStorageFee(state), 100)
    state.inventory.rebar.push({ qty: 50, unitCost: 10 })
    assert.equal(warehouseStorageFee(state), 105)
  })

  it('2% при >500 ед. и математическое округление', () => {
    const state = freshState()
    state.inventory.concrete.push({ qty: 501, unitCost: 100 })
    assert.equal(warehouseStorageFee(state), Math.round(50_100 * 0.02))
    state.inventory.concrete = [{ qty: 1, unitCost: 50 }]
    assert.equal(warehouseStorageFee(state), Math.round(50 * 0.01))
  })
})

describe('склад: ежедневное списание', () => {
  it('плата списывается каждый день', () => {
    const state = freshState()
    state.inventory.concrete.push({ qty: 600, unitCost: 10 })
    const fee = warehouseStorageFee(state)
    assert.equal(fee, Math.round(6_000 * 0.02))
    const before = state.money
    state.hour = 23
    state.paused = false
    tickHour(state)
    assert.equal(state.money, before - fee)
  })

  it('при нехватке денег плата фиксируется в журнале как «Обслуживание · Склад»', () => {
    const state = freshState(10)
    state.inventory.concrete.push({ qty: 600, unitCost: 10_000 })
    assert.ok(warehouseStorageFee(state) > state.money)
    state.hour = 23
    state.paused = false
    tickHour(state)
    assert.ok(state.debt > 0)
    assert.ok(state.journal.some((entry) => entry.text.includes('Обслуживание · Склад')))
  })
})

describe('склад: пополнение объекта со склада', () => {
  it('restockProjectFromWarehouse переносит недостающее с реальной себестоимостью', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    const lumber = requiredMaterials(project)['lumber']
    assert.ok(lumber && lumber > 0)
    state.inventory.lumber.push({ qty: 100, unitCost: 1_000 })
    const need = missingForProject(state, project)['lumber'] ?? 0
    assert.ok(need > 0)
    const result = restockProjectFromWarehouse(state, project.id)
    assert.equal(result.ok, true)
    const taken = Math.min(need, 100)
    assert.equal(inventoryQty(state, 'lumber'), 100 - taken)
    const reserved = project.reserved.lumber ?? []
    assert.equal(reserved.reduce((sum, batch) => sum + batch.qty, 0), taken)
    assert.equal(reserved[0]?.unitCost, 1_000)
    assert.ok(state.journal.some((entry) => entry.text.includes('Пополнено со склада')))
  })

  it('restockMaterialFromWarehouse переносит один материал', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    state.inventory.lumber.push({ qty: 100, unitCost: 1_000 })
    const result = restockMaterialFromWarehouse(state, project.id, 'lumber', 30)
    assert.equal(result.ok, true)
    assert.equal(inventoryQty(state, 'lumber'), 70)
    const reserved = project.reserved.lumber ?? []
    assert.equal(reserved.reduce((sum, batch) => sum + batch.qty, 0), 30)
    assert.equal(reserved[0]?.unitCost, 1_000)
  })

  it('restockMaterialFromWarehouse отклоняет нулевое, дробное количество и отсутствующий материал', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    state.inventory.lumber.push({ qty: 100, unitCost: 1_000 })
    assert.equal(restockMaterialFromWarehouse(state, project.id, 'lumber', 0).ok, false)
    assert.equal(restockMaterialFromWarehouse(state, project.id, 'lumber', 1.5).ok, false)
    assert.equal(restockMaterialFromWarehouse(state, project.id, 'concrete', 10).ok, false)
    assert.equal(inventoryQty(state, 'lumber'), 100)
  })

  it('пополнение со склада может опустить тариф на более низкий уровень', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    state.inventory.lumber.push({ qty: 100, unitCost: 1_000 })
    state.inventory.rebar.push({ qty: 420, unitCost: 100 })
    const feeBefore = warehouseStorageFee(state)
    assert.ok(feeBefore > 0)
    const valueAfter = 70 * 1_000 + 420 * 100
    const result = restockMaterialFromWarehouse(state, project.id, 'lumber', 30)
    assert.equal(result.ok, true)
    assert.equal(inventoryQty(state, 'lumber'), 70)
    assert.equal(warehouseStorageFee(state), Math.round(valueAfter * 0.01))
    assert.ok(warehouseStorageFee(state) < feeBefore)
  })

  it('restockProjectFromWarehouse сообщает о пустом складе и полной обеспеченности', () => {
    const state = freshState()
    const project = takeReconstruction(state)
    const empty = restockProjectFromWarehouse(state, project.id)
    assert.equal(empty.ok, false)
    assert.match(empty.message, /На складе нет/)
    for (const [material, qty] of Object.entries(requiredMaterials(project)) as [MaterialId, number][]) {
      project.reserved[material] = [{ qty, unitCost: 1 }]
    }
    const done = restockProjectFromWarehouse(state, project.id)
    assert.equal(done.ok, false)
    assert.match(done.message, /уже есть/)
  })
})