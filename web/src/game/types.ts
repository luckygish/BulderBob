export type MaterialId = 'concrete' | 'rebar' | 'lumber' | 'insulation' | 'metal_roof' | 'brick' | 'gas_block'
export type BuildingId = 'reconstruction' | 'frame_house' | 'brick_house' | 'gas_block_house' | 'hangar' | 'tv_tower' | 'apartments' | 'resort_house' | 'park' | 'kindergarten' | 'hospital' | 'roads' | 'warehouses' | 'thermal_plant' | 'school' | 'sports_complex' | 'bridge' | 'ice_palace'
export type SupplierId = 'north' | 'south'
export type WorkerType = 'handyman' | 'specialist' | 'foreman'
export type SkillId = 'alcohol' | 'tudyaga' | 'owl' | 'thief' | 'thrifty' | 'mentor' | 'logistician' | 'technologist' | 'sluggish' | 'expensive'
export type EquipmentId = 'excavator' | 'crane' | 'manipulator' | 'tractor' | 'mixer'
export type ProvisionId = 'cabins' | 'toilet' | 'water' | 'generator' | 'hand_tool'
export type StageStatus = 'not_started' | 'ready' | 'in_progress' | 'completed'
export type Speed = 1 | 2 | 4

export interface MaterialDef { id: MaterialId; name: string; short: string; unit: string; basePrice: number; stockMax: number; stockMin: number; dailyDemand: number }
export interface StageDef { id: string; name: string; materials: Partial<Record<MaterialId, number>>; manHours: number; requiredEquipment?: EquipmentId[]; equipmentBonus?: Partial<Record<EquipmentId, number>> }
export interface BuildingDef { id: BuildingId; name: string; short: string; budgetMin: number; budgetMax: number; minReputation: number; stages: StageDef[]; special?: boolean; requiredCrews?: number; reputationReward?: number; requiredLicense?: 'city' | 'region' }
export interface WorkerDef { name: string; efficiency: number; rateMin: number; rateMax: number; teamBonus: number }
export interface EquipmentDef { id: EquipmentId; name: string; description: string; price: number; rentPerHour: number; minRentHours: number }
export interface ProvisionDef { id: ProvisionId; name: string; description: string; price: number }
export interface TechDef { id: string; name: string; branch: string; cost: number; days: number; requires: string; requiresMoney: number; requiresReputation?: number; requiresCapital?: number; description: string }

export interface Job { id: string; client: string; building: BuildingId; budget: number; deadline: number; createdDay: number; special: boolean; expiresDay: number }
export interface InventoryBatch { qty: number; unitCost: number }
export interface StageState { status: StageStatus; progress: number; stock: Partial<Record<MaterialId, InventoryBatch>> }
export interface Project {
  id: string
  job: Job
  stages: StageState[]
  currentStage: number
  crewIds: number[]
  equipmentAssetId: string | null
  reserved: Partial<Record<MaterialId, InventoryBatch[]>>
  autoAdvance: boolean
  started: boolean
  materialCost: number
  laborCost: number
  laborPaid: number
  logisticsCost: number
  equipmentCost: number
  factoringFee: number
  advance: number
  penalty: number
  totalHours: number
  completedDay: number | null
  profit: number
}
export interface Worker { id: string; name: string; type: WorkerType; rate: number; skills: SkillId[] }
export interface Crew { workers: Worker[] }
export interface Lot { qty: number; initialQty: number; price: number; arrivedDay: number }
export interface DeliveryItem { material: MaterialId; qty: number; unitCost: number }
export interface Delivery { id: string; supplier: SupplierId; arriveDay: number; items: DeliveryItem[]; fee: number; projectId?: string }
export interface EquipmentAsset {
  assetId: string
  id: EquipmentId
  status: 'owned' | 'rented' | 'leased'
  projectId: string | null
  hoursRemaining: number
  leaseRemaining: number
  leaseDaily: number
}
export interface Loan { amount: number; rate: number; total: number; daily: number; remaining: number }
export interface Research { status: 'researching' | 'done'; progress: number }
export interface BotProject { job: Job; stages: StageState[]; currentStage: number; materialSpent: number; wagesPaid: number; rentalPaid: number; progress: number }
export interface Bot { id: string; name: string; strategy: 'aggressive' | 'moderate' | 'conservative'; money: number; totalProfit: number; jobsDone: number; state: 'idle' | 'working' | 'cooldown'; cooldown: number; crew: Worker[]; crewTarget: number; projects: BotProject[]; loan: Loan | null; corporation?: boolean; projectLimit?: number }
export interface JournalEntry { id: string; day: number; hour: number; kind: 'info' | 'success' | 'warning' | 'money'; text: string }
export interface SeasonGoal { capital: number; reputation: number; completed: number }
export interface SeasonDef {
  id: string
  name: string
  title: string
  weather: 'summer' | 'winter'
  goal: SeasonGoal
  effects: { materialPriceRate?: number; foundationHoursRate?: number; extraWorkHour?: number; wageRate?: number; logisticsRate?: number; provisionRate?: number; maintenanceRate?: number; nightWageRate?: number; nightEfficiencyRate?: number }
}
export interface SeasonNotice { success: boolean; title: string; text: string; final?: boolean }
export interface EventOption {
  label: string
  hint?: string
  requiresReputation?: number
  effect: { cash?: number; reputation?: number; delayDays?: number; seasonPriceBonus?: number; seasonDeadlineBonus?: number; seasonWageBonus?: number }
  outcome: string
}
export interface EventDef {
  id: string
  season: number
  day: number
  eyebrow: string
  title: string
  text: string
  options: EventOption[]
  requiresLicense?: 'city' | 'region'
  when?: (state: GameState) => boolean
}
export interface FinanceSnapshot { day: number; capital: number; cash: number; reputation: number; seasonCompleted: number }

export interface GameState {
  version: number
  rngSeed: number
  nextId: number
  money: number
  debt: number
  reputation: number
  day: number
  hour: number
  speed: Speed
  paused: boolean
  jobs: Job[]
  projects: Project[]
  completed: Project[]
  candidates: Worker[]
  crews: Crew[]
  inventory: Record<MaterialId, InventoryBatch[]>
  suppliers: Record<SupplierId, Record<MaterialId, Lot[]>>
  demand: Record<SupplierId, Record<MaterialId, number>>
  priceHistory: Record<MaterialId, number[]>
  deliveries: Delivery[]
  equipment: EquipmentAsset[]
  provisions: Record<ProvisionId, number>
  research: Record<string, Research>
  loan: Loan | null
  bots: Bot[]
  journal: JournalEntry[]
  totalRevenue: number
  seasonIndex: number
  seasonCompleted: number
  seasonRevenue: number
  completedTutorial: string[]
  equipmentSold: number
  usedSuppliers: SupplierId[]
  seasonNotice: SeasonNotice | null
  companyName: string
  companyAvatar: number
  financeHistory: FinanceSnapshot[]
  event: string | null
  eventsFired: string[]
  seasonPriceBonus: number
  seasonDeadlineBonus: number
  seasonWageBonus: number
  corpFinalChoice: 'sold' | 'fight' | null
}

export interface Quote { qty: number; cost: number; fee: number; total: number; arriveDay: number; available: number }
export interface ActionResult { ok: boolean; message: string }
