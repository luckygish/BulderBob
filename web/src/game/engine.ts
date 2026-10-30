import { BALANCE, LOAN_OPTIONS } from './balance'
import { BUILDINGS, CLIENTS, MATERIALS, PROVISIONS, SKILLS, SUPPLIERS, WORKER_NAMES, WORKER_TYPES, buildingById, equipmentById, materialById, techById } from './catalog'
import { EVENTS } from './events'
import { nextId, pick, random, randomInt } from './rng'
import { currentSeason, seasonFoundationManHours, seasonMaintenanceRate, seasonMaterialPriceRate, seasonNightEfficiencyRate, seasonNightWageMultiplier, seasonWageRate, workDayEnd, workdayHours } from './seasons'
import type { ActionResult, Bot, BotProject, EquipmentAsset, EquipmentId, GameState, InventoryBatch, Job, Loan, MaterialId, Project, Quote, SkillId, StageState, SupplierId, Worker, WorkerType } from './types'

export function createNewGame(seed = Date.now()): GameState {
  const inventory = Object.fromEntries(MATERIALS.map((m) => [m.id, []])) as unknown as GameState['inventory']
  const priceHistory = Object.fromEntries(MATERIALS.map((m) => [m.id, Array(12).fill(m.basePrice)])) as GameState['priceHistory']
  const state: GameState = {
    version: BALANCE.version, rngSeed: seed >>> 0, nextId: 0,
    money: BALANCE.startMoney, debt: 0, reputation: BALANCE.startReputation,
    day: 1, hour: BALANCE.workDayStart, speed: 1, paused: false,
    jobs: [], projects: [], completed: [], candidates: [], crews: [{ workers: [] }, { workers: [] }],
    inventory,
    suppliers: {
      north: Object.fromEntries(MATERIALS.map((m) => [m.id, []])) as Record<MaterialId, never[]>,
      south: Object.fromEntries(MATERIALS.map((m) => [m.id, []])) as Record<MaterialId, never[]>,
    } as unknown as GameState['suppliers'],
    demand: {
      north: Object.fromEntries(MATERIALS.map((m) => [m.id, 0])) as Record<MaterialId, number>,
      south: Object.fromEntries(MATERIALS.map((m) => [m.id, 0])) as Record<MaterialId, number>,
    },
    priceHistory, deliveries: [], equipment: [],
    provisions: Object.fromEntries(PROVISIONS.map((p) => [p.id, 0])) as GameState['provisions'],
    research: {}, loan: null, bots: [], journal: [], totalRevenue: 0,
    seasonIndex: 0, seasonCompleted: 0, seasonRevenue: 0, completedTutorial: [], equipmentSold: 0, usedSuppliers: [], seasonNotice: null,
    companyName: 'Your company', companyAvatar: 0, financeHistory: [], event: null, eventsFired: [], seasonPriceBonus: 0, seasonDeadlineBonus: 0, seasonWageBonus: 0, corpFinalChoice: null,
  }
  for (const supplier of ['north', 'south'] as SupplierId[]) {
    for (const material of MATERIALS) {
      const qty = Math.round(material.stockMax * SUPPLIERS[supplier].initialStock)
      state.suppliers[supplier][material.id] = [{ qty, initialQty: qty, price: Math.round(material.basePrice * SUPPLIERS[supplier].initialPrice), arrivedDay: 0 }]
    }
  }
  generateWorkers(state, BALANCE.minCandidates)
  state.jobs.push(createJob(state, 'reconstruction'))
  state.jobs.push(createJob(state))
  state.jobs.push(createJob(state))
  state.bots = [
    createBot(state, 'BuildCity', 'aggressive'),
    createBot(state, 'HomeMaster', 'moderate'),
    createBot(state, 'AtlasBuild', 'conservative'),
  ]
  const initialCandidates = BALANCE.minCandidates + state.bots.reduce((sum, bot) => sum + bot.crewTarget, 0)
  if (state.candidates.length < initialCandidates) generateWorkers(state, initialCandidates - state.candidates.length)
  recordFinanceSnapshot(state)
  addLog(state, 'Company opened. The first order is already waiting on the board.', 'success')
  return state
}

function createBot(state: GameState, name: string, strategy: Bot['strategy']): Bot {
  return { id: nextId(state, 'bot'), name, strategy, money: 2_000_000, totalProfit: 0, jobsDone: 0, state: 'idle', cooldown: 0, crew: [], crewTarget: BALANCE.botCrewSeason0, projects: [], loan: null }
}

function createCorpBot(state: GameState): Bot {
  return { id: nextId(state, 'bot'), name: BALANCE.corpName, strategy: 'aggressive', money: BALANCE.corpMoney, totalProfit: 0, jobsDone: 0, state: 'idle', cooldown: 0, crew: [], crewTarget: BALANCE.corpCrewTarget, projects: [], loan: null, corporation: true, projectLimit: BALANCE.corpProjectLimit }
}

export function ensureCorpBot(state: GameState): void {
  if (state.seasonIndex < BALANCE.corpSeason || state.bots.some((bot) => bot.corporation)) return
  state.bots.push(createCorpBot(state))
  addLog(state, `Corporation ${BALANCE.corpName} enters the market.`, 'warning')
}

export function makeStages(building: Job['building']): StageState[] {
  return buildingById(building).stages.map(() => ({ status: 'not_started', progress: 0, stock: {} }))
}

export function createJob(state: GameState, forcedBuilding?: Job['building']): Job {
  const available = forcedBuilding
    ? [buildingById(forcedBuilding)]
    : BUILDINGS.filter((b) => !b.special && b.minReputation <= state.reputation && (!b.requiredLicense || isLicenseUnlocked(state, b.requiredLicense)))
  const def = pick(state, available)
  const manHours = def.stages.reduce((sum, stage) => sum + stage.manHours, 0)
  const raw = 4 + Math.ceil(manHours / 35) + randomInt(state, 0, def.special ? 5 : 3)
  const duration = Math.round(raw * (1 + (state.seasonDeadlineBonus ?? 0))) + (isResearched(state, 'project_coordination') ? 2 : 0)
  const deadline = state.day + duration
  return {
    id: nextId(state, 'job'), client: pick(state, CLIENTS), building: def.id,
    budget: randomInt(state, def.budgetMin, def.budgetMax),
    deadline, createdDay: state.day, special: Boolean(def.special),
    expiresDay: def.special ? state.day + randomInt(state, 2, 5) : deadline,
  }
}

function skillsCompatible(current: SkillId[], candidate: SkillId): boolean {
  const groups: SkillId[][] = [
    ['alcohol', 'tudyaga', 'sluggish'],
    ['thief', 'thrifty'],
  ]
  return groups.every((group) => !group.includes(candidate) || !current.some((skill) => group.includes(skill)))
}

const OWL_WEIGHT = 0.5

function pickSkill(state: GameState, available: SkillId[]): SkillId {
  const total = available.reduce((sum, id) => sum + (id === 'owl' ? OWL_WEIGHT : 1), 0)
  let roll = random(state) * total
  for (const id of available) {
    roll -= id === 'owl' ? OWL_WEIGHT : 1
    if (roll <= 0) return id
  }
  return available[available.length - 1]
}

