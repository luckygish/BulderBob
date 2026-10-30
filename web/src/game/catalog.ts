import type { BuildingDef, EquipmentDef, EquipmentId, MaterialDef, ProvisionDef, SkillId, StageDef, SupplierId, TechDef, WorkerDef, WorkerType } from './types'

export const MATERIALS: MaterialDef[] = [
  { id: 'concrete', name: 'Concrete', short: 'CR', unit: 'm³', basePrice: 4_700, stockMin: 96, stockMax: 1_709, dailyDemand: 202 },
  { id: 'rebar', name: 'Rebar', short: 'RB', unit: 'kg', basePrice: 52, stockMin: 625, stockMax: 29_750, dailyDemand: 1_400 },
  { id: 'lumber', name: 'Lumber', short: 'LB', unit: 'm³', basePrice: 17_000, stockMin: 500, stockMax: 3_220, dailyDemand: 34 },
  { id: 'insulation', name: 'Insulation', short: 'IN', unit: 'm²', basePrice: 140, stockMin: 300, stockMax: 3_080, dailyDemand: 120 },
  { id: 'metal_roof', name: 'Metal roofing', short: 'MR', unit: 'm²', basePrice: 970, stockMin: 120, stockMax: 2_380, dailyDemand: 210 },
  { id: 'brick', name: 'Brick', short: 'BK', unit: 'pcs', basePrice: 15, stockMin: 867, stockMax: 20_626, dailyDemand: 3_640 },
  { id: 'gas_block', name: 'Aerated block', short: 'GB', unit: 'm³', basePrice: 6_200, stockMin: 700, stockMax: 4_200, dailyDemand: 62 },
]

