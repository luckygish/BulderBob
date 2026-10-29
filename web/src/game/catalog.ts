import type { BuildingDef, EquipmentDef, EquipmentId, MaterialDef, ProvisionDef, SkillId, StageDef, SupplierId, TechDef, WorkerDef, WorkerType } from './types'

export const MATERIALS: MaterialDef[] = [
  { id: 'concrete', name: 'Бетон', short: 'БТ', unit: 'м³', basePrice: 4_500, stockMin: 100, stockMax: 1_275, dailyDemand: 150 },
  { id: 'rebar', name: 'Арматура', short: 'АР', unit: 'т', basePrice: 650, stockMin: 50, stockMax: 1_700, dailyDemand: 80 },
  { id: 'lumber', name: 'Доска', short: 'ДС', unit: 'м³', basePrice: 1_200, stockMin: 200, stockMax: 3_825, dailyDemand: 40 },
  { id: 'insulation', name: 'Утеплитель', short: 'УТ', unit: 'м²', basePrice: 800, stockMin: 50, stockMax: 1_275, dailyDemand: 50 },
  { id: 'metal_roof', name: 'Металлочерепица', short: 'МЧ', unit: 'м²', basePrice: 950, stockMin: 50, stockMax: 1_700, dailyDemand: 150 },
  { id: 'brick', name: 'Кирпич', short: 'КР', unit: 'уп.', basePrice: 65, stockMin: 200, stockMax: 3_400, dailyDemand: 600 },
  { id: 'gas_block', name: 'Газоблок', short: 'ГБ', unit: 'м³', basePrice: 85, stockMin: 100, stockMax: 3_400, dailyDemand: 50 },
]

const scaleHours = (hours: number): number => Math.round(hours * 115 / 100)