export function generateWorkers(state: GameState, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const roll = random(state)
    const type: WorkerType = roll < 0.5 ? 'handyman' : roll < 0.85 ? 'specialist' : 'foreman'
    const def = WORKER_TYPES[type]
    const availableSkills = (Object.keys(SKILLS) as SkillId[]).filter((id) => type !== 'foreman' || !SKILLS[id].negative)
    const skills: SkillId[] = []
    const skillCount = randomInt(state, 1, 2)
    let attempts = 0
    while (skills.length < skillCount && attempts < 20) {
      attempts += 1
      const skill = pickSkill(state, availableSkills)
      if (!skills.includes(skill) && skillsCompatible(skills, skill)) skills.push(skill)
    }
    state.candidates.push({
      id: nextId(state, 'worker'), name: pick(state, WORKER_NAMES), type,
      rate: randomInt(state, def.rateMin, def.rateMax), skills,
    })
  }
}

export function addLog(state: GameState, text: string, kind: GameState['journal'][number]['kind'] = 'info'): void {
  state.journal.push({ id: nextId(state, 'event'), day: state.day, hour: state.hour, kind, text })
  if (state.journal.length > BALANCE.journalLimit) state.journal.splice(0, state.journal.length - BALANCE.journalLimit)
}

export function recordFinanceSnapshot(state: GameState): void {
  state.financeHistory.push({ day: state.day, capital: netWorth(state), cash: state.money, reputation: state.reputation, seasonCompleted: state.seasonCompleted })
  if (state.financeHistory.length > 120) state.financeHistory.splice(0, state.financeHistory.length - 120)
}

export function isResearched(state: GameState, id: string): boolean {
  return state.research[id]?.status === 'done'
}

export function isLicenseUnlocked(state: GameState, license: 'city' | 'region'): boolean {
  return isResearched(state, license === 'city' ? 'city_license' : 'region_license')
}

export function maxProjects(state: GameState): number {
  return isResearched(state, 'planning_1') ? 2 : 1
}

export function maxCrews(state: GameState): number {
  return isResearched(state, 'prof_standards') ? 2 : 1
}

export function workerBonus(state: GameState): number {
  const base = isResearched(state, 'prof_standards') ? 0.45 : isResearched(state, 'worker_training') ? 0.25 : 0
  return base + (isResearched(state, 'manpower_reserve') ? 0.15 : 0)
}

export function crewEfficiency(workers: Worker[], bonus = 0): number {
  let total = 0
  let teamBonus = 0
  for (const worker of workers) {
    const speed = Math.max(0.1, 1 + worker.skills.reduce((sum, skill) => sum + SKILLS[skill].speed, 0))
    total += (WORKER_TYPES[worker.type].efficiency + bonus) * speed
    teamBonus += (WORKER_TYPES[worker.type].teamBonus + worker.skills.reduce((sum, skill) => sum + SKILLS[skill].teamBonus, 0)) * Math.max(0, workers.length - 1)
  }
  return total + teamBonus
}

export function crewHourly(workers: Worker[]): number {
  return workers.reduce((sum, worker) => sum + Math.round(worker.rate * (1 + worker.skills.reduce((rate, skill) => rate + SKILLS[skill].wageRate, 0))), 0)
}

export function projectWorkers(state: GameState, project: Project): Worker[] {
  return project.crewIds.flatMap((crewId) => state.crews[crewId]?.workers ?? [])
}

function crewMaterialRate(workers: Worker[]): number {
  return workers.reduce((sum, worker) => sum + worker.skills.reduce((rate, skill) => rate + SKILLS[skill].materialRate, 0), 0)
}

export function projectLogisticsRate(state: GameState, project: Project): number {
  return Math.max(-0.1, projectWorkers(state, project).reduce((sum, worker) => sum + worker.skills.reduce((rate, skill) => rate + SKILLS[skill].logisticsRate, 0), 0))
}

function projectEquipmentSkillRate(state: GameState, project: Project): number {
  return projectWorkers(state, project).reduce((sum, worker) => sum + worker.skills.reduce((rate, skill) => rate + SKILLS[skill].equipmentBonusRate, 0), 0)
}

export function inventoryQty(state: GameState, material: MaterialId): number {
  return state.inventory[material].reduce((sum, batch) => sum + batch.qty, 0)
}

export function projectReservedQty(project: Project, material: MaterialId): number {
  return (project.reserved[material] ?? []).reduce((sum, batch) => sum + batch.qty, 0)
}

export function stockQty(state: GameState, material: MaterialId, supplier: SupplierId): number {
  return state.suppliers[supplier][material].reduce((sum, lot) => sum + lot.qty, 0)
}

export function frontPrice(state: GameState, material: MaterialId, supplier: SupplierId = 'north'): number {
  return state.suppliers[supplier][material][0]?.price ?? materialById(material).basePrice
}

export function quoteMaterial(state: GameState, material: MaterialId, quantity: number, supplier: SupplierId): Quote {
  const available = stockQty(state, material, supplier)
  let remaining = Math.min(Math.max(0, Math.floor(quantity)), available)
  const qty = remaining
  let cost = 0
  for (const lot of state.suppliers[supplier][material]) {
    const take = Math.min(remaining, lot.qty)
    cost += take * lot.price
    remaining -= take
    if (remaining <= 0) break
  }
  const seasonalCost = Math.round(cost * (1 + seasonMaterialPriceRate(state)))
  const fee = Math.round(seasonalCost * SUPPLIERS[supplier].feeRate)
  return { qty, cost: seasonalCost, fee, total: seasonalCost + fee, arriveDay: state.day + SUPPLIERS[supplier].deliveryDays, available }
}

function deductLots(state: GameState, material: MaterialId, supplier: SupplierId, quantity: number): void {
  let remaining = quantity
  for (const lot of state.suppliers[supplier][material]) {
    const take = Math.min(remaining, lot.qty)
    lot.qty -= take
    remaining -= take
    if (remaining <= 0) break
  }
  state.suppliers[supplier][material] = state.suppliers[supplier][material].filter((lot) => lot.qty > 0)
}

function addBatches(batches: InventoryBatch[], qty: number, unitCost: number): void {
  const last = batches.at(-1)
  if (last?.unitCost === unitCost) last.qty += qty
  else batches.push({ qty, unitCost })
}

function addInventory(state: GameState, material: MaterialId, qty: number, unitCost: number): void {
  addBatches(state.inventory[material], qty, unitCost)
}

export function addProjectInventory(project: Project, material: MaterialId, qty: number, unitCost: number): void {
  project.reserved[material] ??= []
  addBatches(project.reserved[material]!, qty, unitCost)
}

export function warehouseSpace(state: GameState, material: MaterialId): number {
  return Math.max(0, BALANCE.warehouseCap - inventoryQty(state, material))
}

export function storeWarehouseCapped(state: GameState, material: MaterialId, qty: number, unitCost: number): { stored: number; sold: number } {
  const stored = Math.min(qty, warehouseSpace(state, material))
  const sold = qty - stored
  if (stored > 0) addInventory(state, material, stored, unitCost)
  if (sold > 0) {
    const income = Math.round(sold * unitCost * BALANCE.warehouseSaleRate)
    state.money += income
    addLog(state, `Warehouse overflow sold at ${Math.round(BALANCE.warehouseSaleRate * 100)}% of cost: ${materialById(material).name}, ${sold} ${materialById(material).unit} for $${income.toLocaleString('en-US')}.`, 'warning')
  }
  return { stored, sold }
}

