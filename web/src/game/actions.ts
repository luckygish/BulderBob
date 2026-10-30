import { BALANCE } from './balance'
import { MATERIALS, PROVISIONS, buildingById, materialById, techById } from './catalog'
import { addLog, addProjectInventory, allocateStage, autoAssignResources, crewHourly, formatMissing, frontPrice, hasStageMaterials, inventoryQty, isDebtBlocked, isResearched, makeStages, MATERIAL_EPSILON, maxCrews, maxCrewSize, maxProjects, netWorth, projectLogisticsRate, projectReservedQty, purchaseMaterial, quoteMaterial, requiredCrews, requiredMaterials, spend, stageMissingMaterials, startStage, stockQty, takeFromInventory } from './engine'
import { nextId } from './rng'
import { seasonLogisticsRate, seasonProvisionRate } from './seasons'
import type { ActionResult, GameState, MaterialId, Project, ProvisionId, Speed, SupplierId } from './types'

export function takeJob(state: GameState, jobId: string): ActionResult {
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  if (state.projects.length >= maxProjects(state)) return { ok: false, message: `Active project limit: ${maxProjects(state)}.` }
  const job = state.jobs.find((item) => item.id === jobId)
  if (!job) return { ok: false, message: 'Order is no longer available.' }
  const def = buildingById(job.building)
  if (job.special && state.reputation < def.minReputation) return { ok: false, message: `Special projects require ${def.minReputation} reputation.` }
  if (def.minSiteWorkers !== undefined && maxCrewSize(state) * maxCrews(state) < def.minSiteWorkers) {
    return { ok: false, message: `This contract needs ${def.minSiteWorkers} workers on site — research Build squad first (crews up to ${BALANCE.maxCrewSizeSquad}).` }
  }
  state.jobs = state.jobs.filter((item) => item.id !== jobId)
  const project: Project = {
    id: nextId(state, 'project'), job, stages: makeStages(job.building), currentStage: 0,
    crewIds: [], equipmentAssetId: null, reserved: {}, autoAdvance: false, started: false,
    materialCost: 0, laborCost: 0, laborPaid: 0, logisticsCost: 0, equipmentCost: 0, rentCost: 0,
    factoringFee: 0, advance: 0, penalty: 0, totalHours: 0, completedDay: null, profit: 0,
  }
  if (isResearched(state, 'factoring')) {
    project.advance = Math.round(job.budget * BALANCE.factoringAdvance)
    project.factoringFee = Math.round(job.budget * BALANCE.factoringFee)
    state.money += project.advance - project.factoringFee
  }
  state.projects.push(project)
  autoAssignResources(state, project)
  addLog(state, `Took contract "${buildingById(job.building).name}" for ${job.client}.`, 'success')
  return { ok: true, message: 'Project created. Check crew, equipment and provisions.' }
}

export function hireWorker(state: GameState, workerId: string, crewId: number): ActionResult {
  if (crewId < 0 || crewId >= maxCrews(state)) return { ok: false, message: 'This crew is not unlocked yet.' }
  const size = maxCrewSize(state)
  if (state.crews[crewId].workers.length >= size) return { ok: false, message: `The crew already has ${size} people.` }
  const worker = state.candidates.find((item) => item.id === workerId)
  if (!worker) return { ok: false, message: 'Candidate already hired by another company.' }
  state.candidates = state.candidates.filter((item) => item.id !== workerId)
  state.crews[crewId].workers.push(worker)
  return { ok: true, message: `${worker.name} added to crew #${crewId + 1}.` }
}

export function fireWorker(state: GameState, workerId: string, crewId: number): ActionResult {
  const crew = state.crews[crewId]
  const worker = crew?.workers.find((item) => item.id === workerId)
  if (!worker) return { ok: false, message: 'Worker not found.' }
  crew.workers = crew.workers.filter((item) => item.id !== workerId)
  state.candidates.push(worker)
  return { ok: true, message: `${worker.name} returned to the candidate pool.` }
}