const foundation = (concrete: number, rebar: number, manHours: number): StageDef => ({
  id: 'foundation', name: 'Фундамент', materials: { concrete, rebar }, manHours: scaleHours(manHours),
  requiredEquipment: ['mixer', 'tractor', 'excavator'],
  equipmentBonus: { tractor: 0.3, excavator: 0.45 },
})
const walls = (name: string, materials: StageDef['materials'], manHours: number, requiredEquipment?: EquipmentId[]): StageDef => ({
  id: 'walls', name, materials, manHours: scaleHours(manHours), requiredEquipment,
  equipmentBonus: { manipulator: 0.15, crane: 0.1 },
})
const roof = (metalRoof: number, lumber: number, insulation: number, manHours: number, requiredEquipment?: EquipmentId[]): StageDef => ({
  id: 'roof', name: 'Кровля', materials: { metal_roof: metalRoof, lumber, insulation }, manHours: scaleHours(manHours), requiredEquipment,
  equipmentBonus: { crane: 0.2 },
})
const finish = (materials: StageDef['materials'], manHours: number): StageDef => ({
  id: 'finish', name: 'Отделка', materials, manHours: scaleHours(manHours),
  equipmentBonus: { manipulator: 0.1 },
})

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'reconstruction', name: 'Реконструкция', short: 'РК', budgetMin: 550_000, budgetMax: 850_000, minReputation: 0,
    stages: [foundation(9, 3, 12), walls('Стены и каркас', { lumber: 150, insulation: 12 }, 20), roof(36, 6, 0, 7), finish({ insulation: 6, lumber: 9 }, 10)],
  },
  {
    id: 'frame_house', name: 'Каркасный дом', short: 'КД', budgetMin: 1_450_000, budgetMax: 2_000_000, minReputation: 40,
    stages: [foundation(30, 10, 30), walls('Стены и каркас', { lumber: 500, insulation: 40 }, 70), roof(120, 20, 0, 34), finish({ insulation: 20, lumber: 30 }, 42)],
  },
  {
    id: 'brick_house', name: 'Кирпичный дом', short: 'КМ', budgetMin: 1_800_000, budgetMax: 2_600_000, minReputation: 60,
    stages: [foundation(100, 40, 40), walls('Кладка стен', { brick: 800, concrete: 40 }, 90), roof(180, 40, 30, 40), finish({ insulation: 60, lumber: 50 }, 78)],
  },
  {
    id: 'gas_block_house', name: 'Дом из газоблоков', short: 'ГД', budgetMin: 1_900_000, budgetMax: 2_700_000, minReputation: 55,
    stages: [foundation(100, 40, 40), walls('Кладка стен', { gas_block: 800, concrete: 40 }, 60), roof(180, 40, 30, 40), finish({ insulation: 60, lumber: 50 }, 35)],
  },
  {
    id: 'hangar', name: 'Особый проект: Ангар', short: 'АН', budgetMin: 4_200_000, budgetMax: 6_000_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 8,
    stages: [
      foundation(180, 70, 65),
      walls('Монтаж каркаса', { rebar: 120, lumber: 300 }, 110, ['crane']),
      roof(300, 80, 60, 70, ['crane']),
      finish({ insulation: 100, lumber: 90 }, 85),
    ],
  },
  {
    id: 'tv_tower', name: 'Особый проект: Телевышка', short: 'ТВ', budgetMin: 6_500_000, budgetMax: 9_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 10,
    stages: [
      foundation(250, 100, 90),
      walls('Башенный ствол', { concrete: 180, rebar: 160 }, 140, ['crane']),
      walls('Монтаж оборудования', { rebar: 120, lumber: 250, insulation: 50 }, 120, ['crane']),
      roof(260, 60, 40, 80, ['crane']),
      finish({ insulation: 80, lumber: 70 }, 90),
    ],
  },
  {
    id: 'apartments', name: 'Особый проект: Апартаменты', short: 'АП', budgetMin: 5_200_000, budgetMax: 7_500_000, minReputation: 75, special: true, requiredCrews: 2, reputationReward: 9,
    stages: [
      foundation(140, 55, 70),
      walls('Монолитный каркас', { concrete: 120, rebar: 180 }, 130, ['crane']),
      walls('Перекрытия', { concrete: 100, rebar: 120 }, 115, ['crane']),
      roof(220, 60, 80, 65, ['crane']),
      finish({ insulation: 120, lumber: 110 }, 95),
    ],
  },
  {
    id: 'resort_house', name: 'Особый проект: Дом отдыха', short: 'ДО', budgetMin: 3_800_000, budgetMax: 5_200_000, minReputation: 75, special: true, requiredCrews: 1, reputationReward: 7,
    stages: [
      foundation(100, 40, 55),
      walls('Каркас корпуса', { lumber: 450, insulation: 50 }, 85, ['manipulator']),
      roof(160, 50, 80, 50, ['manipulator']),
      finish({ insulation: 120, lumber: 80 }, 70),
    ],
  },
  {
    id: 'park', name: 'Парк и сквер', short: 'ПР', budgetMin: 1_800_000, budgetMax: 2_800_000, minReputation: 70, requiredCrews: 1, reputationReward: 5, requiredLicense: 'city',
    stages: [
      foundation(50, 15, 35),
      walls('Мощение и дорожки', { concrete: 80, brick: 500 }, 65, ['manipulator']),
      walls('Малые архитектурные формы', { lumber: 250, insulation: 20 }, 60),
      finish({ lumber: 120, insulation: 20 }, 45),
    ],
  },
  {
    id: 'kindergarten', name: 'Детский сад', short: 'ДС', budgetMin: 6_000_000, budgetMax: 8_500_000, minReputation: 70, requiredCrews: 2, reputationReward: 6, requiredLicense: 'city',
    stages: [
      foundation(120, 45, 60),
      walls('Кладка стен', { gas_block: 700, concrete: 60 }, 95, ['manipulator']),
      roof(200, 60, 50, 60, ['crane']),
      finish({ insulation: 80, lumber: 60 }, 80),
    ],
  },
  {
    id: 'hospital', name: 'Больница', short: 'БЛ', budgetMin: 12_000_000, budgetMax: 18_000_000, minReputation: 70, requiredCrews: 2, reputationReward: 9, requiredLicense: 'city',
    stages: [
      foundation(260, 110, 90),
      walls('Монолитный каркас', { concrete: 220, rebar: 200 }, 170, ['crane']),
      walls('Перекрытия и кровля', { concrete: 160, rebar: 140, metal_roof: 320, lumber: 90 }, 150, ['crane']),
      walls('Фасад и инженерия', { insulation: 240, lumber: 150 }, 130, ['manipulator']),
      finish({ insulation: 160, lumber: 120 }, 110),
    ],
  },
  {
    id: 'roads', name: 'Дороги', short: 'ДР', budgetMin: 10_000_000, budgetMax: 15_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 7, requiredLicense: 'region',
    stages: [
      foundation(150, 40, 60),
      walls('Дорожное основание', { concrete: 320, rebar: 180 }, 145, ['excavator', 'tractor']),
      walls('Укладка покрытия', { concrete: 400, rebar: 120 }, 175, ['excavator', 'mixer']),
      finish({ brick: 800, concrete: 100 }, 90),
    ],
  },
  {
    id: 'warehouses', name: 'Торговые склады', short: 'ТС', budgetMin: 14_000_000, budgetMax: 22_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 8, requiredLicense: 'region',
    stages: [
      foundation(240, 90, 85),
      walls('Каркасы корпусов', { rebar: 260, lumber: 500 }, 155, ['crane']),
      roof(500, 120, 300, 145, ['crane']),
      walls('Рампы и площадки', { concrete: 200, brick: 600 }, 105, ['excavator', 'manipulator']),
      finish({ insulation: 200, lumber: 160 }, 115),
    ],
  },
  {
    id: 'thermal_plant', name: 'ТЭЦ', short: 'ТЦ', budgetMin: 22_000_000, budgetMax: 32_000_000, minReputation: 80, requiredCrews: 2, reputationReward: 10, requiredLicense: 'region',
    stages: [
      foundation(360, 150, 120),
      walls('Монолит и башенные сооружения', { concrete: 320, rebar: 260 }, 205, ['crane']),
      walls('Технологические этажи', { concrete: 240, rebar: 220, lumber: 300 }, 185, ['crane']),
      roof(400, 120, 300, 150, ['crane']),
      finish({ insulation: 260, lumber: 200 }, 135),
    ],
  },
]

