import type { BuildingDef, EquipmentDef, EquipmentId, MaterialDef, ProvisionDef, SkillId, StageDef, SupplierId, TechDef, WorkerDef, WorkerType } from './types'

export const MATERIALS: MaterialDef[] = [
  { id: 'concrete', name: 'Concrete', short: 'CR', unit: 'm³', basePrice: 4_500, stockMin: 100, stockMax: 1_275, dailyDemand: 150 },
  { id: 'rebar', name: 'Rebar', short: 'RB', unit: 't', basePrice: 650, stockMin: 50, stockMax: 1_700, dailyDemand: 80 },
  { id: 'lumber', name: 'Lumber', short: 'LB', unit: 'm³', basePrice: 1_200, stockMin: 200, stockMax: 3_825, dailyDemand: 40 },
  { id: 'insulation', name: 'Insulation', short: 'IN', unit: 'm²', basePrice: 800, stockMin: 50, stockMax: 1_275, dailyDemand: 50 },
  { id: 'metal_roof', name: 'Metal roofing', short: 'MR', unit: 'm²', basePrice: 950, stockMin: 50, stockMax: 1_700, dailyDemand: 150 },
  { id: 'brick', name: 'Brick', short: 'BK', unit: 'pcs', basePrice: 65, stockMin: 200, stockMax: 3_400, dailyDemand: 600 },
  { id: 'gas_block', name: 'Aerated block', short: 'GB', unit: 'm³', basePrice: 85, stockMin: 100, stockMax: 3_400, dailyDemand: 50 },
]

const scaleHours = (hours: number): number => Math.round(hours * 115 / 100)