export function assignCrew(state: GameState, projectId: string, crewId: number, slot = 0): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  if (crewId >= maxCrews(state)) return { ok: false, message: 'Crew unavailable.' }
  project.removedCrews ??= []
  if (crewId >= 0) {
    project.removedCrews = project.removedCrews.filter((id) => id !== crewId)
    for (const other of state.projects) {
      if (other.id !== project.id) other.crewIds = other.crewIds.filter((id) => id !== crewId)
    }
    project.crewIds = project.crewIds.filter((id, index) => id !== crewId && index !== slot)
    project.crewIds[slot] = crewId
  } else {
    const removed = project.crewIds[slot]
    project.crewIds.splice(slot, 1)
    if (removed !== undefined && removed >= 0 && !project.removedCrews.includes(removed)) project.removedCrews.push(removed)
  }
  project.crewIds = [...new Set(project.crewIds.filter((id) => id >= 0))].slice(0, requiredCrews(project))
  return { ok: true, message: crewId < 0 ? 'Crew removed from project.' : `Crew #${crewId + 1} assigned.` }
}

export function allocateProjectStage(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  const ready = allocateStage(state, project, project.currentStage)
  if (ready) return { ok: true, message: 'Stage fully supplied.' }
  return { ok: false, message: `Not enough for the stage: ${formatMissing(stageMissingMaterials(project, project.currentStage))}.` }
}

export function startFullProject(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  if (project.started) return { ok: false, message: 'Construction already started.' }
  const missing = missingForProject(state, project)
  if (Object.keys(missing).length > 0) {
    const stages = missingByStage(state, project)
    return {
      ok: false,
      message: `Missing materials to start all stages:\n${stages.map((stage) => `Stage ${stage.index + 1} "${stage.name}": ${formatMissing(stage.items)}`).join('\n')}`,
    }
  }
  project.stages.forEach((_, index) => allocateStage(state, project, index))
  project.autoAdvance = true
  return startStage(state, project)
}

export function startCurrentStage(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  return startStage(state, project)
}

export function missingForProject(state: GameState, project: Project): Partial<Record<MaterialId, number>> {
  const required = requiredMaterials(project)
  const missing: Partial<Record<MaterialId, number>> = {}
  for (const [material, total] of Object.entries(required) as [MaterialId, number][]) {
    const allocated = project.stages.reduce((sum, stage) => sum + (stage.stock[material]?.qty ?? 0), 0)
    const reserved = projectReservedQty(project, material)
    const need = Math.max(0, total - allocated - reserved - inventoryQty(state, material))
    if (need > MATERIAL_EPSILON) missing[material] = need
  }
  return missing
}

function missingByStage(state: GameState, project: Project): { index: number; name: string; items: [MaterialId, number][] }[] {
  const budget: Partial<Record<MaterialId, number>> = { ...missingForProject(state, project) }
  const result: { index: number; name: string; items: [MaterialId, number][] }[] = []
  const def = buildingById(project.job.building)
  for (const [index, stageDef] of def.stages.entries()) {
    if (project.stages[index].status === 'completed') continue
    const items: [MaterialId, number][] = []
    for (const [material, required] of Object.entries(stageDef.materials) as [MaterialId, number][]) {
      const staged = project.stages[index].stock[material]?.qty ?? 0
      const raw = Math.max(0, required - staged)
      const take = Math.min(raw, budget[material] ?? 0)
      if (take > 0) { items.push([material, take]); budget[material] = Math.max(0, (budget[material] ?? 0) - take) }
    }
    if (items.length) result.push({ index, name: stageDef.name, items })
  }
  return result
}

export function buyMissingForProject(state: GameState, projectId: string, supplier: SupplierId): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  const missing = missingForProject(state, project)
  const entries = Object.entries(missing) as [MaterialId, number][]
  if (entries.length === 0) return { ok: false, message: 'All materials are already in stock.' }
  const feeMultiplier = 1 + projectLogisticsRate(state, project) + seasonLogisticsRate(state)
  let total = 0
  for (const [material, qty] of entries) {
    const stock = stockQty(state, material, supplier)
    if (stock < qty) {
      const def = materialById(material)
      return { ok: false, message: `Not enough at the yard: need ${qty.toLocaleString('en-US')} ${def.unit} ${def.name}, only ${stock.toLocaleString('en-US')} ${def.unit} in stock.` }
    }
    const quote = quoteMaterial(state, material, qty, supplier)
    total += quote.cost + Math.round(quote.fee * feeMultiplier)
  }
  if (state.money < total) return { ok: false, message: `Needs $${total.toLocaleString('en-US')} including delivery.` }
  let fees = 0
  for (const [material, qty] of entries) {
    fees += Math.round(quoteMaterial(state, material, qty, supplier).fee * feeMultiplier)
    purchaseMaterial(state, material, qty, supplier, project.id, feeMultiplier)
  }
  project.logisticsCost += fees
  return { ok: true, message: `Purchase of $${total.toLocaleString('en-US')} completed; delivery is on its way to the project.` }
}

