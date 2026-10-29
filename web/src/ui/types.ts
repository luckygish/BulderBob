import type { GameState, SupplierId } from '../game/types'

export type Route = 'overview' | 'company' | 'jobs' | 'construction' | 'market' | 'hr' | 'equipment' | 'technology' | 'bank' | 'report' | 'competitors'

export type MarketTab = SupplierId | 'warehouse'

export interface ViewContext {
  state: GameState
  route: Route
  projectId: string | null
  supplier: SupplierId
  marketTab: MarketTab
  crewId: number
}

export const ROUTES: { id: Route; label: string; icon: string }[] = [
  { id: 'overview', label: 'Обзор', icon: 'overview' },
  { id: 'company', label: 'Компания', icon: 'company' },
  { id: 'jobs', label: 'Заказы', icon: 'jobs' },
  { id: 'construction', label: 'Строительство', icon: 'construction' },
  { id: 'market', label: 'Рынок', icon: 'market' },
  { id: 'hr', label: 'Кадры', icon: 'hr' },
  { id: 'equipment', label: 'Техника', icon: 'equipment' },
  { id: 'technology', label: 'Технологии', icon: 'tech' },
  { id: 'bank', label: 'Банк', icon: 'bank' },
  { id: 'report', label: 'Финансовый отчёт', icon: 'report' },
  { id: 'competitors', label: 'Конкуренты', icon: 'competitors' },
]
