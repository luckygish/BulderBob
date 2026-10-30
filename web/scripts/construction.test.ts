import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BUILDINGS, PROVISIONS, buildingById } from '../src/game/catalog'
import { acquireEquipment, assignEquipment, createNewGame, createJob, hasStageMaterials, projectCrewsReady, requiredCrews, startStage, tickHour } from '../src/game/engine'
import { assignCrew, buyMissingForProject, buyProvision, hireWorker, startFullProject, takeJob } from '../src/game/actions'
import type { EquipmentAsset, EquipmentId, GameState, Project } from '../src/game/types'

const MANHOUR_TOTALS: Record<string, number> = {
  reconstruction: 69,
  frame_house: 243,
  brick_house: 342,
  gas_block_house: 241,
  hangar: 456,
  tv_tower: 717,
  apartments: 656,
  resort_house: 359,
  park: 340,
  kindergarten: 487,
  hospital: 1_076,
  roads: 778,
  warehouses: 1_002,
  thermal_plant: 1_316,
  school: 596,
  sports_complex: 976,
  bridge: 1_110,
  ice_palace: 1_175,
}

const CRANE_BUILDINGS = new Set(['hangar', 'tv_tower', 'apartments', 'kindergarten', 'hospital', 'warehouses', 'thermal_plant', 'school', 'sports_complex', 'bridge', 'ice_palace'])
const MANIPULATOR_BUILDINGS = new Set(['resort_house', 'park', 'kindergarten', 'hospital', 'school', 'sports_complex', 'ice_palace'])
const EXCAVATOR_BUILDINGS = new Set(['roads', 'warehouses', 'bridge'])

function assignForStage(state: GameState, project: Project): void {
  const def = buildingById(project.job.building)
  const stageDef = def.stages[project.currentStage]
  if (!stageDef?.requiredEquipment?.length) return
  const asset = state.equipment.find((item) => stageDef!.requiredEquipment!.includes(item.id))
  assert.ok(asset, `нет техники для этапа «${stageDef.name}» у ${def.id}`)
  if (project.equipmentAssetId !== asset.assetId) assignEquipment(state, project, asset.assetId)
}