const scaleHours = (hours: number): number => Math.round(hours * 138 / 100)

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
    stages: [foundation(8.6, 38, 12), walls('Walls & frame', { lumber: 11, insulation: 69 }, 20), roof(35, 0.4, 0, 7), finish({ insulation: 34, lumber: 0.6 }, 10)],
  },
  {
    id: 'frame_house', name: 'Frame house', short: 'FH', budgetMin: 1_450_000, budgetMax: 2_000_000, minReputation: 40,
    stages: [foundation(29, 125, 30), walls('Walls & frame', { lumber: 35, insulation: 229 }, 70), roof(118, 1.4, 0, 34), finish({ insulation: 114, lumber: 2.1 }, 42)],
  },
  {
    id: 'brick_house', name: 'Brick house', short: 'BH', budgetMin: 1_800_000, budgetMax: 2_600_000, minReputation: 60,
    stages: [foundation(96, 500, 40), walls('Brick masonry', { brick: 3_467, concrete: 38 }, 90), roof(176, 2.8, 171, 40), finish({ insulation: 343, lumber: 3.5 }, 78)],
  },
  {
    id: 'gas_block_house', name: 'Aerated block house', short: 'GH', budgetMin: 1_900_000, budgetMax: 2_700_000, minReputation: 55,
    stages: [foundation(96, 500, 40), walls('Brick masonry', { gas_block: 11, concrete: 38 }, 60), roof(176, 2.8, 171, 40), finish({ insulation: 343, lumber: 3.5 }, 35)],
  },
  {
    id: 'hangar', name: 'Special project: Hangar', short: 'HG', budgetMin: 4_200_000, budgetMax: 6_000_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 8,
    stages: [
      foundation(172, 875, 65),
      walls('Frame assembly', { rebar: 1_500, lumber: 21 }, 110, ['crane']),
      roof(294, 5.6, 343, 70, ['crane']),
      finish({ insulation: 571, lumber: 6.4 }, 85),
    ],
  },
  {
    id: 'tv_tower', name: 'Special project: TV tower', short: 'TV', budgetMin: 6_500_000, budgetMax: 9_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 10,
    stages: [
      foundation(239, 1_250, 90),
      walls('Tower shaft', { concrete: 172, rebar: 2_000 }, 140, ['crane']),
      walls('Equipment installation', { rebar: 1_500, lumber: 18, insulation: 286 }, 120, ['crane']),
      roof(255, 4.2, 229, 80, ['crane']),
      finish({ insulation: 457, lumber: 4.9 }, 90),
    ],
  },
  {
    id: 'apartments', name: 'Special project: Apartments', short: 'AP', budgetMin: 5_200_000, budgetMax: 7_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 9,
    stages: [
      foundation(134, 688, 70),
      walls('Monolithic frame', { concrete: 115, rebar: 2_250 }, 130, ['crane']),
      walls('Floor slabs', { concrete: 96, rebar: 1_500 }, 115, ['crane']),
      roof(215, 4.2, 457, 65, ['crane']),
      finish({ insulation: 686, lumber: 7.8 }, 95),
    ],
  },
  {
    id: 'resort_house', name: 'Special project: Resort house', short: 'RH', budgetMin: 3_800_000, budgetMax: 5_200_000, minReputation: 75, special: true, requiredCrews: 1, reputationReward: 7,
    stages: [
      foundation(96, 500, 55),
      walls('Building frame', { lumber: 32, insulation: 286 }, 85, ['manipulator']),
      roof(157, 3.5, 457, 50, ['manipulator']),
      finish({ insulation: 686, lumber: 5.6 }, 70),
    ],
  },
  {
    id: 'park', name: 'Park and square', short: 'PK', budgetMin: 1_500_000, budgetMax: 2_400_000, minReputation: 70, requiredCrews: 1, reputationReward: 5, requiredLicense: 'city',
    stages: [
      foundation(48, 188, 42),
      walls('Paving and paths', { concrete: 77, brick: 2_167 }, 78, ['manipulator']),
      walls('Small architectural forms', { lumber: 18, insulation: 114 }, 72),
      finish({ lumber: 8.5, insulation: 114 }, 54),
    ],
  },
  {
    id: 'kindergarten', name: 'Kindergarten', short: 'KG', budgetMin: 5_100_000, budgetMax: 7_200_000, minReputation: 70, requiredCrews: 2, reputationReward: 6, requiredLicense: 'city',
    stages: [
      foundation(115, 563, 72),
      walls('Brick masonry', { gas_block: 9.6, concrete: 57 }, 114, ['manipulator']),
      roof(196, 4.2, 286, 72, ['crane']),
      finish({ insulation: 457, lumber: 4.2 }, 96),
    ],
  },
  {
    id: 'hospital', name: 'Hospital', short: 'HL', budgetMin: 10_200_000, budgetMax: 15_300_000, minReputation: 70, requiredCrews: 2, reputationReward: 9, requiredLicense: 'city',
    stages: [
      foundation(249, 1_375, 108),
      walls('Monolithic frame', { concrete: 211, rebar: 2_500 }, 204, ['crane']),
      walls('Slabs and roof', { concrete: 153, rebar: 1_750, metal_roof: 313, lumber: 6.4 }, 180, ['crane']),
      walls('Facade and utilities', { insulation: 1_371, lumber: 11 }, 156, ['manipulator']),
      finish({ insulation: 914, lumber: 8.5 }, 132),
    ],
  },
  {
    id: 'roads', name: 'Roads', short: 'RD', budgetMin: 8_500_000, budgetMax: 12_800_000, minReputation: 80, requiredCrews: 2, reputationReward: 7, requiredLicense: 'region', minSiteWorkers: 8,
    stages: [
      foundation(144, 500, 72),
      walls('Road base', { concrete: 306, rebar: 2_250 }, 174, ['excavator', 'tractor']),
      walls('Pavement laying', { concrete: 383, rebar: 1_500 }, 210, ['excavator', 'mixer']),
      finish({ brick: 3_467, concrete: 96 }, 108),
    ],
  },
  {
    id: 'warehouses', name: 'Trade warehouses', short: 'TW', budgetMin: 11_900_000, budgetMax: 18_700_000, minReputation: 80, requiredCrews: 2, reputationReward: 8, requiredLicense: 'region', minSiteWorkers: 8,
    stages: [
      foundation(230, 1_125, 102),
      walls('Building frames', { rebar: 3_250, lumber: 35 }, 186, ['crane']),
      roof(490, 8.5, 1_714, 174, ['crane']),
      walls('Ramps and platforms', { concrete: 191, brick: 2_600 }, 126, ['excavator', 'manipulator']),
      finish({ insulation: 1_143, lumber: 11 }, 138),
    ],
  },
  {
    id: 'thermal_plant', name: 'CHP plant', short: 'TP', budgetMin: 18_700_000, budgetMax: 27_200_000, minReputation: 80, requiredCrews: 2, reputationReward: 10, requiredLicense: 'region', minSiteWorkers: 8,
    stages: [
      foundation(345, 1_875, 144),
      walls('Monolith and tower structures', { concrete: 306, rebar: 3_250 }, 246, ['crane']),
      walls('Process floors', { concrete: 230, rebar: 2_750, lumber: 21 }, 222, ['crane']),
      roof(392, 8.5, 1_714, 180, ['crane']),
      finish({ insulation: 1_486, lumber: 14 }, 162),
    ],
  },
  {
    id: 'school', name: 'School', short: 'SC', budgetMin: 7_200_000, budgetMax: 10_200_000, minReputation: 70, requiredCrews: 2, reputationReward: 7, requiredLicense: 'city',
    stages: [
      foundation(153, 813, 90),
      walls('Brick masonry', { gas_block: 12.3, concrete: 77 }, 132, ['manipulator']),
      roof(255, 5.6, 400, 102, ['crane']),
      finish({ insulation: 629, lumber: 6.4 }, 108),
    ],
  },
  {
    id: 'sports_complex', name: 'Sports complex', short: 'SP', budgetMin: 11_000_000, budgetMax: 16_200_000, minReputation: 70, requiredCrews: 2, reputationReward: 8, requiredLicense: 'city',
    stages: [
      foundation(201, 1_125, 114),
      walls('Monolithic frame', { concrete: 182, rebar: 2_125 }, 180, ['crane']),
      roof(333, 7.1, 686, 138, ['crane']),
      walls('Stands and partitions', { concrete: 134, brick: 1_733 }, 144, ['manipulator']),
      finish({ insulation: 800, lumber: 8.5 }, 132),
    ],
  },
  {
    id: 'bridge', name: 'Bridge', short: 'BR', budgetMin: 13_600_000, budgetMax: 20_400_000, minReputation: 80, requiredCrews: 2, reputationReward: 8, requiredLicense: 'region', minSiteWorkers: 8,
    stages: [
      foundation(287, 1_625, 144),
      walls('Bridge piers', { concrete: 249, rebar: 2_750 }, 192, ['crane']),
      walls('Bridge span', { lumber: 21, rebar: 2_250 }, 204, ['crane']),
      walls('Road surface', { concrete: 306, rebar: 1_500, brick: 2_167 }, 180, ['excavator']),
      finish({ insulation: 343, lumber: 4.2 }, 84),
    ],
  },
  {
    id: 'ice_palace', name: 'Ice palace', short: 'IP', budgetMin: 22_100_000, budgetMax: 30_600_000, minReputation: 80, requiredCrews: 2, reputationReward: 10, requiredLicense: 'region', minSiteWorkers: 8,
    stages: [
      foundation(287, 1_500, 138),
      walls('Monolithic frame', { concrete: 268, rebar: 3_000 }, 228, ['crane']),
      roof(411, 8.5, 743, 174, ['crane']),
      walls('Ice rink and stands', { concrete: 153, brick: 2_167 }, 156, ['manipulator']),
      finish({ insulation: 1_143, lumber: 11 }, 156),
    ],
  },
]

