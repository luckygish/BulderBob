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
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'company', label: 'Company', icon: 'company' },
  { id: 'jobs', label: 'Jobs', icon: 'jobs' },
  { id: 'construction', label: 'Construction', icon: 'construction' },
  { id: 'market', label: 'Market', icon: 'market' },
  { id: 'hr', label: 'HR', icon: 'hr' },
  { id: 'equipment', label: 'Equipment', icon: 'equipment' },
  { id: 'technology', label: 'Technologies', icon: 'tech' },
  { id: 'bank', label: 'Bank', icon: 'bank' },
  { id: 'report', label: 'Financial report', icon: 'report' },
  { id: 'competitors', label: 'Competitors', icon: 'competitors' },
]
