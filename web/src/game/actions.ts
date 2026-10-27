import { BALANCE } from './balance'
import { MATERIALS, PROVISIONS, buildingById, materialById, techById } from './catalog'
import { addLog, allocateStage, crewHourly, frontPrice, hasStageMaterials, inventoryQty, isResearched, makeStages, maxCrews, maxProjects, projectLogisticsRate, projectReservedQty, purchaseMaterial, quoteMaterial, requiredCrews, requiredMaterials, spend, startStage, stockQty } from './engine'
import { nextId } from './rng'
import type { ActionResult, GameState, MaterialId, Project, ProvisionId, Speed, SupplierId } from './types'

export function takeJob(state: GameState, jobId: string): ActionResult {
  if (state.debt > 0) return { ok: false, message: 'Сначала погасите обязательства.' }
  if (state.projects.length >= maxProjects(state)) return { ok: false, message: `Лимит активных объектов: ${maxProjects(state)}.` }
  const job = state.jobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, message: 'Заказ уже недоступен.' }
  state.jobs = state.jobs.filter((item) => item.id !== jobId)
  const usedCrews = new Set(state.projects.flatMap((project) => project.crewIds))
  let freeCrew = -1
  for (let i = 0; i < maxCrews(state); i += 1) if (!usedCrews.has(i)) { freeCrew = i; break }
  const project: Project = {
    id: nextId(state, 'project'), job, stages: makeStages(job.building), currentStage: 0,
    crewIds: freeCrew >= 0 ? [freeCrew] : [], equipmentAssetId: null, reserved: {}, autoAdvance: false, started: false,
    materialCost: 0, laborCost: 0, laborPaid: 0, logisticsCost: 0, equipmentCost: 0,
    factoringFee: 0, advance: 0, penalty: 0, totalHours: 0, completedDay: null, profit: 0,
  }
  if (isResearched(state, 'factoring')) {
    project.advance = Math.round(job.budget * BALANCE.factoringAdvance)
    project.factoringFee = Math.round(job.budget * BALANCE.factoringFee)
    state.money += project.advance - project.factoringFee
  }
  state.projects.push(project)
  addLog(state, `Взят заказ «${buildingById(job.building).name}» для ${job.client}.`, 'success')
  return { ok: true, message: 'Проект создан. Проверьте бригаду, технику и обеспечение.' }
}

export function hireWorker(state: GameState, workerId: string, crewId: number): ActionResult {
  if (crewId < 0 || crewId >= maxCrews(state)) return { ok: false, message: 'Эта бригада ещё не открыта.' }
  if (state.crews[crewId].workers.length >= BALANCE.maxCrewSize) return { ok: false, message: 'В бригаде уже 3 человека.' }
  const worker = state.candidates.find((item) => item.id === workerId)
  if (!worker) return { ok: false, message: 'Кандидат уже нанят другой компанией.' }
  state.candidates = state.candidates.filter((item) => item.id !== workerId)
  state.crews[crewId].workers.push(worker)
  return { ok: true, message: `${worker.name} добавлен в бригаду №${crewId + 1}.` }
}

export function fireWorker(state: GameState, workerId: string, crewId: number): ActionResult {
  const crew = state.crews[crewId]
  const worker = crew?.workers.find((item) => item.id === workerId)
  if (!worker) return { ok: false, message: 'Работник не найден.' }
  crew.workers = crew.workers.filter((item) => item.id !== workerId)
  state.candidates.push(worker)
  return { ok: true, message: `${worker.name} возвращён в список кандидатов.` }
}

export function assignCrew(state: GameState, projectId: string, crewId: number, slot = 0): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Проект не найден.' }
  if (crewId >= maxCrews(state)) return { ok: false, message: 'Бригада недоступна.' }
  if (crewId >= 0) {
    for (const other of state.projects) {
      if (other.id !== project.id) other.crewIds = other.crewIds.filter((id) => id !== crewId)
    }
    project.crewIds = project.crewIds.filter((id, index) => id !== crewId && index !== slot)
    project.crewIds[slot] = crewId
  } else {
    project.crewIds.splice(slot, 1)
  }
  project.crewIds = [...new Set(project.crewIds.filter((id) => id >= 0))].slice(0, requiredCrews(project))
  return { ok: true, message: crewId < 0 ? 'Бригада снята с объекта.' : `Назначена бригада №${crewId + 1}.` }
}

export function allocateProjectStage(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Проект не найден.' }
  const ready = allocateStage(state, project, project.currentStage)
  return { ok: ready, message: ready ? 'Этап полностью обеспечен.' : 'Часть материалов перенесена; остатка на складах не хватает.' }
}

export function startFullProject(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Проект не найден.' }
  if (project.started) return { ok: false, message: 'Стройка уже начата.' }
  const missing = missingForProject(state, project)
  if (Object.keys(missing).length > 0) return { ok: false, message: 'Для запуска всех этапов закупите недостающие материалы.' }
  project.stages.forEach((_, index) => allocateStage(state, project, index))
  project.autoAdvance = true
  return startStage(state, project)
}

export function startCurrentStage(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Проект не найден.' }
  return startStage(state, project)
}