export const SUPPLIERS: Record<SupplierId, { name: string; short: string; description: string; feeRate: number; deliveryDays: number; deliveryHours: number; initialPrice: number; initialStock: number }> = {
  north: { name: 'North Yard', short: 'N', description: 'Today · reliable stock', feeRate: 0.02, deliveryDays: 0, deliveryHours: 3, initialPrice: 1, initialStock: 1 },
  south: { name: 'South Yard', short: 'S', description: 'Tomorrow · −5% price', feeRate: 0.05, deliveryDays: 1, deliveryHours: 0, initialPrice: 0.95, initialStock: 0.75 },
}

export const WORKER_TYPES: Record<WorkerType, WorkerDef> = {
  handyman: { name: 'Handyman', efficiency: 0.8, rateMin: 960, rateMax: 1_440, teamBonus: 0 },
  specialist: { name: 'Specialist', efficiency: 1, rateMin: 1_440, rateMax: 1_920, teamBonus: 0 },
  foreman: { name: 'Foreman', efficiency: 1.1, rateMin: 2_160, rateMax: 2_760, teamBonus: 0.2 },
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
  { id: 'city_license', name: 'City license', branch: 'Management', cost: 2_080_000, days: 5, requires: 'planning_1', requiresMoney: 0, requiresReputation: 70, requiresCapital: 10_000_000, description: 'Unlocks contracts: hospital, kindergarten, park, school, sports complex.' },
  { id: 'pr_department', name: 'PR department', branch: 'Management', cost: 1_200_000, days: 5, requires: 'city_license', requiresMoney: 0, description: '+2 reputation for every 5th completed project.' },
  { id: 'region_license', name: 'Regional license', branch: 'Management', cost: 4_160_000, days: 7, requires: 'city_license', requiresMoney: 0, requiresReputation: 80, requiresCapital: 15_000_000, description: 'Unlocks contracts: CHP plant, trade warehouses, roads, bridge, ice palace.' },
  { id: 'worker_training', name: 'Worker training', branch: 'Personnel', cost: 200_000, days: 2, requires: '', requiresMoney: 0, description: '+0.25 efficiency to every worker.' },
  { id: 'manpower_reserve', name: 'Manpower reserve', branch: 'Personnel', cost: 350_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: '+0.15 efficiency to every worker.' },
  { id: 'night_coordinator', name: 'Night coordinator', branch: 'Personnel', cost: 400_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: 'Night rate reduced by 15%.' },
  { id: 'prof_standards', name: 'Professional standards', branch: 'Personnel', cost: 800_000, days: 4, requires: 'worker_training', requiresMoney: 0, description: '+0.45 efficiency and a second crew.' },
  { id: 'automation', name: 'Automation', branch: 'Personnel', cost: 1_000_000, days: 5, requires: 'prof_standards', requiresMoney: 2_500_000, description: 'Night shifts for all crews: 24/7 construction, 75% night efficiency and ×1.5 pay.' },
  { id: 'build_squad', name: 'Build squad', branch: 'Personnel', cost: 1_500_000, days: 5, requires: 'automation', requiresMoney: 4_000_000, description: 'Hire up to 5 people in each crew. Required for regional licensed contracts (8 workers on site).' },
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