export const SUPPLIERS: Record<SupplierId, { name: string; short: string; description: string; feeRate: number; deliveryDays: number; initialPrice: number; initialStock: number }> = {
  north: { name: 'База Север', short: 'С', description: 'Сегодня · надёжные остатки', feeRate: 0.02, deliveryDays: 0, initialPrice: 1, initialStock: 1 },
  south: { name: 'База Юг', short: 'Ю', description: 'Завтра · −5% к цене', feeRate: 0.05, deliveryDays: 1, initialPrice: 0.95, initialStock: 0.75 },
}

export const WORKER_TYPES: Record<WorkerType, WorkerDef> = {
  handyman: { name: 'Разнорабочий', efficiency: 0.8, rateMin: 800, rateMax: 1_200, teamBonus: 0 },
  specialist: { name: 'Специалист', efficiency: 1, rateMin: 1_200, rateMax: 1_600, teamBonus: 0 },
  foreman: { name: 'Прораб', efficiency: 1.1, rateMin: 1_800, rateMax: 2_300, teamBonus: 0.2 },
}

export const SKILLS: Record<SkillId, { name: string; description: string; speed: number; materialRate: number; logisticsRate: number; wageRate: number; teamBonus: number; equipmentBonusRate: number; allowsNight: boolean; negative: boolean }> = {
  alcohol: { name: 'Алкоголизм', description: '−15% скорости', speed: -0.15, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  tudyaga: { name: 'Трудяга', description: '+3% скорости', speed: 0.03, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  owl: { name: 'Сова', description: 'Вечерние смены до полуночи (КПД 90%). Ставка +10%', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0.1, teamBonus: 0, equipmentBonusRate: 0, allowsNight: true, negative: false },
  thief: { name: 'Вор', description: '+5% к материалам проекта', speed: 0, materialRate: 0.05, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  thrifty: { name: 'Бережливый', description: '−4% к материалам проекта', speed: 0, materialRate: -0.04, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  mentor: { name: 'Наставник', description: '+0.06 эффективности каждому члену бригады', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0.06, equipmentBonusRate: 0, allowsNight: false, negative: false },
  logistician: { name: 'Логист', description: '−5% к доставке его объекта', speed: 0, materialRate: 0, logisticsRate: -0.05, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: false },
  technologist: { name: 'Технолог', description: '+3% к бонусу техники', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0.03, allowsNight: false, negative: false },
  sluggish: { name: 'Медлительный', description: '−10% скорости', speed: -0.1, materialRate: 0, logisticsRate: 0, wageRate: 0, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
  expensive: { name: 'Дорогой специалист', description: '+15% к его ставке', speed: 0, materialRate: 0, logisticsRate: 0, wageRate: 0.15, teamBonus: 0, equipmentBonusRate: 0, allowsNight: false, negative: true },
}

export const EQUIPMENT: EquipmentDef[] = [
  { id: 'excavator', name: 'Экскаватор', description: 'Фундамент: +45% скорости', price: 3_000_000, rentPerHour: 12_000, minRentHours: 8 },
  { id: 'crane', name: 'Кран', description: 'Кровля: +20%, монтаж: +10%; нужен особым проектам', price: 5_000_000, rentPerHour: 20_000, minRentHours: 8 },
  { id: 'manipulator', name: 'Манипулятор', description: 'Стены: +15%, отделка: +10%', price: 2_500_000, rentPerHour: 10_000, minRentHours: 8 },
  { id: 'tractor', name: 'Трактор', description: 'Фундамент: +30% скорости', price: 1_800_000, rentPerHour: 8_000, minRentHours: 8 },
  { id: 'mixer', name: 'Бетономешалка', description: 'Допуск к фундаменту без бонуса', price: 120_000, rentPerHour: 2_000, minRentHours: 8 },
]

export const PROVISIONS: ProvisionDef[] = [
  { id: 'cabins', name: 'Бытовка', description: 'Отдых и хранение', price: 250_000 },
  { id: 'toilet', name: 'Биотуалет', description: 'Санитарные условия', price: 40_000 },
  { id: 'water', name: 'Канистра воды', description: 'Питьевая и техническая вода', price: 1_500 },
  { id: 'generator', name: 'Генератор', description: 'Автономное электричество', price: 180_000 },
  { id: 'hand_tool', name: 'Ручной инструмент', description: 'Базовый комплект бригады', price: 50_000 },
]

export const TECHNOLOGIES: TechDef[] = [
  { id: 'planning_1', name: 'Планирование I', branch: 'Управление', cost: 300_000, days: 2, requires: '', requiresMoney: 0, description: 'До 2 активных объектов.' },
  { id: 'seasonal_planning', name: 'Сезонное планирование', branch: 'Управление', cost: 450_000, days: 3, requires: 'planning_1', requiresMoney: 0, description: 'Сезонные дебаффы снижены на 20%.' },
  { id: 'project_coordination', name: 'Согласование проектов', branch: 'Управление', cost: 500_000, days: 3, requires: 'seasonal_planning', requiresMoney: 0, description: 'Сроки новых заказов +2 дня.' },
  { id: 'city_license', name: 'Городская лицензия', branch: 'Управление', cost: 1_600_000, days: 5, requires: 'planning_1', requiresMoney: 0, requiresReputation: 70, requiresCapital: 10_000_000, description: 'Открывает контракты: больница, детский сад, парк.' },
  { id: 'pr_department', name: 'PR-департамент', branch: 'Управление', cost: 1_200_000, days: 5, requires: 'city_license', requiresMoney: 0, description: '+2 репутации за каждый 5-й сданный объект.' },
  { id: 'region_license', name: 'Областная лицензия', branch: 'Управление', cost: 3_200_000, days: 7, requires: 'city_license', requiresMoney: 0, requiresReputation: 80, requiresCapital: 15_000_000, description: 'Открывает контракты: ТЭЦ, торговые склады, дороги.' },
  { id: 'worker_training', name: 'Обучение рабочих', branch: 'Персонал', cost: 200_000, days: 2, requires: '', requiresMoney: 0, description: '+0.25 эффективности каждому работнику.' },
  { id: 'manpower_reserve', name: 'Кадровый резерв', branch: 'Персонал', cost: 350_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: '+0.15 эффективности каждому работнику.' },
  { id: 'night_coordinator', name: 'Ночной координатор', branch: 'Персонал', cost: 400_000, days: 3, requires: 'worker_training', requiresMoney: 0, description: 'Ночной тариф снижен на 15%.' },
  { id: 'prof_standards', name: 'Профстандарты', branch: 'Персонал', cost: 800_000, days: 4, requires: 'worker_training', requiresMoney: 0, description: '+0.45 эффективности и вторая бригада.' },
  { id: 'automation', name: 'Автоматизация', branch: 'Персонал', cost: 1_000_000, days: 5, requires: 'prof_standards', requiresMoney: 2_500_000, description: 'Ночные смены всем бригадам: стройка 24/7, ночной КПД 75% и оплата ×1.5.' },
  { id: 'bank_account', name: 'Банковский счёт', branch: 'Финансы', cost: 150_000, days: 1, requires: '', requiresMoney: 0, description: 'Открывает кредиты, отчётность и финансовые инструменты.' },
  { id: 'reserve_fund', name: 'Резервный фонд', branch: 'Финансы', cost: 400_000, days: 3, requires: 'bank_account', requiresMoney: 0, description: 'В начале каждого сезона +500 000 ₽ из фонда.' },
  { id: 'overdraft', name: 'Овердрафт', branch: 'Финансы', cost: 350_000, days: 2, requires: 'bank_account', requiresMoney: 0, description: 'Долг до 400 000 ₽ не блокирует работу, но растёт на 1% в день.' },
  { id: 'good_leasing', name: 'Выгодный лизинг', branch: 'Финансы', cost: 500_000, days: 3, requires: 'bank_account', requiresMoney: 0, description: 'Скидка 8% на сумму лизинга.' },
  { id: 'dealer_network', name: 'Дилерская сеть', branch: 'Финансы', cost: 500_000, days: 3, requires: 'good_leasing', requiresMoney: 0, description: 'Продажа собственной техники за 85% цены.' },
  { id: 'factoring', name: 'Факторинг', branch: 'Финансы', cost: 400_000, days: 4, requires: 'good_leasing', requiresMoney: 0, description: 'Аванс 40% при заказе, комиссия 1,5%.' },
]

export const CLIENTS = ['Иванов А.В.', 'Петрова М.С.', 'Сидоров К.Л.', 'Козлова Е.Н.', 'Морозов Д.И.', 'Волкова О.П.', 'Новиков Р.Г.', 'Фёдорова Т.А.']
export const WORKER_NAMES = ['Алексей', 'Борис', 'Виктор', 'Григорий', 'Дмитрий', 'Егор', 'Женя', 'Илья', 'Кирилл', 'Михаил', 'Олег', 'Павел']

export const materialById = (id: string) => MATERIALS.find((item) => item.id === id)!
export const buildingById = (id: string) => BUILDINGS.find((item) => item.id === id)!
export const equipmentById = (id: string) => EQUIPMENT.find((item) => item.id === id)!
export const techById = (id: string) => TECHNOLOGIES.find((item) => item.id === id)!