export function warehouseCost(state: GameState): number {
  let total = 0
  for (const batches of Object.values(state.inventory)) for (const batch of batches) total += batch.qty * batch.unitCost
  return total
}

export function warehouseStorageRate(state: GameState): number {
  const totalUnits = MATERIALS.reduce((sum, material) => sum + inventoryQty(state, material.id), 0)
  if (totalUnits <= 0) return 0
  return totalUnits <= BALANCE.storageFeeTier1 ? BALANCE.storageFeeRateMaxQty : BALANCE.storageFeeRateOver
}

export function warehouseStorageFee(state: GameState): number {
  return Math.round(warehouseCost(state) * warehouseStorageRate(state))
}

export function overdraftLimit(state: GameState): number {
  return state.research.overdraft?.status === 'done' ? 400_000 : 0
}

export function isDebtBlocked(state: GameState): boolean {
  return state.debt > overdraftLimit(state)
}

export function spend(state: GameState, amount: number): boolean {
  if (amount < 0 || isDebtBlocked(state)) return false
  if (state.money - amount < -overdraftLimit(state)) return false
  state.money -= amount
  return true
}

export function chargeObligation(state: GameState, amount: number, label: string): void {
  const rounded = Math.max(0, Math.round(amount))
  const paid = Math.max(0, Math.min(state.money, rounded))
  state.money -= paid
  const unpaid = rounded - paid
  if (unpaid > 0) {
    state.debt += unpaid
    if (isDebtBlocked(state)) addLog(state, `${label}: $${unpaid.toLocaleString('en-US')} short — work halted until the debt is repaid.`, 'warning')
    else addLog(state, `${label}: $${unpaid.toLocaleString('en-US')} covered by overdraft.`, 'warning')
  }
}

export function purchaseMaterial(state: GameState, material: MaterialId, quantity: number, supplier: SupplierId, projectId?: string, feeMultiplier = 1): ActionResult {
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  const quote = quoteMaterial(state, material, quantity, supplier)
  const actualFee = Math.round(quote.fee * feeMultiplier)
  if (quantity <= 0 || quote.qty !== quantity) return { ok: false, message: 'Not enough material at the yard.' }
  const project = projectId ? state.projects.find((item) => item.id === projectId) : undefined
  if (!project && quantity > warehouseSpace(state, material)) return { ok: false, message: `Warehouse doesn't fit ${quantity} units of "${materialById(material).name}" (cap ${BALANCE.warehouseCap}).` }
  if (!spend(state, quote.cost + actualFee)) return { ok: false, message: 'Not enough money for purchase and delivery.' }
  const stockBefore = quote.available
  deductLots(state, material, supplier, quantity)
  const share = stockBefore > 0 ? quantity / stockBefore : 0
  const bump = Math.max(0, share - 0.25)
  if (bump > 0) {
    const base = materialById(material).basePrice
    const cap = Math.round(base * BALANCE.priceCap)
    for (const lot of state.suppliers[supplier][material]) lot.price = Math.min(cap, Math.round(lot.price * (1 + BALANCE.priceSensitivity * bump)))
    if (supplier === 'north') {
      state.priceHistory[material].push(frontPrice(state, material, supplier))
      if (state.priceHistory[material].length > 30) state.priceHistory[material].shift()
    }
  }
  state.demand[supplier][material] += quantity
  if (!state.usedSuppliers.includes(supplier)) state.usedSuppliers.push(supplier)
  const unitCost = Math.round(quote.cost / quantity)
  if (quote.arriveDay <= state.day) {
    if (project) addProjectInventory(project, material, quantity, unitCost)
    else storeWarehouseCapped(state, material, quantity, unitCost)
  } else {
    state.deliveries.push({ id: nextId(state, 'delivery'), supplier, arriveDay: quote.arriveDay, items: [{ material, qty: quantity, unitCost }], fee: actualFee, projectId: project?.id })
  }
  addLog(state, `Bought: ${materialById(material).name}, ${quantity} ${materialById(material).unit} · $${(quote.cost + actualFee).toLocaleString('en-US')}.`, 'money')
  return { ok: true, message: quote.arriveDay === state.day ? (project ? 'Materials reserved for the project.' : 'Materials are already in the warehouse.') : `Delivery arrives on day ${quote.arriveDay}.` }
}

export function takeFromInventory(state: GameState, material: MaterialId, quantity: number): { qty: number; cost: number } {
  let remaining = quantity
  let cost = 0
  for (const batch of state.inventory[material]) {
    const take = Math.min(remaining, batch.qty)
    batch.qty -= take
    cost += take * batch.unitCost
    remaining -= take
    if (remaining <= 0) break
  }
  state.inventory[material] = state.inventory[material].filter((batch) => batch.qty > 0)
  return { qty: quantity - remaining, cost }
}

function takeFromProjectInventory(project: Project, material: MaterialId, quantity: number): { qty: number; cost: number } {
  const batches = project.reserved[material] ?? []
  let remaining = quantity
  let cost = 0
  for (const batch of batches) {
    const take = Math.min(remaining, batch.qty)
    batch.qty -= take
    cost += take * batch.unitCost
    remaining -= take
    if (remaining <= 0) break
  }
  project.reserved[material] = batches.filter((batch) => batch.qty > 0)
  return { qty: quantity - remaining, cost }
}

export function requiredMaterials(project: Project): Partial<Record<MaterialId, number>> {
  const required: Partial<Record<MaterialId, number>> = {}
  for (const [index, stage] of buildingById(project.job.building).stages.entries()) {
    if (project.stages[index].status === 'completed') continue
    for (const [material, qty] of Object.entries(stage.materials) as [MaterialId, number][]) required[material] = (required[material] ?? 0) + qty
  }
  return required
}

export function allocateStage(state: GameState, project: Project, stageIndex: number): boolean {
  const def = buildingById(project.job.building).stages[stageIndex]
  const stage = project.stages[stageIndex]
  if (!def || !stage || stage.status === 'completed' || stage.status === 'in_progress') return false
  const materialRate = crewMaterialRate(projectWorkers(state, project))
  for (const [material, required] of Object.entries(def.materials) as [MaterialId, number][]) {
    const have = stage.stock[material]?.qty ?? 0
    const need = Math.max(0, required - have)
    const fromProject = takeFromProjectInventory(project, material, need)
    const fromInventory = takeFromInventory(state, material, need - fromProject.qty)
    const takenQty = fromProject.qty + fromInventory.qty
    if (takenQty > 0) {
      stage.stock[material] = { qty: have + takenQty, unitCost: 0 }
      project.materialCost += Math.round((fromProject.cost + fromInventory.cost) * Math.max(0.85, 1 + materialRate))
    }
  }
  stage.status = hasStageMaterials(project, stageIndex) ? 'ready' : 'not_started'
  return stage.status === 'ready'
}

export function hasStageMaterials(project: Project, stageIndex: number): boolean {
  const def = buildingById(project.job.building).stages[stageIndex]
  return (Object.entries(def.materials) as [MaterialId, number][]).every(([material, qty]) => (project.stages[stageIndex].stock[material]?.qty ?? 0) >= qty)
}

