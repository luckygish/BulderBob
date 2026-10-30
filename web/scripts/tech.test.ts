import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BALANCE } from '../src/game/balance'
import { PROVISIONS, TECHNOLOGIES, WORKER_TYPES, buildingById, equipmentById, techById } from '../src/game/catalog'
import { acquireEquipment, assignEquipment, chargeObligation, createJob, createNewGame, hasStageMaterials, isDebtBlocked, overdraftLimit, sellEquipment, spend, startStage, tickHour, workerBonus } from '../src/game/engine'
import { assignCrew, buyMissingForProject, buyProvision, hireWorker, startFullProject, takeJob } from '../src/game/actions'
import { seasonMaterialPriceRate, seasonNightWageMultiplier } from '../src/game/seasons'
import type { GameState, Project } from '../src/game/types'

const DONE = { status: 'done', progress: 0 } as const

function quietBots(state: GameState): void {
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
}

function fakeProject(): Project {
  return {
    id: 'fake', job: { id: 'fj', client: 'Клиент', building: 'reconstruction', budget: 1_000_000, deadline: 1, createdDay: 1, special: false, expiresDay: 1 },
    stages: [], currentStage: 0, crewIds: [], equipmentAssetId: null, reserved: {}, autoAdvance: false, started: true,
    materialCost: 0, laborCost: 0, laborPaid: 0, logisticsCost: 0, equipmentCost: 0, rentCost: 0, factoringFee: 0, advance: 0, penalty: 0, totalHours: 0, completedDay: 1, profit: 0,
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

function runProjectToCompletion(state: GameState): void {
  state.money = 50_000_000
  state.reputation = 90
  quietBots(state)
  for (const provision of PROVISIONS) assert.equal(buyProvision(state, provision.id).ok, true)
  const job = createJob(state, 'reconstruction')
  state.jobs.push(job)
  const taken = takeJob(state, job.id)
  assert.equal(taken.ok, true, taken.message)
  const project = state.projects[0]
  while (state.crews[0].workers.length < 3 && state.candidates.length > 0) {
    const worker = state.candidates[0]
    assert.equal(hireWorker(state, worker.id, 0).ok, true)
  }
  assert.equal(state.crews[0].workers.length, 3, 'бригада не укомплектована')
  assert.equal(assignCrew(state, project.id, 0, 0).ok, true)
  assert.equal(buyMissingForProject(state, project.id, 'north').ok, true)
  waitForDeliveries(state)
  acquireEquipment(state, 'mixer', 'rented', 400)
  const mixer = state.equipment.at(-1)!
  assert.equal(assignEquipment(state, project, mixer.assetId).ok, true)
  const started = startFullProject(state, project.id)
  assert.equal(started.ok, true, started.message)
  let ticks = 0
  while (state.projects.includes(project) && ticks < 4_000) {
    if (state.paused) state.paused = false
    if (state.event) state.event = null
    const current = project.stages[project.currentStage]
    if (current && current.status !== 'in_progress' && current.status !== 'completed' && hasStageMaterials(project, project.currentStage)) startStage(state, project)
    tickHour(state)
    ticks += 1
  }
  assert.ok(!state.projects.includes(project), 'проект не сдан в цикле')
}

describe('технологии: новые бонусы и баланс', () => {
  it('workerBonus: базовые значения и Кадровый резерв складываются', () => {
    const state = createNewGame(1)
    assert.equal(workerBonus(state), 0)
    state.research.worker_training = DONE
    assert.equal(workerBonus(state), 0.25, 'Обучение рабочих +0.25')
    state.research.manpower_reserve = DONE
    assert.equal(workerBonus(state), 0.4, 'Обучение + Кадровый резерв')

    const high = createNewGame(2)
    high.research.prof_standards = DONE
    assert.equal(workerBonus(high), 0.45, 'Профстандарты +0.45')
    high.research.manpower_reserve = DONE
    assert.equal(workerBonus(high), 0.6, 'Профстандарты + Кадровый резерв')
  })

  it('Согласование проектов: срок новых заказов +2 дня', () => {
    const plain = createNewGame(123)
    const withCoord = createNewGame(123)
    withCoord.research.project_coordination = DONE
    const j1 = createJob(plain, 'reconstruction')
    const j2 = createJob(withCoord, 'reconstruction')
    assert.equal(j2.deadline - withCoord.day, j1.deadline - plain.day + 2)
  })

  it('Резервный фонд: +500 000 ₽ при переходе сезона', () => {
    const state = createNewGame(31)
    quietBots(state)
    state.research.reserve_fund = DONE
    state.day = BALANCE.seasonDays
    state.hour = 23
    state.paused = false
    const before = state.money
    tickHour(state)
    assert.equal(state.day, 1)
    assert.equal(state.money, before + 500_000)
    assert.ok(state.journal.some((entry) => entry.text.includes('Reserve fund: +$500,000')), 'в журнале нет записи о резервном фонде')
  })

  it('PR-департамент: +2 репутации за каждый 5-й сданный объект', () => {
    const a = createNewGame(40)
    a.research.pr_department = DONE
    for (let i = 0; i < 4; i += 1) a.completed.push(fakeProject())
    const b = createNewGame(40)
    b.research.pr_department = DONE
    for (let i = 0; i < 5; i += 1) b.completed.push(fakeProject())
    const deltaA = a.reputation
    const deltaB = b.reputation
    runProjectToCompletion(a)
    runProjectToCompletion(b)
    assert.equal(a.reputation - deltaA, b.reputation - deltaB + 2, '4-я сданная → 5-я даёт бонус, 5-я → 6-я нет')
  })

  it('Сезонное планирование: дебаффы ×0.8', () => {
    const state = createNewGame(5)
    state.research.seasonal_planning = DONE
    assert.ok(Math.abs(seasonMaterialPriceRate(state) - 0.1 * 0.8) < 1e-9, 'Лето I: материалы ×0.8')

    const winter = createNewGame(6)
    winter.seasonIndex = 7
    winter.research.seasonal_planning = DONE
    assert.ok(Math.abs(seasonNightWageMultiplier(winter) - 1.5 * (1 + 0.25 * 0.8)) < 1e-9, 'Зима IV: тариф с ×0.8 к ставке')
  })

  it('Ночной координатор: тариф ×0.85', () => {
    const state = createNewGame(7)
    state.research.night_coordinator = DONE
    assert.ok(Math.abs(seasonNightWageMultiplier(state) - 1.5 * 0.85) < 1e-9)
  })

  it('Овердрафт: лимит 400 000 ₽ и поведение платежей', () => {
    const state = createNewGame(8)
    assert.equal(overdraftLimit(state), 0)
    assert.equal(spend(state, state.money + 1), false, 'без исследования в минус уйти нельзя')
    state.debt = 1
    assert.equal(isDebtBlocked(state), true, 'любой долг блокирует работу без исследования')
    assert.equal(spend(state, 0), false)
    state.debt = 0

    state.research.overdraft = DONE
    assert.equal(overdraftLimit(state), 400_000)
    state.money = 0
    assert.equal(spend(state, 400_000), true)
    assert.equal(state.money, -400_000)
    assert.equal(spend(state, 400_001), false, 'ниже лимита −400 000 тратить нельзя')

    state.money = 0
    state.debt = 0
    chargeObligation(state, 300_000, 'Тест')
    assert.equal(state.debt, 300_000)
    assert.equal(isDebtBlocked(state), false)
    assert.ok(state.journal.some((entry) => entry.text.includes('covered by overdraft')), 'нет записи «покрыто овердрафтом»')
    chargeObligation(state, 150_000, 'Тест')
    assert.equal(state.debt, 450_000)
    assert.equal(isDebtBlocked(state), true, 'долг выше лимита блокирует работу')
    assert.ok(state.journal.some((entry) => entry.text.includes('work halted')), 'нет записи «Работа остановлена»')

    state.day = BALANCE.seasonDays - 1
    state.hour = 23
    state.money = 0
    state.debt = 100_000
    state.paused = false
    quietBots(state)
    tickHour(state)
    assert.equal(state.debt, 101_000, 'долг должен вырасти на 1% за день')
  })

  it('Факторинг: аванс 40% и комиссия 1.5%', () => {
    const state = createNewGame(9)
    state.money = 50_000_000
    state.research.factoring = DONE
    const job = createJob(state, 'reconstruction')
    state.jobs.push(job)
    const before = state.money
    const taken = takeJob(state, job.id)
    assert.equal(taken.ok, true, taken.message)
    const project = state.projects[0]
    assert.equal(project.advance, Math.round(job.budget * BALANCE.factoringAdvance))
    assert.equal(project.factoringFee, Math.round(job.budget * BALANCE.factoringFee))
    assert.equal(state.money, before + project.advance - project.factoringFee)
  })

  it('Выгодный лизинг: скидка 8%', () => {
    const state = createNewGame(10)
    state.money = 50_000_000
    state.research.good_leasing = DONE
    const def = equipmentById('mixer')
    const before = state.money
    const acquired = acquireEquipment(state, 'mixer', 'leasing')
    assert.equal(acquired.ok, true, acquired.message)
    const asset = state.equipment.at(-1)!
    const total = Math.round(def.price * (1 + BALANCE.leaseInterest) * 0.92)
    const down = Math.round(def.price * BALANCE.leaseDownPayment)
    assert.equal(asset.leaseRemaining, total - down)
    assert.equal(state.money, before - down)
  })

  it('Дилерская сеть: продажа за 85%', () => {
    const state = createNewGame(11)
    state.money = 50_000_000
    state.research.dealer_network = DONE
    const bought = acquireEquipment(state, 'mixer', 'owned')
    assert.equal(bought.ok, true, bought.message)
    const asset = state.equipment[0]
    const before = state.money
    const sold = sellEquipment(state, asset.assetId)
    assert.equal(sold.ok, true, sold.message)
    assert.equal(state.money, before + Math.round(equipmentById('mixer').price * 0.85))
  })

  it('каталог: 18 технологий, уникальные id, валидные требования и цены', () => {
    assert.equal(TECHNOLOGIES.length, 18)
    assert.equal(new Set(TECHNOLOGIES.map((tech) => tech.id)).size, TECHNOLOGIES.length)
    for (const tech of TECHNOLOGIES) {
      if (tech.requires) assert.ok(techById(tech.requires), `${tech.id}: требует несуществующее «${tech.requires}»`)
    }
    assert.equal(techById('city_license').cost, 2_080_000)
    assert.equal(techById('region_license').cost, 4_160_000)
    assert.equal(techById('automation').cost, 1_000_000)
    assert.equal(techById('automation').requiresMoney, 2_500_000)
    assert.equal(techById('build_squad').requires, 'automation')
    for (const id of ['project_coordination', 'pr_department', 'manpower_reserve', 'reserve_fund']) assert.ok(techById(id), `нет технологии «${id}»`)
    assert.equal(buildingById('hospital').requiredLicense, 'city')
    assert.equal(buildingById('roads').requiredLicense, 'region')
    assert.equal(buildingById('roads').minSiteWorkers, 8)
    assert.equal(buildingById('ice_palace').minSiteWorkers, 8)
    assert.equal(WORKER_TYPES.handyman.rateMin, 960)
    assert.equal(WORKER_TYPES.foreman.rateMax, 2_760)
  })

  it('Строй-отряд: лимит бригады 5 человек', () => {
    const state = createNewGame(50)
    state.research.prof_standards = DONE
    state.research.build_squad = DONE
    for (let i = 0; i < 5 && state.candidates.length > 0; i += 1) {
      const worker = state.candidates[0]
      assert.equal(hireWorker(state, worker.id, 0).ok, true)
    }
    assert.equal(state.crews[0].workers.length, 5)
    const sixth = state.candidates[0]
    if (sixth) {
      const result = hireWorker(state, sixth.id, 0)
      assert.equal(result.ok, false)
      assert.equal(state.crews[0].workers.length, 5)
    }
  })

  it('Областной контракт требует 8 рабочих на объекте', () => {
    const state = createNewGame(51)
    state.money = 50_000_000
    state.reputation = 90
    state.research.prof_standards = DONE
    state.research.build_squad = DONE
    state.research.region_license = DONE
    quietBots(state)
    const job = createJob(state, 'roads')
    state.jobs.push(job)
    assert.equal(takeJob(state, job.id).ok, true)
    const project = state.projects[0]
    for (let crew = 0; crew < 2; crew += 1) {
      while (state.crews[crew].workers.length < 3 && state.candidates.length > 0) {
        const worker = state.candidates[0]
        assert.equal(hireWorker(state, worker.id, crew).ok, true)
      }
      assignCrew(state, project.id, crew, crew)
    }
    const started = startStage(state, project)
    assert.equal(started.ok, false)
    assert.match(started.message, /requires 8 workers/i)
  })

  it('областной контракт нельзя взять без технологии Строй-отряд', () => {
    const state = createNewGame(52)
    state.money = 50_000_000
    state.reputation = 90
    state.research.prof_standards = DONE
    state.research.region_license = DONE
    quietBots(state)
    const job = createJob(state, 'roads')
    state.jobs.push(job)
    const taken = takeJob(state, job.id)
    assert.equal(taken.ok, false)
    assert.match(taken.message, /workers on site/)
    assert.equal(state.projects.length, 0)
  })
})