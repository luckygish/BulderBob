import { BALANCE } from './balance'
import { SKILLS } from './catalog'
import type { EquipmentId, GameState, Project, SkillId } from './types'

export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(BALANCE.saveKey, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

function migrateV1(state: GameState): GameState {
  state.version = BALANCE.version
  state.equipment.forEach((asset, index) => {
    asset.assetId ||= `legacy_asset_${asset.id}_${index}`
  })
  state.jobs.forEach((job) => {
    job.special ||= false
    job.expiresDay ||= job.deadline
  })
  const migrateProject = (project: Project): void => {
    const legacy = project as Project & { crewId?: number; equipmentId?: EquipmentId }
    project.crewIds = Array.isArray(project.crewIds) ? project.crewIds : legacy.crewId !== undefined && legacy.crewId >= 0 ? [legacy.crewId] : []
    if (!project.equipmentAssetId && legacy.equipmentId) {
      project.equipmentAssetId = state.equipment.find((asset) => asset.id === legacy.equipmentId && asset.projectId === project.id)?.assetId ?? null
    }
    project.equipmentAssetId ??= null
    project.reserved ??= {}
    project.job.special ||= false
    project.job.expiresDay ||= project.job.deadline
  }
  state.projects.forEach(migrateProject)
  state.completed.forEach(migrateProject)
  state.bots.forEach((bot) => {
    if (bot.project) {
      bot.project.job.special ||= false
      bot.project.job.expiresDay ||= bot.project.job.deadline
    }
  })
  for (const worker of [...state.candidates, ...state.crews.flatMap((crew) => crew.workers), ...state.bots.flatMap((bot) => bot.crew)]) {
    worker.skills = worker.skills.filter((skill): skill is SkillId => skill in SKILLS).slice(0, 2)
  }
  return state
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(BALANCE.saveKey)
    if (!raw) return null
    let state = JSON.parse(raw) as GameState
    if (state.version === 1) state = migrateV1(state)
    if (state.version !== BALANCE.version || !Array.isArray(state.projects) || !Array.isArray(state.jobs)) return null
    state.paused = true
    return state
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(BALANCE.saveKey)
  } catch {
    // Игра продолжит работу в памяти, даже если хранилище недоступно.
  }
}