export function stageMissingMaterials(project: Project, stageIndex: number): [MaterialId, number][] {
  const def = buildingById(project.job.building).stages[stageIndex]
  const stage = project.stages[stageIndex]
  return (Object.entries(def.materials) as [MaterialId, number][])
    .map(([material, required]) => [material, Math.max(0, required - (stage.stock[material]?.qty ?? 0))] as [MaterialId, number])
    .filter(([, qty]) => qty > 0)
}

export function formatMissing(missing: [MaterialId, number][]): string {
  return missing.map(([material, qty]) => `${materialById(material).name} ${qty.toLocaleString('en-US')} ${materialById(material).unit}`).join(', ')
}

export function missingProvisions(state: GameState): Partial<Record<string, number>> {
  const missing: Partial<Record<string, number>> = {}
  for (const item of PROVISIONS) {
    const need = Math.max(0, state.projects.length - state.provisions[item.id])
    if (need > 0) missing[item.id] = need
  }
  return missing
}

export function hasProvisions(state: GameState): boolean {
  return Object.keys(missingProvisions(state)).length === 0
}

export function requiredCrews(project: Project): number {
  return buildingById(project.job.building).requiredCrews ?? 1
}

export function projectCrewsReady(state: GameState, project: Project): boolean {
  const required = requiredCrews(project)
  const assigned = [...new Set(project.crewIds)].filter((crewId) => crewId >= 0 && crewId < maxCrews(state) && state.crews[crewId].workers.length > 0)
  return assigned.length >= required
}

export function projectEquipmentReady(state: GameState, project: Project): boolean {
  const stageDef = buildingById(project.job.building).stages[project.currentStage]
  if (!stageDef?.requiredEquipment?.length) return true
  const asset = state.equipment.find((item) => item.assetId === project.equipmentAssetId)
  return Boolean(asset && stageDef.requiredEquipment.includes(asset.id))
}

export function projectEquipmentBonus(state: GameState, project: Project): number {
  const stageDef = buildingById(project.job.building).stages[project.currentStage]
  const asset = state.equipment.find((item) => item.assetId === project.equipmentAssetId)
  const base = asset ? stageDef?.equipmentBonus?.[asset.id] ?? 0 : 0
  return base * (1 + projectEquipmentSkillRate(state, project))
}

export function startStage(state: GameState, project: Project): ActionResult {
  if (isDebtBlocked(state)) return { ok: false, message: 'Construction halted: repay your obligations.' }
  if (project.currentStage >= project.stages.length) return { ok: false, message: 'All stages are complete.' }
  if (project.stages[project.currentStage].status === 'in_progress') return { ok: false, message: 'Stage is already under construction.' }
  if (!projectCrewsReady(state, project)) return { ok: false, message: requiredCrews(project) > 1 ? 'Assign two non-empty crews.' : 'Assign a non-empty crew.' }
  if (!projectEquipmentReady(state, project)) {
    const stage = buildingById(project.job.building).stages[project.currentStage]
    return { ok: false, message: `Assign equipment: ${stage.requiredEquipment?.map((id) => equipmentById(id).name).join(' or ')}.` }
  }
  if (!hasProvisions(state)) return { ok: false, message: 'Buy a separate provisions set for each active project.' }
  allocateStage(state, project, project.currentStage)
  if (!hasStageMaterials(project, project.currentStage)) {
    const stage = buildingById(project.job.building).stages[project.currentStage]
    return { ok: false, message: `Stage "${stage.name}" is missing: ${formatMissing(stageMissingMaterials(project, project.currentStage))}.` }
  }
  project.stages[project.currentStage].status = 'in_progress'
  project.stages[project.currentStage].progress = 0
  project.started = true
  addLog(state, `${buildingById(project.job.building).name}: started stage "${buildingById(project.job.building).stages[project.currentStage].name}".`)
  return { ok: true, message: 'Stage started.' }
}

function canWorkNow(state: GameState, project: Project): boolean {
  const dayEnd = workDayEnd(state)
  if (state.hour >= BALANCE.workDayStart && state.hour < dayEnd) return true
  if (isResearched(state, 'automation')) return true
  if (state.hour < dayEnd) return false
  return projectWorkers(state, project).some((worker) => worker.skills.includes('owl'))
}

export function nightEfficiency(state: GameState, hasOwl: boolean): number {
  const base = isResearched(state, 'automation') ? (hasOwl ? 0.95 : 0.75) : 0.9
  return Math.max(0.1, base * (1 + seasonNightEfficiencyRate(state)))
}

function processProjectHour(state: GameState, project: Project): void {
  if (isDebtBlocked(state) || project.currentStage >= project.stages.length || project.stages[project.currentStage].status !== 'in_progress') return
  if (!projectCrewsReady(state, project) || !canWorkNow(state, project) || !projectEquipmentReady(state, project)) return
  const workers = projectWorkers(state, project)
  if (workers.length === 0) return
  const dayEnd = workDayEnd(state)
  const night = state.hour < BALANCE.workDayStart || state.hour >= dayEnd
  const wages = Math.round(crewHourly(workers) * (1 + seasonWageRate(state)) * (1 + (state.seasonWageBonus ?? 0)) * (night ? seasonNightWageMultiplier(state) : 1))
  project.laborCost += wages
  project.totalHours += 1
  const asset = state.equipment.find((item) => item.assetId === project.equipmentAssetId)
  if (asset?.status === 'rented') {
    project.equipmentCost += equipmentById(asset.id).rentPerHour
    project.rentCost = (project.rentCost ?? 0) + equipmentById(asset.id).rentPerHour
    asset.hoursRemaining -= 1
  }
  const stageDef = buildingById(project.job.building).stages[project.currentStage]
  const stageManHours = seasonFoundationManHours(state, stageDef.manHours)
  const efficiencyMultiplier = night ? nightEfficiency(state, workers.some((worker) => worker.skills.includes('owl'))) : 1
  project.stages[project.currentStage].progress += crewEfficiency(workers, workerBonus(state)) * (1 + projectEquipmentBonus(state, project)) * efficiencyMultiplier / stageManHours
  if (asset?.status === 'rented' && asset.hoursRemaining <= 0) {
    state.equipment = state.equipment.filter((item) => item !== asset)
    project.equipmentAssetId = null
    addLog(state, `Rental of ${equipmentById(asset.id).name} ended.`, 'warning')
  }
  if (project.stages[project.currentStage].progress < 1) return
  project.stages[project.currentStage].progress = 1
  project.stages[project.currentStage].status = 'completed'
  project.currentStage += 1
  if (project.currentStage >= project.stages.length) {
    completeProject(state, project)
    return
  }
  addLog(state, `${buildingById(project.job.building).name}: stage "${stageDef.name}" completed.`, 'success')
  if (project.autoAdvance) startStage(state, project)
}

function returnReservedMaterials(state: GameState, project: Project): void {
  for (const [material, batches] of Object.entries(project.reserved) as [MaterialId, InventoryBatch[]][]) {
    for (const batch of batches) storeWarehouseCapped(state, material, batch.qty, batch.unitCost)
  }
  project.reserved = {}
}