export function restockProjectFromWarehouse(state: GameState, projectId: string): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  const missing = missingForProject(state, project)
  const entries = Object.entries(missing) as [MaterialId, number][]
  if (entries.length === 0) return { ok: false, message: 'All materials are already in stock.' }
  const taken: string[] = []
  for (const [material, need] of entries) {
    const take = Math.min(need, inventoryQty(state, material))
    if (take <= 0) continue
    const { cost } = takeFromInventory(state, material, take)
    addProjectInventory(project, material, take, Math.round(cost / take))
    taken.push(`${materialById(material).name} ${take} ${materialById(material).unit}`)
  }
  if (taken.length === 0) return { ok: false, message: 'No missing materials in the warehouse (buy at the yard).' }
  addLog(state, `Restocked from warehouse: ${taken.join(', ')}.`, 'money')
  return { ok: true, message: `Moved from the warehouse to project reserve: ${taken.join(', ')}.` }
}

export function restockMaterialFromWarehouse(state: GameState, projectId: string, material: MaterialId, qty: number): ActionResult {
  const project = state.projects.find((item) => item.id === projectId)
  if (!project) return { ok: false, message: 'Project not found.' }
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, message: 'Enter a whole number greater than zero.' }
  const need = missingForProject(state, project)[material] ?? 0
  if (need <= 0) return { ok: false, message: 'This material is not needed for the project.' }
  const take = Math.min(qty, need, inventoryQty(state, material))
  if (take <= 0) return { ok: false, message: `No ${materialById(material).name.toLowerCase()} in the warehouse.` }
  const { cost } = takeFromInventory(state, material, take)
  addProjectInventory(project, material, take, Math.round(cost / take))
  addLog(state, `Restocked from warehouse: ${materialById(material).name}, ${take} ${materialById(material).unit}.`, 'money')
  return { ok: true, message: `Moved to project reserve: ${materialById(material).name}, ${take} ${materialById(material).unit}.` }
}

export function buyProvision(state: GameState, id: ProvisionId): ActionResult {
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  const def = PROVISIONS.find((item) => item.id === id)!
  const price = Math.round(def.price * (1 + seasonProvisionRate(state)))
  if (!spend(state, price)) return { ok: false, message: 'Not enough money.' }
  state.provisions[id] += 1
  return { ok: true, message: `${def.name}: ${state.provisions[id]} sets.` }
}

export function startResearch(state: GameState, id: string): ActionResult {
  const tech = techById(id)
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  if (isResearched(state, id)) return { ok: false, message: 'Technology already researched.' }
  if (state.research[id]?.status === 'researching') return { ok: false, message: 'Research is already in progress.' }
  if (Object.values(state.research).some((item) => item.status === 'researching')) return { ok: false, message: 'Only one research at a time.' }
  if (tech.requires && !isResearched(state, tech.requires)) return { ok: false, message: `Requires: ${techById(tech.requires).name}.` }
  if (tech.requiresReputation && state.reputation < tech.requiresReputation) return { ok: false, message: `Requires ${tech.requiresReputation} reputation.` }
  if (tech.requiresCapital && netWorth(state) < tech.requiresCapital) return { ok: false, message: `Requires capital of $${tech.requiresCapital.toLocaleString('en-US')}.` }
  if (state.money < tech.requiresMoney) return { ok: false, message: `Requires capital of $${tech.requiresMoney.toLocaleString('en-US')}.` }
  if (!spend(state, tech.cost)) return { ok: false, message: 'Not enough money.' }
  state.research[id] = { status: 'researching', progress: 0 }
  addLog(state, `Research started: "${tech.name}", ${tech.days} days.`, 'money')
  return { ok: true, message: 'Research started.' }
}

export function setSpeed(state: GameState, speed: Speed): void {
  state.speed = speed
  state.paused = false
}

export function togglePause(state: GameState): void {
  state.paused = !state.paused
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