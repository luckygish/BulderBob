import { BALANCE } from './balance'
import type { GameState, SeasonDef } from './types'

export const SEASONS: SeasonDef[] = [
  { id: 'summer_1', name: 'Лето I', title: 'От двора — к городскому масштабу', weather: 'summer', goal: { capital: 4_000_000, reputation: 55, completed: 1 }, effects: { materialPriceRate: 0.1, extraWorkHour: 1 } },
  { id: 'winter_1', name: 'Зима I', title: 'От первых морозов — к первым фундаментам', weather: 'winter', goal: { capital: 5_500_000, reputation: 58, completed: 2 }, effects: { foundationHoursRate: 0.15, maintenanceRate: 0.1 } },
  { id: 'summer_2', name: 'Лето II', title: 'От коттеджа — к целому кварталу', weather: 'summer', goal: { capital: 8_000_000, reputation: 62, completed: 3 }, effects: { materialPriceRate: 0.1, extraWorkHour: 1, wageRate: 0.05 } },
  { id: 'winter_2', name: 'Зима II', title: 'От авралов — к надёжному графику', weather: 'winter', goal: { capital: 10_500_000, reputation: 66, completed: 3 }, effects: { foundationHoursRate: 0.15, logisticsRate: 0.1 } },
  { id: 'summer_3', name: 'Лето III', title: 'От одной бригады — к целой компании', weather: 'summer', goal: { capital: 12_500_000, reputation: 70, completed: 4 }, effects: { materialPriceRate: 0.12, extraWorkHour: 1, provisionRate: 0.1 } },
  { id: 'winter_3', name: 'Зима III', title: 'От зимней стройки — к тёплым отношениям с банком', weather: 'winter', goal: { capital: 16_000_000, reputation: 73, completed: 4 }, effects: { foundationHoursRate: 0.2, maintenanceRate: 0.2 } },
  { id: 'summer_4', name: 'Лето IV', title: 'От типовых домов — к знаковым объектам', weather: 'summer', goal: { capital: 19_000_000, reputation: 76, completed: 5 }, effects: { materialPriceRate: 0.12, extraWorkHour: 1, wageRate: 0.05 } },
  { id: 'winter_4', name: 'Зима IV', title: 'От ночных смен — к званию генподрядчика', weather: 'winter', goal: { capital: 23_500_000, reputation: 79, completed: 5 }, effects: { foundationHoursRate: 0.2, nightWageRate: 0.25, nightEfficiencyRate: -0.1 } },
  { id: 'summer_5', name: 'Лето V', title: 'От окраин — к центру города', weather: 'summer', goal: { capital: 28_500_000, reputation: 82, completed: 6 }, effects: { materialPriceRate: 0.15, extraWorkHour: 1, wageRate: 0.05 } },
  { id: 'winter_5', name: 'Зима V', title: 'От высоток — к легенде города', weather: 'winter', goal: { capital: 34_500_000, reputation: 85, completed: 6 }, effects: { foundationHoursRate: 0.25, materialPriceRate: 0.05 } },
]

export function currentSeason(state: GameState): SeasonDef {
  return SEASONS[Math.min(state.seasonIndex, SEASONS.length - 1)]
}

function seasonalPlanningMultiplier(state: GameState): number {
  return state.research.seasonal_planning?.status === 'done' ? 0.8 : 1
}

export function seasonMaterialPriceRate(state: GameState): number {
  return ((currentSeason(state).effects.materialPriceRate ?? 0) + (state.seasonPriceBonus ?? 0)) * seasonalPlanningMultiplier(state)
}

export function seasonFoundationHoursRate(state: GameState): number {
  return (currentSeason(state).effects.foundationHoursRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function workDayEnd(state: GameState): number {
  return Math.min(23, BALANCE.workDayEnd + (currentSeason(state).effects.extraWorkHour ?? 0))
}

export function workdayHours(state: GameState): number {
  return workDayEnd(state) - BALANCE.workDayStart
}

export function seasonNightWageRate(state: GameState): number {
  return (currentSeason(state).effects.nightWageRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function seasonNightEfficiencyRate(state: GameState): number {
  return (currentSeason(state).effects.nightEfficiencyRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function seasonWageRate(state: GameState): number {
  return (currentSeason(state).effects.wageRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function seasonLogisticsRate(state: GameState): number {
  return (currentSeason(state).effects.logisticsRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function seasonProvisionRate(state: GameState): number {
  return (currentSeason(state).effects.provisionRate ?? 0) * seasonalPlanningMultiplier(state)
}

export function seasonMaintenanceRate(state: GameState): number {
  return BALANCE.maintenanceRate * (1 + (currentSeason(state).effects.maintenanceRate ?? 0) * seasonalPlanningMultiplier(state))
}

export function seasonNightWageMultiplier(state: GameState): number {
  const coordinatorMultiplier = state.research.night_coordinator?.status === 'done' ? 0.85 : 1
  return BALANCE.nightWageMultiplier * (1 + (currentSeason(state).effects.nightWageRate ?? 0) * seasonalPlanningMultiplier(state)) * coordinatorMultiplier
}

export function seasonFoundationManHours(state: GameState, manHours: number): number {
  return Math.round(manHours * (1 + seasonFoundationHoursRate(state)))
}

export function seasonEffectText(state: GameState): string {
  const effects = currentSeason(state).effects
  const parts: string[] = []
  if (effects.materialPriceRate) parts.push(`материалы +${Math.round(effects.materialPriceRate * 100)}%`)
  if (effects.foundationHoursRate) parts.push(`фундамент +${Math.round(effects.foundationHoursRate * 100)}% к трудоёмкости`)
  if (effects.extraWorkHour) parts.push(`рабочий день до ${workDayEnd(state)}:00`)
  if (effects.wageRate) parts.push(`зарплата +${Math.round(effects.wageRate * 100)}%`)
  if (effects.logisticsRate) parts.push(`доставка +${Math.round(effects.logisticsRate * 100)}%`)
  if (effects.provisionRate) parts.push(`обеспечение +${Math.round(effects.provisionRate * 100)}%`)
  if (effects.maintenanceRate) parts.push(`обслуживание +${Math.round(effects.maintenanceRate * 100)}%`)
  if (effects.nightWageRate) parts.push(`ночной тариф +${Math.round(effects.nightWageRate * 100)}%`)
  if (effects.nightEfficiencyRate) parts.push(`ночная эффективность ${effects.nightEfficiencyRate > 0 ? '+' : ''}${Math.round(effects.nightEfficiencyRate * 100)}%`)
  return parts.join(' · ')
}