function completeProject(state: GameState, project: Project): void {
  const unpaidWages = Math.max(0, project.laborCost - project.laborPaid)
  if (unpaidWages > 0) chargeObligation(state, unpaidWages, 'Crew settlement')
  project.laborPaid = project.laborCost
  const lateDays = Math.max(0, state.day - project.job.deadline)
  project.penalty = Math.round(project.job.budget * Math.min(BALANCE.latePenaltyCap, lateDays * BALANCE.latePenaltyPerDay))
  const payment = Math.max(0, project.job.budget - project.penalty - project.advance)
  state.money += payment
  state.totalRevenue += project.job.budget - project.penalty
  state.seasonRevenue += project.job.budget - project.penalty
  state.seasonCompleted += 1
  project.profit = project.job.budget - project.materialCost - project.laborCost - project.logisticsCost - project.equipmentCost - project.factoringFee - project.penalty
  project.completedDay = state.day
  const def = buildingById(project.job.building)
  state.reputation = Math.max(0, Math.min(100, state.reputation + (lateDays > 0 ? -2 * lateDays : def.reputationReward ?? 2)))
  returnReservedMaterials(state, project)
  state.completed.unshift(project)
  if (isResearched(state, 'pr_department') && state.completed.length % 5 === 0) {
    state.reputation = Math.max(0, Math.min(100, state.reputation + 2))
  }
  state.projects = state.projects.filter((item) => item !== project)
  for (const asset of state.equipment) if (asset.projectId === project.id) asset.projectId = null
  const nextProject = state.projects.find((item) => item.crewIds.length < requiredCrews(item))
  if (nextProject) {
    for (const crewId of project.crewIds) if (nextProject.crewIds.length < requiredCrews(nextProject)) nextProject.crewIds.push(crewId)
  }
  addLog(state, `Project delivered: ${def.name}. Profit $${project.profit.toLocaleString('en-US')}${lateDays ? `, penalty $${project.penalty.toLocaleString('en-US')}` : ''}.`, lateDays ? 'warning' : 'success')
}

function arriveDeliveries(state: GameState): void {
  const arrived = state.deliveries.filter((delivery) => delivery.arriveDay <= state.day)
  for (const delivery of arrived) {
    const project = delivery.projectId ? state.projects.find((item) => item.id === delivery.projectId) : undefined
    for (const item of delivery.items) {
      if (project) addProjectInventory(project, item.material, item.qty, item.unitCost)
      else storeWarehouseCapped(state, item.material, item.qty, item.unitCost)
    }
    addLog(state, `Delivery from "${SUPPLIERS[delivery.supplier].name}" received${project ? ' into project reserve' : ' at warehouse'}.`, 'success')
  }
  state.deliveries = state.deliveries.filter((delivery) => delivery.arriveDay > state.day)
}

function settleDailyObligations(state: GameState): void {
  if (state.debt > 0) {
    if (state.research.overdraft?.status === 'done') state.debt = Math.ceil(state.debt * 1.01)
    const available = Math.max(0, state.money)
    const payment = Math.min(available, state.debt)
    state.money -= payment
    state.debt -= payment
    if (state.debt === 0) addLog(state, 'Obligations repaid, the company continues working.', 'success')
  }
  for (const project of state.projects) {
    const wages = Math.max(0, project.laborCost - project.laborPaid)
    if (wages > 0) {
      chargeObligation(state, wages, `Wages · ${buildingById(project.job.building).name}`)
      project.laborPaid = project.laborCost
    }
  }
  if (state.loan) {
    const payment = Math.min(state.loan.daily, state.loan.remaining)
    chargeObligation(state, payment, 'Loan payment')
    state.loan.remaining -= payment
    if (state.loan.remaining <= 0) {
      state.loan = null
      addLog(state, 'Loan fully repaid.', 'success')
    }
  }
  for (const asset of [...state.equipment]) {
    const project = state.projects.find((item) => item.id === asset.projectId)
    if (asset.status === 'leased') {
      const payment = Math.min(asset.leaseDaily, asset.leaseRemaining)
      chargeObligation(state, payment, `Lease · ${equipmentById(asset.id).name}`)
      if (project) project.equipmentCost += payment
      asset.leaseRemaining -= payment
      if (asset.leaseRemaining <= 0) {
        asset.status = 'owned'
        asset.leaseDaily = 0
        addLog(state, `${equipmentById(asset.id).name}: lease paid off, equipment is now owned.`, 'success')
      }
    }
    if (asset.status !== 'rented') {
      const maintenance = Math.max(1, Math.round(equipmentById(asset.id).price * seasonMaintenanceRate(state)))
      chargeObligation(state, maintenance, `Maintenance · ${equipmentById(asset.id).name}`)
      if (project) project.equipmentCost += maintenance
    }
  }
  const storageFee = warehouseStorageFee(state)
  if (storageFee > 0) chargeObligation(state, storageFee, 'Maintenance · Warehouse')
}

function processSupply(state: GameState): void {
  for (const supplier of ['north', 'south'] as SupplierId[]) {
    for (const material of MATERIALS) {
      const expected = material.dailyDemand * BALANCE.restockDays
      const ratio = state.demand[supplier][material.id] / expected
      const priceMultiplier = Math.max(BALANCE.priceFloor, Math.min(BALANCE.priceCap, 1 + BALANCE.priceSensitivity * (ratio - 1)))
      const price = Math.max(1, Math.round(material.basePrice * priceMultiplier))
      const quantity = Math.min(material.stockMax, Math.max(material.stockMin, Math.round(expected * Math.max(0.25, Math.min(4, ratio)))))
      state.suppliers[supplier][material.id].push({ qty: quantity, initialQty: quantity, price, arrivedDay: state.day })
      state.demand[supplier][material.id] = 0
      for (const lot of state.suppliers[supplier][material.id]) {
        if (state.day - lot.arrivedDay > BALANCE.agingDays && lot.qty / lot.initialQty >= 0.6) {
          lot.price = Math.max(Math.round(material.basePrice * BALANCE.priceFloor), Math.round(lot.price * (1 - BALANCE.agingDiscount)))
        }
      }
      if (supplier === 'north') {
        state.priceHistory[material.id].push(price)
        if (state.priceHistory[material.id].length > 30) state.priceHistory[material.id].shift()
      }
    }
  }
}

function botSupplierQuote(state: GameState, material: MaterialId, quantity: number): { supplier: SupplierId; qty: number; unitTotal: number } {
  if (quantity <= 0) return { supplier: 'south', qty: 0, unitTotal: 0 }
  const suppliers: SupplierId[] = ['north', 'south']
  let best: SupplierId = 'south'
  let bestQty = 0
  let bestUnit = Number.POSITIVE_INFINITY
  for (const supplier of suppliers) {
    const available = stockQty(state, material, supplier)
    if (available <= 0) continue
    const qty = Math.min(quantity, available)
    const quote = quoteMaterial(state, material, qty, supplier)
    const unit = quote.qty > 0 ? quote.total / quote.qty : Number.POSITIVE_INFINITY
    if (unit < bestUnit || (unit === bestUnit && supplier === 'south')) {
      bestUnit = unit
      bestQty = qty
      best = supplier
    }
  }
  return { supplier: best, qty: bestQty, unitTotal: bestUnit }
}