const foundation = (concrete: number, rebar: number, manHours: number): StageDef => ({
  id: 'foundation', name: 'Foundation', materials: { concrete, rebar }, manHours: scaleHours(manHours),
  requiredEquipment: ['mixer', 'tractor', 'excavator'],
  equipmentBonus: { tractor: 0.3, excavator: 0.45 },
})
const walls = (name: string, materials: StageDef['materials'], manHours: number, requiredEquipment?: EquipmentId[]): StageDef => ({
  id: 'walls', name, materials, manHours: scaleHours(manHours), requiredEquipment,
  equipmentBonus: { manipulator: 0.15, crane: 0.1 },
})
const roof = (metalRoof: number, lumber: number, insulation: number, manHours: number, requiredEquipment?: EquipmentId[]): StageDef => ({
  id: 'roof', name: 'Roof', materials: { metal_roof: metalRoof, lumber, insulation }, manHours: scaleHours(manHours), requiredEquipment,
  equipmentBonus: { crane: 0.2 },
})
const finish = (materials: StageDef['materials'], manHours: number): StageDef => ({
  id: 'finish', name: 'Finishing', materials, manHours: scaleHours(manHours),
  equipmentBonus: { manipulator: 0.1 },
})

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'reconstruction', name: 'Renovation', short: 'RN', budgetMin: 550_000, budgetMax: 850_000, minReputation: 0,
    stages: [foundation(9, 3, 12), walls('Walls & frame', { lumber: 150, insulation: 12 }, 20), roof(36, 6, 0, 7), finish({ insulation: 6, lumber: 9 }, 10)],
  },
  {
    id: 'frame_house', name: 'Frame house', short: 'FH', budgetMin: 1_450_000, budgetMax: 2_000_000, minReputation: 40,
    stages: [foundation(30, 10, 30), walls('Walls & frame', { lumber: 500, insulation: 40 }, 70), roof(120, 20, 0, 34), finish({ insulation: 20, lumber: 30 }, 42)],
  },
  {
    id: 'brick_house', name: 'Brick house', short: 'BH', budgetMin: 1_800_000, budgetMax: 2_600_000, minReputation: 60,
    stages: [foundation(100, 40, 40), walls('Brick masonry', { brick: 800, concrete: 40 }, 90), roof(180, 40, 30, 40), finish({ insulation: 60, lumber: 50 }, 78)],
  },
  {
    id: 'gas_block_house', name: 'Aerated block house', short: 'GH', budgetMin: 1_900_000, budgetMax: 2_700_000, minReputation: 55,
    stages: [foundation(100, 40, 40), walls('Brick masonry', { gas_block: 800, concrete: 40 }, 60), roof(180, 40, 30, 40), finish({ insulation: 60, lumber: 50 }, 35)],
  },
  {
    id: 'hangar', name: 'Special project: Hangar', short: 'HG', budgetMin: 4_200_000, budgetMax: 6_000_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 8,
    stages: [
      foundation(180, 70, 65),
      walls('Frame assembly', { rebar: 120, lumber: 300 }, 110, ['crane']),
      roof(300, 80, 60, 70, ['crane']),
      finish({ insulation: 100, lumber: 90 }, 85),
    ],
  },
  {
    id: 'tv_tower', name: 'Special project: TV tower', short: 'TV', budgetMin: 6_500_000, budgetMax: 9_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 10,
    stages: [
      foundation(250, 100, 90),
      walls('Tower shaft', { concrete: 180, rebar: 160 }, 140, ['crane']),
      walls('Equipment installation', { rebar: 120, lumber: 250, insulation: 50 }, 120, ['crane']),
      roof(260, 60, 40, 80, ['crane']),
      finish({ insulation: 80, lumber: 70 }, 90),
    ],
  },
  {
    id: 'apartments', name: 'Special project: Apartments', short: 'AP', budgetMin: 5_200_000, budgetMax: 7_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 9,
    stages: [
      foundation(140, 55, 70),
      walls('Monolithic frame', { concrete: 120, rebar: 180 }, 130, ['crane']),
      walls('Floor slabs', { concrete: 100, rebar: 120 }, 115, ['crane']),
      roof(220, 60, 80, 65, ['crane']),
      finish({ insulation: 120, lumber: 110 }, 95),
    ],
  },
  {
    id: 'resort_house', name: 'Special project: Resort house', short: 'RH', budgetMin: 3_800_000, budgetMax: 5_200_000, minReputation: 75, special: true, requiredCrews: 1, reputationReward: 7,
    stages: [
      foundation(100, 40, 55),
      walls('Building frame', { lumber: 450, insulation: 50 }, 85, ['manipulator']),
      roof(160, 50, 80, 50, ['manipulator']),
      finish({ insulation: 120, lumber: 80 }, 70),
    ],
  },
  {
    id: 'park', name: 'Park and square', short: 'PK', budgetMin: 1_800_000, budgetMax: 2_800_000, minReputation: 70, requiredCrews: 1, reputationReward: 5, requiredLicense: 'city',
    stages: [
      foundation(50, 15, 35),
      walls('Paving and paths', { concrete: 80, brick: 500 }, 65, ['manipulator']),
      walls('Small architectural forms', { lumber: 250, insulation: 20 }, 60),
      finish({ lumber: 120, insulation: 20 }, 45),
    ],
  },
  {
    id: 'kindergarten', name: 'Kindergarten', short: 'KG', budgetMin: 6_000_000, budgetMax: 8_500_000, minReputation: 70, requiredCrews: 2, reputationReward: 6, requiredLicense: 'city',
    stages: [
      foundation(120, 45, 60),
      walls('Brick masonry', { gas_block: 700, concrete: 60 }, 95, ['manipulator']),
      roof(200, 60, 50, 60, ['crane']),
      finish({ insulation: 80, lumber: 60 }, 80),
    ],
  },
  {
    id: 'hospital', name: 'Hospital', short: 'HL', budgetMin: 12_000_000, budgetMax: 18_000_000, minReputation: 70, requiredCrews: 2, reputationReward: 9, requiredLicense: 'city',
    stages: [
      foundation(260, 110, 90),
      walls('Monolithic frame', { concrete: 220, rebar: 200 }, 170, ['crane']),
      walls('Slabs and roof', { concrete: 160, rebar: 140, metal_roof: 320, lumber: 90 }, 150, ['crane']),
      walls('Facade and utilities', { insulation: 240, lumber: 150 }, 130, ['manipulator']),
      finish({ insulation: 160, lumber: 120 }, 110),
    ],
  },
  {
    id: 'roads', name: 'Roads', short: 'RD', budgetMin: 10_000_000, budgetMax: 15_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 7, requiredLicense: 'region',
    stages: [
      foundation(150, 40, 60),
      walls('Road base', { concrete: 320, rebar: 180 }, 145, ['excavator', 'tractor']),
      walls('Pavement laying', { concrete: 400, rebar: 120 }, 175, ['excavator', 'mixer']),
      finish({ brick: 800, concrete: 100 }, 90),
    ],
  },
  {
    id: 'warehouses', name: 'Trade warehouses', short: 'TW', budgetMin: 14_000_000, budgetMax: 22_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 8, requiredLicense: 'region',
    stages: [
      foundation(240, 90, 85),
      walls('Building frames', { rebar: 260, lumber: 500 }, 155, ['crane']),
      roof(500, 120, 300, 145, ['crane']),
      walls('Ramps and platforms', { concrete: 200, brick: 600 }, 105, ['excavator', 'manipulator']),
      finish({ insulation: 200, lumber: 160 }, 115),
    ],
  },
  {
    id: 'thermal_plant', name: 'CHP plant', short: 'TP', budgetMin: 22_000_000, budgetMax: 32_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 10, requiredLicense: 'region',
    stages: [
      foundation(360, 150, 120),
      walls('Monolith and tower structures', { concrete: 320, rebar: 260 }, 205, ['crane']),
      walls('Process floors', { concrete: 240, rebar: 220, lumber: 300 }, 185, ['crane']),
      roof(400, 120, 300, 150, ['crane']),
      finish({ insulation: 260, lumber: 200 }, 135),
    ],
  },
  {
    id: 'school', name: 'School', short: 'SC', budgetMin: 8_500_000, budgetMax: 12_000_000, minReputation: 70, requiredCrews: 2, reputationReward: 7, requiredLicense: 'city',
    stages: [
      foundation(160, 65, 75),
      walls('Brick masonry', { gas_block: 900, concrete: 80 }, 110, ['manipulator']),
      roof(260, 80, 70, 85, ['crane']),
      finish({ insulation: 110, lumber: 90 }, 90),
    ],
  },
  {
    id: 'sports_complex', name: 'Sports complex', short: 'SP', budgetMin: 13_000_000, budgetMax: 19_000_000, minReputation: 70, requiredCrews: 2, reputationReward: 8, requiredLicense: 'city',
    stages: [
      foundation(210, 90, 95),
      walls('Monolithic frame', { concrete: 190, rebar: 170 }, 150, ['crane']),
      roof(340, 100, 120, 115, ['crane']),
      walls('Stands and partitions', { concrete: 140, brick: 400 }, 120, ['manipulator']),
      finish({ insulation: 140, lumber: 120 }, 110),
    ],
  },
  {
    id: 'bridge', name: 'Bridge', short: 'BR', budgetMin: 16_000_000, budgetMax: 24_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 8, requiredLicense: 'region',
    stages: [
      foundation(300, 130, 120),
      walls('Bridge piers', { concrete: 260, rebar: 220 }, 160, ['crane']),
      walls('Bridge span', { lumber: 300, rebar: 180 }, 170, ['crane']),
      walls('Road surface', { concrete: 320, rebar: 120, brick: 500 }, 150, ['excavator']),
      finish({ insulation: 60, lumber: 60 }, 70),
    ],
  },
  {
    id: 'ice_palace', name: 'Ice palace', short: 'IP', budgetMin: 26_000_000, budgetMax: 36_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 10, requiredLicense: 'region',
    stages: [
      foundation(300, 120, 115),
      walls('Monolithic frame', { concrete: 280, rebar: 240 }, 190, ['crane']),
      roof(420, 120, 130, 145, ['crane']),
      walls('Ice rink and stands', { concrete: 160, brick: 500 }, 130, ['manipulator']),
      finish({ insulation: 200, lumber: 160 }, 130),
    ],
  },
]

