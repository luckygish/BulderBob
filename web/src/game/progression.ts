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
  { id: 'first_job', title: 'Take your first order', description: 'On the job board pick an available contract and create your first project.', route: 'jobs', reward: 2, done: (state) => state.projects.length > 0 || state.completed.length > 0 },
  { id: 'hire_two', title: 'Hire two workers', description: 'In the HR section put together your starting crew.', route: 'hr', reward: 0, done: (state) => state.crews.reduce((sum, crew) => sum + crew.workers.length, 0) >= 2 },
  { id: 'assign_crew', title: 'Assign a crew to a project', description: 'In Construction select a prepared crew.', route: 'construction', reward: 0, done: (state) => state.projects.some((project) => project.crewIds.some((crewId) => state.crews[crewId]?.workers.length)) },
  { id: 'foundation_machine', title: 'Provide foundation equipment', description: 'Buy or rent a concrete mixer, tractor or excavator.', route: 'equipment', reward: 0, done: (state) => state.equipment.some((asset) => ['mixer', 'tractor', 'excavator'].includes(asset.id)) },
  { id: 'site_setup', title: 'Furnish the site provisions', description: 'Every active project needs a full set of cabin, sanitation, water, generator and tools.', route: 'equipment', reward: 2, done: (state) => Object.keys(missingProvisions(state)).length === 0 },
  { id: 'reserve_materials', title: 'Reserve materials', description: 'On the market select a project and press "Buy missing". Batches will not go to another project.', route: 'market', reward: 0, done: (state) => state.projects.some((project) => Object.values(project.reserved).some((batches) => batches.reduce((sum, batch) => sum + batch.qty, 0) > 0)) },
  { id: 'start_building', title: 'Start construction', description: 'Start the current stage or the whole project once resources are secured.', route: 'construction', reward: 0, done: (state) => state.projects.some((project) => project.started) },
  { id: 'first_delivery', title: 'Deliver your first project', description: 'Complete every stage and get the financial report.', route: 'construction', reward: 0, done: (state) => state.completed.length > 0 },
  { id: 'research_tech', title: 'Research a technology', description: 'Invest profits in management, staffing or finance.', route: 'technology', reward: 0, done: (state) => Object.values(state.research).some((research) => research.status === 'done') },
  { id: 'bonus_machine', title: 'Buy stage-bonus equipment', description: 'Tractor, excavator, manipulator and crane speed up matching stages.', route: 'equipment', reward: 0, done: (state) => state.equipment.some((asset) => ['tractor', 'excavator', 'manipulator', 'crane'].includes(asset.id)) },
  { id: 'two_suppliers', title: 'Use both yards', description: 'Compare North and South: they differ in price and delivery times.', route: 'market', reward: 0, done: (state) => state.usedSuppliers.length >= 2 },
  { id: 'hire_foreman', title: 'Hire a foreman', description: 'A foreman boosts the other crew members.', route: 'hr', reward: 0, done: (state) => state.crews.some((crew) => crew.workers.some((worker) => worker.type === 'foreman')) },
  { id: 'second_project', title: 'Take a second project', description: 'Expand: several projects at once become available after planning research.', route: 'jobs', reward: 0, done: (state) => state.projects.length + state.completed.length >= 2 },
  { id: 'open_bank', title: 'Open a bank account or take a loan', description: 'The finance branch unlocks loans, favorable leasing and factoring.', route: 'bank', reward: 0, done: (state) => state.loan !== null || state.research.bank_account?.status === 'done' },
  { id: 'sell_machine', title: 'Sell equipment', description: 'Owned equipment can be sold for 70% of its original price.', route: 'equipment', reward: 0, done: (state) => state.equipmentSold > 0 },
  { id: 'special_project', title: 'Complete a special project', description: 'Special orders are time-limited but grant high rewards and reputation.', route: 'jobs', reward: 0, done: (state) => state.completed.some((project) => project.job.special) },
  { id: 'two_crews', title: 'Form two crews', description: 'Research Professional standards and fill both crews.', route: 'hr', reward: 0, done: (state) => maxCrews(state) === 2 && state.crews.every((crew) => crew.workers.length > 0) },
  { id: 'capital_5m', title: 'Accumulate $5,000,000 in capital', description: 'Reinvest profits into equipment, technologies and material stock.', route: 'overview', reward: 3, done: (state) => netWorth(state) >= 5_000_000 },
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
    addLog(state, `Progress step completed: ${step.title}. Reward +${step.reward} reputation.`, 'success')
  } else {
    addLog(state, `Progress step completed: ${step.title}.`, 'info')
  }
  return step
}