export function missingForProject(state: GameState, project: Project): Partial<Record<MaterialId, number>> {
  const required = requiredMaterials(project)
  const missing: Partial<Record<MaterialId, number>> = {}
  for (const [material, total] of Object.entries(required) as [MaterialId, number][]) {
    const allocated = project.stages.reduce((sum, stage) => sum + (stage.stock[material]?.qty ?? 0), 0)
    const reserved = projectReservedQty(project, material)
    const need = Math.max(0, total - allocated - reserved - inventoryQty(state, material))
    if (need > 0) missing[material] = need
  }
  return missing
}

export function buyMissingForProject(state: GameState, projectId: string, supplier: SupplierId): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Проект не найден.' }
  if (state.debt > 0) return { ok: false, message: 'Сначала погасите обязательства.' }
  const missing = missingForProject(state, project)
  const entries = Object.entries(missing) as [MaterialId, number][]
  if (entries.length === 0) return { ok: false, message: 'Все материалы уже есть на складах компании или объекта.' }
  const feeMultiplier = 1 + projectLogisticsRate(state, project)
  let total = 0
  for (const [material, qty] of entries) {
    if (stockQty(state, material, supplier) < qty) return { ok: false, message: `На выбранной базе недостаточно: ${materialById(material).name}.` }
    const quote = quoteMaterial(state, material, qty, supplier)
    total += quote.cost + Math.round(quote.fee * feeMultiplier)
  }
  if (state.money < total) return { ok: false, message: `Нужно ${total.toLocaleString('ru-RU')} ₽ с учётом доставки.` }
  let fees = 0
  for (const [material, qty] of entries) {
    fees += Math.round(quoteMaterial(state, material, qty, supplier).fee * feeMultiplier)
    purchaseMaterial(state, material, qty, supplier, project.id, feeMultiplier)
  }
  project.logisticsCost += fees
  return { ok: true, message: `Закупка оформлена на ${total.toLocaleString('ru-RU')} ₽ и зарезервирована за объектом.` }
}

export function buyProvision(state: GameState, id: ProvisionId): ActionResult {
  if (state.debt > 0) return { ok: false, message: 'Сначала погасите обязательства.' }
  const def = PROVISIONS.find((item) => item.id === id)!
  if (!spend(state, def.price)) return { ok: false, message: 'Недостаточно денег.' }
  state.provisions[id] += 1
  return { ok: true, message: `${def.name}: комплектов ${state.provisions[id]}.` }
}

export function startResearch(state: GameState, id: string): ActionResult {
  const tech = techById(id)
  if (state.debt > 0) return { ok: false, message: 'Сначала погасите обязательства.' }
  if (isResearched(state, id)) return { ok: false, message: 'Технология уже изучена.' }
  if (state.research[id]?.status === 'researching') return { ok: false, message: 'Исследование уже идёт.' }
  if (Object.values(state.research).some((item) => item.status === 'researching')) return { ok: false, message: 'Одновременно доступно одно исследование.' }
  if (tech.requires && !isResearched(state, tech.requires)) return { ok: false, message: `Требуется: ${techById(tech.requires).name}.` }
  if (state.money < tech.requiresMoney) return { ok: false, message: `Требуется капитал ${tech.requiresMoney.toLocaleString('ru-RU')} ₽.` }
  if (!spend(state, tech.cost)) return { ok: false, message: 'Недостаточно денег.' }
  state.research[id] = { status: 'researching', progress: 0 }
  addLog(state, `Начато исследование «${tech.name}», ${tech.days} дн.`, 'money')
  return { ok: true, message: 'Исследование начато.' }
}

export function setSpeed(state: GameState, speed: Speed): void {
  state.speed = speed
  state.paused = false
}

export function togglePause(state: GameState): void {
  state.paused = !state.paused
}

export function acknowledgeGoal(state: GameState): void {
  state.goalAcknowledged = true
}

export function quickStartHint(state: GameState): string {
  if (state.projects.length === 0) return 'Выберите реконструкцию на доске заказов'
  if (state.crews.every((crew) => crew.workers.length === 0)) return 'Наймите хотя бы двух работников'
  if (!state.equipment.some((asset) => asset.id === 'mixer' || asset.id === 'tractor')) return 'Купите или арендуйте бетономешалку'
  if (state.projects.length > PROVISIONS.reduce((min, item) => Math.min(min, state.provisions[item.id]), Number.POSITIVE_INFINITY)) return 'Купите комплект обеспечения для каждого объекта'
  return 'Зарезервируйте материалы и запустите стройку'
}

export function estimateDailyPayroll(state: GameState): number {
  return state.crews.reduce((sum, crew) => sum + crewHourly(crew.workers) * 10, 0)
}

export function materialMarketValue(state: GameState): number {
  return MATERIALS.reduce((sum, material) => sum + inventoryQty(state, material.id) * frontPrice(state, material.id), 0)
}

export function canAllocateCurrent(_state: GameState, project: Project): boolean {
  return !hasStageMaterials(project, project.currentStage) && Object.keys(buildingById(project.job.building).stages[project.currentStage].materials).length > 0
}
