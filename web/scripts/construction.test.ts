import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BUILDINGS, PROVISIONS, buildingById } from '../src/game/catalog'
import { acquireEquipment, assignEquipment, createNewGame, createJob, hasStageMaterials, startStage, tickHour } from '../src/game/engine'
import { assignCrew, buyMissingForProject, buyProvision, hireWorker, startFullProject, takeJob } from '../src/game/actions'
import type { EquipmentAsset, EquipmentId, GameState, Project } from '../src/game/types'

const MANHOUR_TOTALS: Record<string, number> = {
  reconstruction: 57,
  frame_house: 203,
  brick_house: 286,
  gas_block_house: 201,
  hangar: 381,
  tv_tower: 599,
  apartments: 547,
  resort_house: 300,
  park: 236,
  kindergarten: 339,
  hospital: 750,
  roads: 541,
  warehouses: 696,
  thermal_plant: 915,
  school: 415,
  sports_complex: 679,
  bridge: 772,
  ice_palace: 818,
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

function simulate(buildingId: string): void {
  const state = createNewGame(1_234)
  state.money = 50_000_000
  state.reputation = 90
  for (const bot of state.bots) {
    bot.state = 'cooldown'
    bot.cooldown = 9_999
    bot.projects = []
  }
  const def = buildingById(buildingId)
  const requiredCrews = def.requiredCrews ?? 1
  if (requiredCrews === 2) state.research.prof_standards = { status: 'done', progress: 0 }

  const job = createJob(state, def.id)
  state.jobs.push(job)
  const taken = takeJob(state, job.id)
  assert.equal(taken.ok, true, taken.message)
  const project = state.projects[0]

  for (let crew = 0; crew < requiredCrews; crew += 1) {
    while (state.crews[crew].workers.length < 3 && state.candidates.length > 0) {
      const worker = state.candidates[0]
      hireWorker(state, worker.id, crew)
    }
    assert.equal(state.crews[crew].workers.length, 3, `${def.id}: бригада ${crew} не укомплектована`)
  }
  for (let crew = 0; crew < requiredCrews; crew += 1) assignCrew(state, project.id, crew, crew)
  for (const provision of PROVISIONS) assert.equal(buyProvision(state, provision.id).ok, true)

  const mixer = rent(state, 'mixer')
  if (CRANE_BUILDINGS.has(buildingId)) rent(state, 'crane')
  if (MANIPULATOR_BUILDINGS.has(buildingId)) rent(state, 'manipulator')
  if (EXCAVATOR_BUILDINGS.has(buildingId)) rent(state, 'excavator')

  const bought = buyMissingForProject(state, project.id, 'north')
  assert.equal(bought.ok, true, `${def.id}: ${bought.message}`)
  assignEquipment(state, project, mixer.assetId)
  const started = startFullProject(state, project.id)
  assert.equal(started.ok, true, `${def.id}: ${started.message}`)

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

  assert.ok(!state.projects.includes(project), `${def.id}: не достроен за ${ticks} ходов`)
  assert.ok(project.completedDay !== null, `${def.id}: проект не сдан`)
  assert.ok(project.completedDay! <= deadline, `${def.id}: сдан на день ${project.completedDay}, срок — день ${deadline}`)
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