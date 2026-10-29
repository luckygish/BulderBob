import { BALANCE } from './balance'
import { EQUIPMENT, PROVISIONS, buildingById, materialById } from './catalog'
import { crewEfficiency, frontPrice, inventoryQty, isDebtBlocked, isResearched, maxCrews, maxProjects, missingProvisions, netWorth, nightEfficiency, projectEquipmentReady, projectWorkers, requiredCrews } from './engine'
import { currentSeason, seasonFoundationManHours, seasonMaintenanceRate, seasonMaterialPriceRate, seasonWageRate, workDayEnd } from './seasons'
import type { GameState, Job, MaterialId, Project } from './types'

export function estimateJob(state: GameState, job: Job) {
  const def = buildingById(job.building)
  let materials = 0
  let manHours = 0
  for (const stage of def.stages) {
    manHours += stage.manHours
    for (const [material, qty] of Object.entries(stage.materials) as [MaterialId, number][]) materials += frontPrice(state, material) * qty
  }
  materials = Math.round(materials * (1 + seasonMaterialPriceRate(state)))
  const workers = state.crews[0].workers
  const crewCount = def.requiredCrews ?? 1
  const efficiency = workers.length > 0 ? crewEfficiency(workers) * crewCount : 2 * crewCount
  const hourly = workers.length > 0 ? workers.reduce((sum, worker) => sum + worker.rate, 0) * crewCount : 2_800 * crewCount
  const labor = Math.round(manHours / efficiency * hourly * (1 + seasonWageRate(state)))
  const profit = job.budget - materials - labor
  const days = Math.max(1, Math.ceil(manHours / efficiency / 10))
  return { materials, labor, manHours, profit, margin: profit / job.budget, days, startup: materials + PROVISIONS.reduce((sum, item) => sum + (state.provisions[item.id] > state.projects.length ? 0 : item.price), 0) + 16_000 }
}

export function projectProgress(project: Project): number {
  const def = buildingById(project.job.building)
  const total = def.stages.reduce((sum, stage) => sum + stage.manHours, 0)
  const done = def.stages.reduce((sum, stage, index) => {
    const stageState = project.stages[index]
    return sum + (stageState.status === 'completed' ? stage.manHours : stageState.status === 'in_progress' ? stage.manHours * stageState.progress : 0)
  }, 0)
  return total ? done / total : 0
}

export function projectCosts(project: Project) {
  const direct = project.materialCost + project.laborCost + project.logisticsCost + project.equipmentCost + project.factoringFee
  return { direct, profit: project.job.budget - direct - project.penalty, margin: (project.job.budget - direct - project.penalty) / project.job.budget }
}

export function forecastProject(state: GameState, project: Project): { days: number; onTime: boolean } {
  const def = buildingById(project.job.building)
  const workers = projectWorkers(state, project)
  const efficiency = workers.length ? crewEfficiency(workers) : requiredCrews(project)
  const workday = workDayEnd(state) - BALANCE.workDayStart
  const hasOwl = workers.some((worker) => worker.skills.includes('owl'))
  const night = isResearched(state, 'automation') ? 24 - workday : hasOwl ? 24 - workDayEnd(state) : 0
  const hoursPerDay = night > 0 ? workday + night * nightEfficiency(state, hasOwl) : workday
  let remaining = 0
  def.stages.forEach((stage, index) => {
    const current = project.stages[index]
    if (current.status !== 'completed') remaining += seasonFoundationManHours(state, stage.manHours) * (1 - current.progress)
  })
  const days = Math.max(1, Math.ceil(remaining / efficiency / hoursPerDay))
  return { days, onTime: state.day + days <= project.job.deadline }
}

export function projectBlockReason(state: GameState, project: Project): string {
  if (isDebtBlocked(state)) return `Долг ${state.debt.toLocaleString('ru-RU')} ₽`
  const needCrews = requiredCrews(project)
  const assigned = project.crewIds.filter((crewId) => crewId >= 0 && crewId < maxCrews(state) && state.crews[crewId].workers.length > 0).length
  if (assigned < needCrews) return needCrews > 1 ? `Нужны две бригады (${assigned}/2)` : 'Нужна бригада'
  if (!projectEquipmentReady(state, project)) {
    const stage = buildingById(project.job.building).stages[project.currentStage]
    return `Нужна техника: ${stage.requiredEquipment?.map((id) => EQUIPMENT.find((item) => item.id === id)?.name).join(' или ')}`
  }
  const missing = missingProvisions(state)
  const names = Object.keys(missing).map((id) => PROVISIONS.find((item) => item.id === id)?.name).filter(Boolean)
  if (names.length) return `Докупите обеспечение: ${names.join(', ')}`
  return ''
}

export function capitalProgress(state: GameState): number {
  return Math.min(1, Math.max(0, netWorth(state) / currentSeason(state).goal.capital))
}

export function seasonGoalMet(state: GameState): boolean {
  const goal = currentSeason(state).goal
  return state.day <= BALANCE.seasonDays && netWorth(state) >= goal.capital && state.reputation >= goal.reputation && state.seasonCompleted >= goal.completed
}

export function activeProjectLimitText(state: GameState): string {
  return `${state.projects.length} / ${maxProjects(state)}`
}

export function inventoryCost(state: GameState): number {
  let total = 0
  for (const batches of Object.values(state.inventory)) for (const batch of batches) total += batch.qty * batch.unitCost
  for (const project of state.projects) for (const batches of Object.values(project.reserved)) for (const batch of batches) total += batch.qty * batch.unitCost
  return total
}

export function inventoryLabel(state: GameState, material: MaterialId): string {
  return `${inventoryQty(state, material)} ${materialById(material).unit}`
}

export function equipmentMaintenance(state: GameState): number {
  return state.equipment.reduce((sum, asset) => {
    if (asset.status === 'rented') return sum
    const def = EQUIPMENT.find((item) => item.id === asset.id)!
    return sum + Math.max(1, Math.round(def.price * seasonMaintenanceRate(state)))
  }, 0)
}

export const COMPANY_STATUSES = [
  { capital: 0, name: 'ИЖС · Частный подряд' },
  { capital: 3_000_000, name: 'Местный застройщик' },
  { capital: 6_000_000, name: 'Региональный подрядчик' },
  { capital: 12_000_000, name: 'Городской девелопер' },
  { capital: 21_600_000, name: 'Федеральный застройщик' },
  { capital: 36_000_000, name: 'Корпорация недвижимости' },
] as const

export function companyStatus(state: GameState): { name: string; index: number; progress: number } {
  const capital = netWorth(state)
  const index = COMPANY_STATUSES.reduce((current, item, itemIndex) => capital >= item.capital ? itemIndex : current, 0)
  const current = COMPANY_STATUSES[index]
  const next = COMPANY_STATUSES[index + 1]
  const progress = next ? (capital - current.capital) / (next.capital - current.capital) : 1
  return { name: current.name, index, progress: Math.max(0, Math.min(1, progress)) }
}
