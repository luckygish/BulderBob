import type { GameState, SupplierId } from '../game/types'

export type Route = 'overview' | 'jobs' | 'construction' | 'market' | 'hr' | 'equipment' | 'technology' | 'bank' | 'competitors'

export interface ViewContext {
  state: GameState
  route: Route
  projectId: string | null
  supplier: SupplierId
  crewId: number
}

export const ROUTES: { id: Route; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: 'overview' },
  { id: 'jobs', label: 'Заказы', icon: 'jobs' },
  { id: 'construction', label: 'Строительство', icon: 'construction' },
  { id: 'market', label: 'Рынок', icon: 'market' },
  { id: 'hr', label: 'Кадры', icon: 'hr' },
  { id: 'equipment', label: 'Техника', icon: 'equipment' },
  { id: 'technology', label: 'Технологии', icon: 'tech' },
  { id: 'bank', label: 'Банк', icon: 'bank' },
  { id: 'competitors', label: 'Конкуренты', icon: 'competitors' },
]
