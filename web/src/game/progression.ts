import { addLog, maxCrews, missingProvisions, netWorth } from './engine'
import type { GameState } from './types'

export interface TutorialStep {
  id: string
  title: string
  description: string
  route: 'overview' | 'jobs' | 'construction' | 'market' | 'hr' | 'equipment' | 'technology' | 'bank'
  reward: number
  done: (state: GameState) => boolean
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'first_job', title: 'Возьмите первый заказ', description: 'На доске заказов выберите доступный подряд и создайте первый объект.', route: 'jobs', reward: 2, done: (state) => state.projects.length > 0 || state.completed.length > 0 },
  { id: 'hire_two', title: 'Наймите двух работников', description: 'В разделе «Кадры» соберите стартовую бригаду.', route: 'hr', reward: 0, done: (state) => state.crews.reduce((sum, crew) => sum + crew.workers.length, 0) >= 2 },
  { id: 'assign_crew', title: 'Назначьте бригаду на объект', description: 'В строительстве выберите подготовленную бригаду.', route: 'construction', reward: 0, done: (state) => state.projects.some((project) => project.crewIds.some((crewId) => state.crews[crewId]?.workers.length)) },
  { id: 'foundation_machine', title: 'Обеспечьте технику фундамента', description: 'Купите или арендуйте бетономешалку, трактор либо экскаватор.', route: 'equipment', reward: 0, done: (state) => state.equipment.some((asset) => ['mixer', 'tractor', 'excavator'].includes(asset.id)) },
  { id: 'site_setup', title: 'Укомплектуйте обеспечение площадки', description: 'На каждый активный объект нужен полный комплект бытовки, санитарии, воды, генератора и инструмента.', route: 'equipment', reward: 2, done: (state) => Object.keys(missingProvisions(state)).length === 0 },
  { id: 'reserve_materials', title: 'Зарезервируйте материалы', description: 'На рынке выберите объект и нажмите «Закупить недостающее». Партии не уйдут к другому проекту.', route: 'market', reward: 0, done: (state) => state.projects.some((project) => Object.values(project.reserved).some((batches) => batches.reduce((sum, batch) => sum + batch.qty, 0) > 0)) },
  { id: 'start_building', title: 'Запустите стройку', description: 'Запустите текущий этап или всю стройку после обеспечения ресурсами.', route: 'construction', reward: 0, done: (state) => state.projects.some((project) => project.started) },
  { id: 'first_delivery', title: 'Сдайте первый объект', description: 'Доведите все этапы до конца и получите финансовый отчёт.', route: 'construction', reward: 0, done: (state) => state.completed.length > 0 },
  { id: 'research_tech', title: 'Исследуйте технологию', description: 'Инвестируйте прибыль в планирование, персонал или финансы.', route: 'technology', reward: 0, done: (state) => Object.values(state.research).some((research) => research.status === 'done') },
  { id: 'bonus_machine', title: 'Купите технику с бонусом этапа', description: 'Трактор, экскаватор, манипулятор и кран ускоряют подходящие этапы.', route: 'equipment', reward: 0, done: (state) => state.equipment.some((asset) => ['tractor', 'excavator', 'manipulator', 'crane'].includes(asset.id)) },
  { id: 'two_suppliers', title: 'Используйте обе базы', description: 'Сравните «Север» и «Юг»: у них разные цены и сроки доставки.', route: 'market', reward: 0, done: (state) => state.usedSuppliers.length >= 2 },
  { id: 'hire_foreman', title: 'Наймите прораба', description: 'Прораб усиливает остальных членов бригады.', route: 'hr', reward: 0, done: (state) => state.crews.some((crew) => crew.workers.some((worker) => worker.type === 'foreman')) },
  { id: 'second_project', title: 'Возьмите второй объект', description: 'Расширяйтесь: одновременно можно готовить несколько объектов после исследования планирования.', route: 'jobs', reward: 0, done: (state) => state.projects.length + state.completed.length >= 2 },
  { id: 'open_bank', title: 'Откройте банковский счёт или кредит', description: 'Финансовая ветка открывает кредит, выгодный лизинг и факторинг.', route: 'bank', reward: 0, done: (state) => state.loan !== null || state.research.bank_account?.status === 'done' },
  { id: 'sell_machine', title: 'Продайте технику', description: 'Собственную технику можно продать за 70% исходной цены.', route: 'equipment', reward: 0, done: (state) => state.equipmentSold > 0 },
  { id: 'special_project', title: 'Сдайте особый проект', description: 'Особые заказы ограничены по времени, но дают высокую награду и репутацию.', route: 'jobs', reward: 0, done: (state) => state.completed.some((project) => project.job.special) },
  { id: 'two_crews', title: 'Сформируйте две бригады', description: 'Исследуйте «Профстандарты» и заполните обе бригады.', route: 'hr', reward: 0, done: (state) => maxCrews(state) === 2 && state.crews.every((crew) => crew.workers.length > 0) },
  { id: 'capital_5m', title: 'Накопите 5 000 000 ₽ капитала', description: 'Реинвестируйте прибыль в технику, технологии и запас материалов.', route: 'overview', reward: 2, done: (state) => netWorth(state) >= 5_000_000 },
]

export function nextTutorialStep(state: GameState): TutorialStep | null {
  return TUTORIAL_STEPS.find((step) => !state.completedTutorial.includes(step.id)) ?? null
}

export function applyTutorialProgress(state: GameState): TutorialStep | null {
  const step = nextTutorialStep(state)
  if (!step || !step.done(state)) return null
  state.completedTutorial.push(step.id)
  if (step.reward > 0) {
    state.reputation = Math.max(0, Math.min(100, state.reputation + step.reward))
    addLog(state, `Шаг прогресса выполнен: ${step.title}. Награда +${step.reward} репутации.`, 'success')
  } else {
    addLog(state, `Шаг прогресса выполнен: ${step.title}.`, 'info')
  }
  return step
}