export const SUPPLIERS: Record<SupplierId, { name: string; short: string; description: string; feeRate: number; deliveryDays: number; initialPrice: number; initialStock: number }> = {
  north: { name: 'North Yard', short: 'N', description: 'Today · reliable stock', feeRate: 0.02, deliveryDays: 0, initialPrice: 1, initialStock: 1 },
  south: { name: 'South Yard', short: 'S', description: 'Tomorrow · −5% price', feeRate: 0.05, deliveryDays: 1, initialPrice: 0.95, initialStock: 0.75 },
}

export const WORKER_TYPES: Record<WorkerType, WorkerDef> = {
  handyman: { name: 'Handyman', efficiency: 0.8, rateMin: 800, rateMax: 1_200, teamBonus: 0 },
  specialist: { name: 'Specialist', efficiency: 1, rateMin: 1_200, rateMax: 1_600, teamBonus: 0 },
  foreman: { name: 'Foreman', efficiency: 1.1, rateMin: 1_800, rateMax: 2_300, teamBonus: 0.2 },
}

export const SKILLS: Record<SkillId, { name: string; description: string; speed: number; materialRate: number; logisticsRate: number; wageRate: number; teamBonus: number; equipmentBonusRate: number; allowsNight: boolean; negative: boolean }> = {
  alcohol: { name: 'Alcoholism', description: '−15% work speed', speed: -0.15, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  tudyaga: { name: 'Hard worker', description: '+3% work speed', speed: 0.03, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  owl: { name: 'Night owl', description: 'Evening shifts until midnight (90% efficiency). Rate +10%', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0.1, teamBonus: 0, equipmentBonusRate: 0, allowsNight: true, negative: false },
  thief: { name: 'Thief', description: '+5% project materials', speed: 0, materialRate: 0.05, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  thrifty: { name: 'Thrifty', description: '−4% project materials', speed: 0, materialRate: -0.04, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  mentor: { name: 'Mentor', description: '+0.06 efficiency to every crew member', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0.06, equipmentBonusRate: 0, allowsNight: false, negative: false },
  logistician: { name: 'Logistician', description: '−5% delivery cost for their project', speed: 0, materialRate: 0, logisticsRate: -0.05, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  technologist: { name: 'Technologist', description: '+3% equipment bonus', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0.03, allowsNight: false, negative: false },
  sluggish: { name: 'Sluggish', description: '−10% work speed', speed: -0.1, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  expensive: { name: 'Pricey specialist', description: '+15% to their wage rate', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0.15, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'excavator', name: 'Excavator', description: 'Foundation: +45% speed', price: 3_000_000, rentPerHour: 12_000, minRentHours: 8 },
  { id: 'crane', name: 'Crane', description: 'Roof: +20%, assembly: +10%; required for special projects', price: 5_000_000, rentPerHour: 20_000, minRentHours: 8 },
  { id: 'manipulator', name: 'Manipulator', description: 'Walls: +15%, finishing: +10%', price: 2_500_000, rentPerHour: 10_000, minRentHours: 8 },
  { id: 'tractor', name: 'Tractor', description: 'Foundation: +30% speed', price: 1_800_000, rentPerHour: 8_000, minRentHours: 8 },
  { id: 'mixer', name: 'Concrete mixer', description: 'Foundation access without bonus', price: 120_000, rentPerHour: 2_000, minRentHours: 8 },
]

export const PROVISIONS: ProvisionDef[] = [
  { id: 'cabins', name: 'Site cabin', description: 'Rest and storage', price: 250_000 },
  { id: 'toilet', name: 'Portable toilet', description: 'Sanitary facilities', price: 40_000 },
  { id: 'water', name: 'Water canister', description: 'Drinking and process water', price: 1_500 },
  { id: 'generator', name: 'Generator', description: 'Standalone electricity', price: 180_000 },
  { id: 'hand_tool', name: 'Hand tools', description: 'Basic crew kit', price: 50_000 },
]

export const TECHNOLOGIES: TechDef[] = [
  { id: 'planning_1', name: 'Planning I', branch: 'Management', cost: 300_000, days: 2, requires: '', requiresMoney: 0, description: 'Up to 2 active projects.' },
  { id: 'seasonal_planning', name: 'Seasonal planning', branch: 'Management', cost: 450_000, days: 3, requires: 'planning_1', requiresMoney: 0, description: 'Seasonal debuffs reduced by 20%.' },
  { id: 'project_coordination', name: 'Project coordination', branch: 'Management', cost: 500_000, days: 3, requires: 'seasonal_planning', requiresMoney: 0, description: 'New orders get +2 extra days.' },
  { id: 'city_license', name: 'City license', branch: 'Management', cost: 1_600_000, days: 5, requires: 'planning_1', requiresMoney: 0, requiresReputation: 70, requiresCapital: 10_000_000, description: 'Unlocks contracts: hospital, kindergarten, park, school, sports complex.' },
  { id: 'pr_department', name: 'PR department', branch: 'Management', cost: 1_200_000, days: 5, requires: 'city_license', requiresMoney: 0, description: '+2 reputation for every 5th completed project.' },
  { id: 'region_license', name: 'Regional license', branch: 'Management', cost: 3_200_000, days: 7, requires: 'city_license', requiresMoney: 0, requiresReputation: 80, requiresCapital: 15_000_000, description: 'Unlocks contracts: CHP plant, trade warehouses, roads, bridge, ice palace.' },
  { id: 'worker_training', name: 'Worker training', branch: 'Personnel', cost: 200_000, days: 2, requires: '', requiresMoney: 0, description: '+0.25 efficiency to every worker.' },
  { id: 'manpower_reserve', name: 'Manpower reserve', branch: 'Personnel', cost: 350_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: '+0.15 efficiency to every worker.' },
  { id: 'night_coordinator', name: 'Night coordinator', branch: 'Personnel', cost: 400_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: 'Night rate reduced by 15%.' },
  { id: 'prof_standards', name: 'Professional standards', branch: 'Personnel', cost: 800_000, days: 4, requires: 'worker_training', requiresMoney: 0, description: '+0.45 efficiency and a second crew.' },
  { id: 'automation', name: 'Automation', branch: 'Personnel', cost: 1_000_000, days: 5, requires: 'prof_standards', requiresMoney: 2_500_000, description: 'Night shifts for all crews: 24/7 construction, 75% night efficiency and ×1.5 pay.' },
  { id: 'bank_account', name: 'Bank account', branch: 'Finance', cost: 150_000, days: 1, requires: '', requiresMoney: 0, description: 'Unlocks loans, reporting and financial tools.' },
  { id: 'reserve_fund', name: 'Reserve fund', branch: 'Finance', cost: 400_000, days: 3, requires: 'bank_account', requiresMoney: 0, description: '+$500,000 from the fund at the start of each season.' },
  { id: 'overdraft', name: 'Overdraft', branch: 'Finance', cost: 350_000, days: 2, requires: 'bank_account', requiresMoney: 0, description: 'Debt up to $400,000 does not block work but grows 1% per day.' },
  { id: 'good_leasing', name: 'Favorable leasing', branch: 'Finance', cost: 500_000, days: 3, requires: 'bank_account', requiresMoney: 0, description: '8% discount on lease amount.' },
  { id: 'dealer_network', name: 'Dealer network', branch: 'Finance', cost: 500_000, days: 3, requires: 'good_leasing', requiresMoney: 0, description: 'Sell owned equipment for 85% of the price.' },
  { id: 'factoring', name: 'Factoring', branch: 'Finance', cost: 400_000, days: 4, requires: 'good_leasing', requiresMoney: 0, description: '40% advance on order, 1.5% fee.' },
]

export const CLIENTS = ['Anderson A.T.', 'Peterson M.S.', 'Hawkins C.L.', 'Mitchell E.N.', 'Morrison D.I.', 'Walker O.P.', 'Bennett R.G.', 'Foster T.A.']
export const WORKER_NAMES = ['Jack', 'James', 'William', 'Oliver', 'Henry', 'Benjamin', 'Daniel', 'Charles', 'Edward', 'George', 'Samuel', 'Thomas']

export const materialById = (id: string) => MATERIALS.find((item) => item.id === id)!
export const buildingById = (id: string) => BUILDINGS.find((item) => item.id === id)!
export const equipmentById = (id: string) => EQUIPMENT.find((item) => item.id === id)!
export const techById = (id: string) => TECHNOLOGIES.find((item) => item.id === id)!