function botEstimate(state: GameState, job: Job): { materials: number; labor: number; margin: number; hours: number } {
  const def = buildingById(job.building)
  let materials = 0
  let hours = 0
  for (const stage of def.stages) {
    hours += stage.manHours
    for (const [material, qty] of Object.entries(stage.materials) as [MaterialId, number][]) {
      if (!qty) continue
      const best = botSupplierQuote(state, material, qty)
      materials += best.unitTotal * qty
    }
  }
  const labor = hours * BALANCE.botWageEstimate
  return { materials, labor, margin: job.budget - materials - labor, hours }
}

function botBuy(state: GameState, bot: Bot, material: MaterialId, quantity: number): { qty: number; cost: number } {
  const best = botSupplierQuote(state, material, quantity)
  const qty = Math.min(best.qty, Math.floor(bot.money / Math.max(1, best.unitTotal)))
  if (qty <= 0) return { qty: 0, cost: 0 }
  const actual = quoteMaterial(state, material, qty, best.supplier)
  deductLots(state, material, best.supplier, qty)
  state.demand[best.supplier][material] += qty
  bot.money -= actual.total
  return { qty, cost: actual.total }
}

export function botProjectLimit(state: GameState): number {
  return state.seasonIndex >= 2 || isResearched(state, 'planning_1') ? 2 : 1
}

export function botCap(state: GameState, bot: Bot): number {
  return bot.projectLimit ?? botProjectLimit(state)
}

function botPickJob(state: GameState, bot: Bot): void {
  if (state.seasonIndex >= 1 && bot.crewTarget < BALANCE.botCrewMin) bot.crewTarget = randomInt(state, BALANCE.botCrewMin, BALANCE.botCrewMax)
  const options = state.jobs.filter((job) => !job.special).map((job) => ({ job, estimate: botEstimate(state, job) })).filter((item) => item.estimate.margin > item.job.budget * 0.1 && bot.money >= item.estimate.materials * 0.7)
  options.sort((a, b) => {
    const score = (item: typeof a) => item.estimate.margin / item.job.budget + (bot.strategy === 'aggressive' ? item.job.budget / 4_000_000 : 0) - (bot.strategy === 'conservative' ? item.estimate.hours / 500 : 0)
    return score(b) - score(a)
  })
  const selected = options[0]
  if (!selected) return
  if (isResearched(state, 'project_coordination')) selected.job.deadline -= 2
  state.jobs = state.jobs.filter((job) => job.id !== selected.job.id)
  bot.projects.push({ job: selected.job, stages: makeStages(selected.job.building), currentStage: 0, materialSpent: 0, wagesPaid: 0, rentalPaid: 0, progress: 0 })
  bot.state = 'working'
  if (isResearched(state, 'factoring')) {
    const advance = Math.round(selected.job.budget * BALANCE.factoringAdvance)
    const fee = Math.round(selected.job.budget * BALANCE.factoringFee)
    bot.money += advance - fee
  }
  addLog(state, `${bot.name} took the contract "${buildingById(selected.job.building).name}".`)
}

function botStageReadyForBuild(project: BotProject, def: ReturnType<typeof buildingById>): boolean {
  if (project.currentStage >= def.stages.length) return false
  const defStage = def.stages[project.currentStage]
  const stage = project.stages[project.currentStage]
  return Object.entries(defStage.materials).every(([material, qty]) => (stage.stock[material as MaterialId]?.qty ?? 0) >= (qty ?? 0))
}

function deliverBotProject(state: GameState, bot: Bot, project: BotProject): void {
  const lateDays = Math.max(0, state.day - project.job.deadline)
  const penalty = Math.round(project.job.budget * Math.min(BALANCE.latePenaltyCap, lateDays * BALANCE.latePenaltyPerDay))
  bot.money += project.job.budget - penalty
  const profit = project.job.budget - project.materialSpent - project.wagesPaid - project.rentalPaid - penalty
  bot.totalProfit += profit
  bot.jobsDone += 1
  bot.projects = bot.projects.filter((item) => item !== project)
  addLog(state, `${bot.name} delivered "${buildingById(project.job.building).name}". Profit $${profit.toLocaleString('en-US')}.`, 'info')
  if (bot.projects.length === 0) {
    state.candidates.push(...bot.crew)
    bot.crew = []
    bot.state = 'cooldown'
    bot.cooldown = randomInt(state, 2, 4)
  }
}

function tickBot(state: GameState, bot: Bot): void {
  if (bot.state === 'cooldown') {
    bot.cooldown -= 1
    if (bot.cooldown <= 0) bot.state = bot.projects.length > 0 ? 'working' : 'idle'
    return
  }
  if (bot.loan) {
    const payment = Math.min(bot.money, bot.loan.daily, bot.loan.remaining)
    bot.money -= payment
    bot.loan.remaining -= payment
    if (bot.loan.remaining <= 0) bot.loan = null
  }
  const cap = botCap(state, bot)
  for (let i = 0; i < cap && bot.projects.length < cap; i += 1) botPickJob(state, bot)
  if (bot.projects.length === 0) return

  while (bot.crew.length < bot.crewTarget && state.candidates.length > 0) {
    let index = 0
    if (bot.strategy === 'aggressive') index = state.candidates.findIndex((worker) => worker.type !== 'handyman')
    if (bot.strategy === 'conservative') index = state.candidates.findIndex((worker) => worker.type === 'handyman')
    if (index < 0) index = 0
    bot.crew.push(state.candidates.splice(index, 1)[0])
  }
  if (bot.money < crewHourly(bot.crew) * BALANCE.botWorkHours && !bot.loan) {
    const option = LOAN_OPTIONS[0]
    bot.loan = { amount: option.amount, rate: option.rate, total: Math.round(option.amount * (1 + option.rate)), daily: Math.round(option.amount * (1 + option.rate) / BALANCE.loanDays), remaining: Math.round(option.amount * (1 + option.rate)) }
    bot.money += option.amount
  }

  for (const project of bot.projects) {
    const def = buildingById(project.job.building)
    for (let stageIndex = project.currentStage; stageIndex <= Math.min(project.currentStage + 1, def.stages.length - 1); stageIndex += 1) {
      for (const [material, required] of Object.entries(def.stages[stageIndex].materials) as [MaterialId, number][]) {
        const stage = project.stages[stageIndex]
        const have = stage.stock[material]?.qty ?? 0
        const bought = botBuy(state, bot, material, required - have)
        if (bought.qty > 0) {
          stage.stock[material] = { qty: have + bought.qty, unitCost: 0 }
          project.materialSpent += bought.cost
        }
      }
    }
  }

  const workday = workdayHours(state)
  const night = isResearched(state, 'automation') ? 24 - workday : 0
  const hasOwl = bot.crew.some((worker) => worker.skills.includes('owl'))
  const nightEff = night > 0 ? nightEfficiency(state, hasOwl) : 0
  const nightWage = night > 0 ? seasonNightWageMultiplier(state) : 1
  const dailyWages = crewHourly(bot.crew) * (workday + night * nightWage)
  const workingSet = bot.projects.filter((project) => botStageReadyForBuild(project, buildingById(project.job.building)))
  if (workingSet.length === 0 || bot.crew.length === 0 || bot.money < dailyWages + BALANCE.botDailyRental) return
  bot.money -= Math.round(dailyWages) + BALANCE.botDailyRental
  let work = crewEfficiency(bot.crew, workerBonus(state)) * (workday + night * nightEff)
  const usedWork: { project: BotProject; hours: number }[] = []
  for (const project of workingSet) {
    if (work <= 0) break
    const def = buildingById(project.job.building)
    const startWork = work
    while (work > 0 && project.currentStage < project.stages.length) {
      const current = project.stages[project.currentStage]
      const currentDef = def.stages[project.currentStage]
      const ready = Object.entries(currentDef.materials).every(([material, qty]) => (current.stock[material as MaterialId]?.qty ?? 0) >= (qty ?? 0))
      if (!ready) break
      const needed = currentDef.manHours * (1 - current.progress)
      const used = Math.min(work, needed)
      current.progress += used / currentDef.manHours
      work -= used
      if (current.progress >= 0.999999) {
        current.status = 'completed'
        project.currentStage += 1
        if (project.currentStage < project.stages.length) project.stages[project.currentStage].status = 'in_progress'
      } else break
    }
    const consumed = startWork - work
    if (consumed > 0) usedWork.push({ project, hours: consumed })
    project.progress = project.currentStage / project.stages.length + (project.currentStage < project.stages.length ? project.stages[project.currentStage].progress / project.stages.length : 0)
  }
  const totalUsed = usedWork.reduce((sum, item) => sum + item.hours, 0)
  if (totalUsed > 0) {
    for (const { project, hours } of usedWork) {
      const share = hours / totalUsed
      project.wagesPaid += Math.round(dailyWages * share)
      project.rentalPaid += Math.round(BALANCE.botDailyRental * share)
    }
  }
  for (const project of [...bot.projects]) {
    if (project.currentStage >= project.stages.length) deliverBotProject(state, bot, project)
  }
}