function rent(state: GameState, id: EquipmentId): EquipmentAsset {
  acquireEquipment(state, id, 'rented', 400)
  return state.equipment.at(-1)!
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

function beginSimulationNoBuy(buildingId: string): { state: GameState; project: Project } {
  const state = createNewGame(1_234)
  state.money = 50_000_000
  state.reputation = 90
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  const def = buildingById(buildingId)
  const crewCount = def.requiredCrews ?? 1
  if (crewCount === 2) state.research.prof_standards = { status: 'done', progress: 0 }
  const targetSize = def.minSiteWorkers ? Math.ceil(def.minSiteWorkers / crewCount) : 3
  if (def.minSiteWorkers) state.research.build_squad = { status: 'done', progress: 0 }

  const job = createJob(state, def.id)
  state.jobs.push(job)
  const taken = takeJob(state, job.id)
  assert.equal(taken.ok, true, taken.message)
  const project = state.projects[0]

  for (let crew = 0; crew < crewCount; crew += 1) {
    while (state.crews[crew].workers.length < targetSize && state.candidates.length > 0) {
      const worker = state.candidates[0]
      hireWorker(state, worker.id, crew)
    }
    assert.equal(state.crews[crew].workers.length, targetSize, `${def.id}: бригада ${crew} не укомплектована`)
  }
  for (let crew = 0; crew < crewCount; crew += 1) assignCrew(state, project.id, crew, crew)
  for (const provision of PROVISIONS) assert.equal(buyProvision(state, provision.id).ok, true)

  const mixer = rent(state, 'mixer')
  if (CRANE_BUILDINGS.has(buildingId)) rent(state, 'crane')
  if (MANIPULATOR_BUILDINGS.has(buildingId)) rent(state, 'manipulator')
  if (EXCAVATOR_BUILDINGS.has(buildingId)) rent(state, 'excavator')

  assignEquipment(state, project, mixer.assetId)
  return { state, project }
}

function beginSimulation(buildingId: string): { state: GameState; project: Project } {
  const { state, project } = beginSimulationNoBuy(buildingId)
  let guard = 0
  while (guard < 240) {
    const bought = buyMissingForProject(state, project.id, 'north')
    if (bought.ok) {
      waitForDeliveries(state)
      return { state, project }
    }
    if (state.paused) state.paused = false
    if (state.event) state.event = null
    tickHour(state)
    guard += 1
  }
  assert.fail(`${buildingId}: не удалось закупить материалы за ${guard} ходов`)
}

function simulate(buildingId: string): void {
  const { state, project } = beginSimulation(buildingId)
  const started = startFullProject(state, project.id)
  assert.equal(started.ok, true, `${buildingId}: ${started.message}`)

  const deadline = project.job.deadline
  let ticks = 0
  while (state.projects.includes(project) && ticks < 4_000) {
    if (state.paused) state.paused = false
    if (state.event) state.event = null
    assignForStage(state, project)
    const current = project.stages[project.currentStage]
    if (current && current.status !== 'in_progress' && current.status !== 'completed' && hasStageMaterials(project, project.currentStage)) startStage(state, project)
    tickHour(state)
    ticks += 1
  }

  assert.ok(!state.projects.includes(project), `${buildingId}: не достроен за ${ticks} ходов`)
  assert.ok(project.completedDay !== null, `${buildingId}: проект не сдан`)
  assert.ok(project.completedDay! <= deadline, `${buildingId}: сдан на день ${project.completedDay}, срок — день ${deadline}`)
}

describe('стройка: трудоёмкость этапов увеличена на 15%', () => {
  it('суммарные человеко-часы всех зданий соответствуют плану', () => {
    for (const building of BUILDINGS) {
      const sum = building.stages.reduce((total, stage) => total + stage.manHours, 0)
      assert.equal(sum, MANHOUR_TOTALS[building.id], `${building.id}: сумма человеко-часов`)
    }
  })

  it('сроки заказов автопродлены и соблюдаются для всех зданий', () => {
    for (const building of BUILDINGS) simulate(building.id)
  })
})

describe('стройка: сообщения о нехватке материалов', () => {
  it('startFullProject без материалов перечисляет этапы и материалы', () => {
    const { state, project } = beginSimulationNoBuy('reconstruction')
    const result = startFullProject(state, project.id)
    assert.equal(result.ok, false)
    assert.match(result.message, /Stage 1 "Foundation":/)
    assert.match(result.message, /Concrete/)
    assert.match(result.message, /Rebar/)
    assert.match(result.message, /Walls & frame/)
  })

  it('startStage при недоукомплектованном этапе сообщает недостающий материал', () => {
    const { state, project } = beginSimulationNoBuy('reconstruction')
    const result = startStage(state, project)
    assert.equal(result.ok, false)
    assert.match(result.message, /"Foundation" is missing/)
    assert.match(result.message, /Concrete/)
    assert.match(result.message, /Rebar 3/)
  })

  it('buyMissingForProject сообщает нужное и доступное количество', () => {
    const { state, project } = beginSimulationNoBuy('reconstruction')
    state.suppliers.north.concrete = []
    const result = buyMissingForProject(state, project.id, 'north')
    assert.equal(result.ok, false)
    assert.match(result.message, /need [\d.]+ m³ Concrete/)
    assert.match(result.message, /only [\d.]+ m³ in stock/)
  })
})

describe('стройка: автообеспечение ресурсами', () => {
  it('взятие заказа подставляет свободную бригаду и свободную требуемую технику', () => {
    const state = createNewGame(333)
    state.money = 50_000_000
    while (state.crews[0].workers.length < 3 && state.candidates.length > 0) {
      const worker = state.candidates[0]
      assert.equal(hireWorker(state, worker.id, 0).ok, true)
    }
    assert.equal(state.crews[0].workers.length, 3, 'бригада не укомплектована')
    acquireEquipment(state, 'mixer', 'rented', 100)
    const muffler = state.equipment.at(-1)
    assert.ok(muffler, 'нет арендованной техники')

    const job = createJob(state, 'reconstruction')
    state.jobs.push(job)
    assert.equal(takeJob(state, job.id).ok, true)
    const project = state.projects[0]
    assert.equal(project.crewIds.length, 1, 'свободная бригада не подставлена')
    assert.equal(project.crewIds[0], 0)
    assert.equal(project.equipmentAssetId, muffler!.assetId, 'свободная требуемая техника не подставлена')
    assert.equal(state.equipment.find((item) => item.assetId === project.equipmentAssetId)?.projectId, project.id)
  })

  it('снятая с проекта бригада не возвращается автоматически', () => {
    const state = createNewGame(334)
    state.money = 50_000_000
    state.research.prof_standards = { status: 'done', progress: 0 }
    for (let crew = 0; crew < 2; crew += 1) {
      while (state.crews[crew].workers.length < 3 && state.candidates.length > 0) {
        const worker = state.candidates[0]
        hireWorker(state, worker.id, crew)
      }
    }
    const job = createJob(state, 'kindergarten')
    state.jobs.push(job)
    assert.equal(takeJob(state, job.id).ok, true)
    const project = state.projects[0]
    assignCrew(state, project.id, 0, 0)
    assignCrew(state, project.id, 1, 1)
    assert.equal(assignCrew(state, project.id, -1, 1).ok, true)
    assert.equal(project.crewIds.length, 1, 'слот должен остаться пустым после снятия')
  })

  it('снятая бригада не возвращается при повторном startStage', () => {
    const state = createNewGame(335)
    state.money = 50_000_000
    while (state.crews[0].workers.length < 3 && state.candidates.length > 0) {
      const worker = state.candidates[0]
      assert.equal(hireWorker(state, worker.id, 0).ok, true)
    }
    acquireEquipment(state, 'mixer', 'rented', 100)
    const job = createJob(state, 'reconstruction')
    state.jobs.push(job)
    assert.equal(takeJob(state, job.id).ok, true)
    const project = state.projects[0]
    assert.equal(project.crewIds.length, 1, 'свободная бригада не подставлена')
    assert.equal(assignCrew(state, project.id, -1, 0).ok, true)
    assert.equal(project.crewIds.length, 0)
    startStage(state, project)
    assert.equal(project.crewIds.length, 0, 'снятая бригада не должна вернуться на повторный startStage')
    assert.equal(projectCrewsReady(state, project), false)
  })
})

describe('стройка: бригады', () => {
  it('снятие обязательной второй бригады останавливает стройку, возврат возобновляет', () => {
    const { state, project } = beginSimulation('kindergarten')
    const started = startStage(state, project)
    assert.equal(started.ok, true, started.message)
    assert.equal(requiredCrews(project), 2, 'детсад должен требовать две бригады')
    const stage = project.stages[project.currentStage]
    const progressBefore = stage.progress
    const laborBefore = project.laborCost

    const removed = assignCrew(state, project.id, -1, 1)
    assert.equal(removed.ok, true, removed.message)
    assert.equal(projectCrewsReady(state, project), false, 'после снятия бригады стройка должна быть заблокирована')

    for (let tick = 0; tick < 40; tick += 1) {
      if (state.paused) state.paused = false
      if (state.event) state.event = null
      assignForStage(state, project)
      tickHour(state)
    }
    assert.equal(stage.progress, progressBefore, 'прогресс не должен расти без второй бригады')
    assert.equal(project.laborCost, laborBefore, 'часы и зарплата не должны начисляться без второй бригады')

    const restored = assignCrew(state, project.id, 1, 1)
    assert.equal(restored.ok, true, restored.message)
    assert.equal(projectCrewsReady(state, project), true)
    let resume = 0
    while (stage.progress < 1 && resume < 400) {
      if (state.paused) state.paused = false
      if (state.event) state.event = null
      assignForStage(state, project)
      tickHour(state)
      resume += 1
    }
    assert.ok(resume < 400, 'стройка не возобновилась после возврата бригады')
    assert.ok(project.laborCost > laborBefore, 'часы не изменились после возврата бригады')
  })
})