function dailyTick(state: GameState): void {
  ensureCorpBot(state)
  arriveDeliveries(state)
  settleDailyObligations(state)
  const offset = state.day % state.bots.length
  for (let i = 0; i < state.bots.length; i += 1) tickBot(state, state.bots[(i + offset) % state.bots.length])
  if (state.day % BALANCE.restockDays === 0) {
    processSupply(state)
    const neededCandidates = BALANCE.minCandidates + state.bots.reduce((sum, bot) => sum + bot.crewTarget, 0)
    if (state.candidates.length < neededCandidates) generateWorkers(state, neededCandidates - state.candidates.length)
    if (!state.jobs.some((job) => job.special) && state.jobs.length < 5 && random(state) < BALANCE.specialJobChance) {
      const special = pick(state, BUILDINGS.filter((building) => building.special))
      state.jobs.push(createJob(state, special.id))
      addLog(state, `A special project "${special.name}" appeared on the board. Offer is limited.`, 'success')
    }
  }
  const researching = Object.entries(state.research).find(([, value]) => value.status === 'researching')
  if (researching) {
    researching[1].progress += 1
    if (researching[1].progress >= techById(researching[0]).days) {
      researching[1].status = 'done'
      addLog(state, `Research completed: ${techById(researching[0]).name}.`, 'success')
    }
  }
  state.jobs = state.jobs.filter((job) => job.special ? state.day <= job.expiresDay : job.deadline - state.day >= 2)
  const additions = randomInt(state, 1, 2)
  for (let i = 0; i < additions && state.jobs.length < 5; i += 1) state.jobs.push(createJob(state))
  while (state.jobs.length < 3) state.jobs.push(createJob(state, state.reputation < 40 ? 'reconstruction' : undefined))
  const eventDef = EVENTS.find((e) => e.season === state.seasonIndex && e.day === state.day && !(state.eventsFired ?? []).includes(e.id) && (!e.requiresLicense || isLicenseUnlocked(state, e.requiresLicense)) && (!e.when || e.when(state)))
  if (eventDef) {
    state.event = eventDef.id
    state.eventsFired.push(eventDef.id)
    state.paused = true
    addLog(state, `Event: "${eventDef.title}".`, 'warning')
  }
  recordFinanceSnapshot(state)
}

function transitionSeason(state: GameState): void {
  const season = currentSeason(state)
  const goal = season.goal
  const success = netWorth(state) >= goal.capital && state.reputation >= goal.reputation && state.seasonCompleted >= goal.completed
  const final = state.seasonIndex >= 9
  state.reputation = Math.max(0, Math.min(100, state.reputation + (success ? BALANCE.seasonSuccessReputation : -BALANCE.seasonFailReputation)))
  if (!final) state.seasonIndex += 1
  if (isResearched(state, 'reserve_fund')) {
    state.money += 500_000
    addLog(state, 'Reserve fund: +$500,000 for the new season.', 'money')
  }
  for (const bot of state.bots) {
    if (state.seasonIndex >= 1 && !bot.corporation) bot.crewTarget = randomInt(state, BALANCE.botCrewMin, BALANCE.botCrewMax)
  }
  for (const project of state.projects) {
    project.job.deadline -= BALANCE.seasonDays
    project.job.createdDay -= BALANCE.seasonDays
    project.job.expiresDay -= BALANCE.seasonDays
  }
  for (const delivery of state.deliveries) delivery.arriveDay -= BALANCE.seasonDays
  for (const job of state.jobs) {
    job.deadline -= BALANCE.seasonDays
    job.createdDay -= BALANCE.seasonDays
    job.expiresDay -= BALANCE.seasonDays
  }
  for (const bot of state.bots) {
    for (const project of bot.projects) {
      project.job.deadline -= BALANCE.seasonDays
      project.job.createdDay -= BALANCE.seasonDays
      project.job.expiresDay -= BALANCE.seasonDays
    }
  }
  state.day = 1
  state.hour = BALANCE.workDayStart
  state.seasonCompleted = 0
  state.seasonRevenue = 0
  state.seasonPriceBonus = 0
  state.seasonDeadlineBonus = 0
  state.seasonWageBonus = 0
  processSupply(state)
  const additions = randomInt(state, 1, 2)
  for (let i = 0; i < additions && state.jobs.length < 5; i += 1) state.jobs.push(createJob(state))
  state.seasonNotice = {
    success,
    final: success && final,
    title: success ? (final ? 'Final season completed' : 'Season completed') : 'Season failed',
    text: success
      ? `"${season.name}" completed successfully. Reward +${BALANCE.seasonSuccessReputation} reputation. Now starting: "${currentSeason(state).name}".`
      : `Goals of "${season.name}" were not met. Penalty −${BALANCE.seasonFailReputation} reputation. Now starting: "${currentSeason(state).name}".`,
  }
  addLog(state, state.seasonNotice.text, success ? 'success' : 'warning')
  state.paused = true
}

export function tickHour(state: GameState): void {
  if (state.paused) return
  state.hour += 1
  if (state.hour >= 24) {
    state.hour = 0
    state.day += 1
    if (state.day > BALANCE.seasonDays) transitionSeason(state)
    else dailyTick(state)
  }
  for (const project of [...state.projects]) processProjectHour(state, project)
}

export function netWorth(state: GameState): number {
  const assets = state.equipment.reduce((sum, asset) => sum + (asset.status === 'rented' ? 0 : equipmentById(asset.id).price), 0)
  return state.money + assets - state.debt - (state.loan?.remaining ?? 0)
}

export function repayDebt(state: GameState): ActionResult {
  if (state.debt <= 0) return { ok: false, message: 'No current debt.' }
  const payment = Math.min(Math.max(0, state.money), state.debt)
  if (payment <= 0) return { ok: false, message: 'Not enough money. A loan becomes available after researching the bank account.' }
  state.money -= payment
  state.debt -= payment
  return { ok: true, message: `Repaid $${payment.toLocaleString('en-US')}.` }
}

export function takeLoan(state: GameState, amount: number): ActionResult {
  if (!isResearched(state, 'bank_account')) return { ok: false, message: 'Research the bank account first.' }
  if (state.loan) return { ok: false, message: 'Only one loan is available at a time.' }
  const option = LOAN_OPTIONS.find((item) => item.amount === amount)
  if (!option) return { ok: false, message: 'Unknown offer.' }
  if (option.minReputation && state.reputation < option.minReputation) return { ok: false, message: `A loan of $${amount.toLocaleString('en-US')} requires ${option.minReputation} reputation.` }
  const total = Math.round(amount * (1 + option.rate))
  const loan: Loan = { amount, rate: option.rate, total, daily: Math.round(total / BALANCE.loanDays), remaining: total }
  state.loan = loan
  state.money += amount
  addLog(state, `Loan received: $${amount.toLocaleString('en-US')} for ${BALANCE.loanDays} days.`, 'money')
  return { ok: true, message: 'Money credited to the account.' }
}

export function acquireEquipment(state: GameState, id: EquipmentId, mode: EquipmentAsset['status'], hours = 0): ActionResult {
  if (isDebtBlocked(state)) return { ok: false, message: 'Repay your obligations first.' }
  const def = equipmentById(id)
  const assetId = nextId(state, 'asset')
  if (mode === 'owned') {
    if (!spend(state, def.price)) return { ok: false, message: 'Not enough money.' }
    state.equipment.push({ assetId, id, status: mode, projectId: null, hoursRemaining: 0, leaseRemaining: 0, leaseDaily: 0 })
  } else if (mode === 'rented') {
    if (hours < def.minRentHours) return { ok: false, message: `Minimum rental is ${def.minRentHours} h.` }
    if (!spend(state, hours * def.rentPerHour)) return { ok: false, message: 'Not enough money.' }
    state.equipment.push({ assetId, id, status: mode, projectId: null, hoursRemaining: hours, leaseRemaining: 0, leaseDaily: 0 })
  } else {
    const discount = isResearched(state, 'good_leasing') ? 0.92 : 1
    const total = Math.round(def.price * (1 + BALANCE.leaseInterest) * discount)
    const down = Math.round(def.price * BALANCE.leaseDownPayment)
    if (!spend(state, down)) return { ok: false, message: `The down payment requires $${down.toLocaleString('en-US')}.` }
    const remaining = total - down
    state.equipment.push({ assetId, id, status: mode, projectId: null, hoursRemaining: 0, leaseRemaining: remaining, leaseDaily: Math.ceil(remaining / BALANCE.leaseDays) })
  }
  addLog(state, `${def.name}: ${mode === 'owned' ? 'purchased' : mode === 'rented' ? `rented for ${hours} h` : 'leased'} done.`, 'money')
  return { ok: true, message: 'Equipment added to the fleet.' }
}

export function sellEquipment(state: GameState, assetId: string): ActionResult {
  const asset = state.equipment.find((item) => item.assetId === assetId)
  if (!asset) return { ok: false, message: 'Equipment not found.' }
  if (asset.status !== 'owned') return { ok: false, message: 'Only owned equipment can be sold.' }
  const saleRate = state.research.dealer_network?.status === 'done' ? 0.85 : 0.7
  const price = Math.round(equipmentById(asset.id).price * saleRate)
  if (asset.projectId) {
    const project = state.projects.find((item) => item.id === asset.projectId)
    if (project?.equipmentAssetId === asset.assetId) project.equipmentAssetId = null
    asset.projectId = null
  }
  state.equipment = state.equipment.filter((item) => item.assetId !== assetId)
  state.money += price
  state.equipmentSold += 1
  addLog(state, `${equipmentById(asset.id).name}: sold for $${price.toLocaleString('en-US')}.`, 'money')
  return { ok: true, message: `Sold for $${price.toLocaleString('en-US')}.` }
}

export function assignEquipment(state: GameState, project: Project, assetId: string | null): ActionResult {
  const asset = assetId ? state.equipment.find((item) => item.assetId === assetId) : null
  if (assetId && !asset) return { ok: false, message: 'Equipment unavailable.' }
  if (asset?.projectId && asset.projectId !== project.id) return { ok: false, message: 'This unit is already assigned to another project.' }
  for (const item of state.equipment) if (item.projectId === project.id) item.projectId = null
  project.equipmentAssetId = assetId
  if (!asset) return { ok: true, message: 'Equipment removed from the project.' }
  asset.projectId = project.id
  return { ok: true, message: `${equipmentById(asset.id).name} assigned to the project.` }
}

export function resolveEvent(state: GameState, eventId: string, optionIndex: number): ActionResult {
  const def = EVENTS.find((event) => event.id === eventId)
  if (!def) return { ok: false, message: 'Event not found.' }
  const option = def.options[optionIndex]
  if (!option) return { ok: false, message: 'Option not found.' }
  if (option.requiresReputation && state.reputation < option.requiresReputation) return { ok: false, message: `Requires ${option.requiresReputation} reputation.` }
  const cost = option.effect.cash ?? 0
  if (cost < 0 && !spend(state, -cost)) return { ok: false, message: 'Not enough funds.' }
  if (cost > 0) state.money += cost
  if (option.effect.reputation) state.reputation = Math.max(0, Math.min(100, state.reputation + option.effect.reputation))
  if (option.effect.delayDays) {
    for (const project of state.projects) project.job.deadline += option.effect.delayDays
  }
  if (option.effect.seasonPriceBonus) state.seasonPriceBonus = Math.max(0, state.seasonPriceBonus + option.effect.seasonPriceBonus)
  if (option.effect.seasonWageBonus) state.seasonWageBonus = Math.max(0, state.seasonWageBonus + option.effect.seasonWageBonus)
  if (option.effect.seasonDeadlineBonus) {
    state.seasonDeadlineBonus = Math.max(0, state.seasonDeadlineBonus + option.effect.seasonDeadlineBonus)
    const bonus = option.effect.seasonDeadlineBonus
    for (const project of state.projects) {
      const rem = Math.max(0, project.job.deadline - state.day)
      project.job.deadline += Math.max(1, Math.round(rem * bonus))
    }
    for (const job of state.jobs) {
      const rem = Math.max(0, job.deadline - state.day)
      job.deadline += Math.max(1, Math.round(rem * bonus))
    }
  }
  if (def.id === 'corp_final') state.corpFinalChoice = optionIndex === 0 ? 'sold' : 'fight'
  state.event = null
  state.paused = false
  const kind: GameState['journal'][number]['kind'] = cost < 0 ? 'money' : option.effect.reputation && option.effect.reputation < 0 ? 'warning' : option.effect.reputation ? 'success' : option.effect.delayDays ? 'warning' : 'info'
  addLog(state, `${def.title}: ${option.outcome}`, kind)
  return { ok: true, message: option.outcome }
}
