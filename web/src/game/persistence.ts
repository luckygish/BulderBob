import { BALANCE } from './balance'
import { SKILLS } from './catalog'
import { netWorth } from './engine'
import type { EquipmentId, GameState, Project, SkillId } from './types'

export interface SaveMeta {
  file: string
  savedAt: number
  companyName: string
  day: number
  season: number
  capital: number
}

const PREFIX = 'bulder-save:'
const LEGACY_KEY = BALANCE.saveKey
const LEGACY_FILE = 'save_legacy_browser.json'

interface TauriListenerEvent { payload: unknown }
type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>
type TauriListen = (event: string, handler: (event: TauriListenerEvent) => void) => Promise<() => void>
interface TauriApi {
  core?: { invoke?: TauriInvoke }
  event?: { listen?: TauriListen }
}

declare global {
  interface Window { __TAURI__?: TauriApi }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.__TAURI__)
}

function tauri(): { invoke: TauriInvoke; listen: TauriListen } {
  const api = window.__TAURI__
  return {
    invoke: api?.core?.invoke ?? (() => Promise.reject(new Error('Tauri IPC недоступен'))),
    listen: api?.event?.listen ?? (() => Promise.reject(new Error('Tauri events недоступны'))),
  }
}

function timestampName(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `save_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

interface Backend {
  listSaves(): Promise<string[]>
  load(file: string): Promise<string | null>
  write(file: string, contents: string): Promise<void>
  create(contents: string): Promise<string>
  saveDir(): Promise<string | null>
  quit(): Promise<void>
}

class BrowserBackend implements Backend {
  private readonly key = (file: string): string => `${PREFIX}${file}`

  async listSaves(): Promise<string[]> {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length))
    }
    return keys.sort().reverse()
  }

  async load(file: string): Promise<string | null> {
    return localStorage.getItem(this.key(file))
  }

  async write(file: string, contents: string): Promise<void> {
    localStorage.setItem(this.key(file), contents)
  }

  async create(contents: string): Promise<string> {
    const base = timestampName()
    let name = `${base}.json`
    let counter = 2
    while (localStorage.getItem(this.key(name)) !== null) {
      name = `${base}_${counter}.json`
      counter += 1
    }
    localStorage.setItem(this.key(name), contents)
    return name
  }

  async saveDir(): Promise<string | null> {
    return null
  }

  async quit(): Promise<void> {
    // Браузерный режим: окно не закрывается приложением.
  }
}

class TauriBackend implements Backend {
  private readonly invoke = tauri().invoke

  async listSaves(): Promise<string[]> {
    return (await this.invoke('list_saves')) as string[]
  }

  async load(file: string): Promise<string | null> {
    return (await this.invoke('load_save', { fileName: file })) as string | null
  }

  async write(file: string, contents: string): Promise<void> {
    await this.invoke('write_save', { fileName: file, contents })
  }

  async create(contents: string): Promise<string> {
    return (await this.invoke('create_save', { contents })) as string
  }

  async saveDir(): Promise<string | null> {
    return (await this.invoke('save_dir')) as string
  }

  async quit(): Promise<void> {
    await this.invoke('exit_app')
  }
}

let backend: Backend | null = null
let legacyChecked = false

function getBackend(): Backend {
  backend ??= isDesktop() ? new TauriBackend() : new BrowserBackend()
  return backend
}

async function importLegacy(): Promise<void> {
  if (legacyChecked || isDesktop()) return
  legacyChecked = true
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const current = getBackend()
    if ((await current.load(LEGACY_FILE)) === null) {
      let state = JSON.parse(raw) as GameState
      if (state.version === 1) state = migrateV1(state)
      if (state.version === 2) state = migrateV2(state)
      if (state.version === 3) state = migrateV3(state)
      await current.write(LEGACY_FILE, JSON.stringify(state))
    }
  } catch {
    // Импорт не критичен: игра продолжит работу.
  }
}

export async function listSaves(): Promise<SaveMeta[]> {
  await importLegacy()
  const files = await getBackend().listSaves()
  const saves: SaveMeta[] = []
  for (const file of files) {
    try {
      const raw = await getBackend().load(file)
      if (!raw) continue
      const meta = readMeta(file, raw)
      if (meta) saves.push(meta)
    } catch {
      // Пропускаем повреждённые файлы.
    }
  }
  saves.sort((a, b) => b.savedAt - a.savedAt || b.file.localeCompare(a.file))
  return saves
}

function readMeta(file: string, raw: string): SaveMeta | null {
  const state = JSON.parse(raw) as GameState
  if (state.version !== BALANCE.version || !Array.isArray(state.projects)) return null
  return {
    file,
    savedAt: fileToTime(file),
    companyName: state.companyName || 'Без названия',
    day: state.day,
    season: state.seasonIndex + 1,
    capital: netWorth(state),
  }
}

function fileToTime(file: string): number {
  const match = /save_(\d{8})_(\d{6})/.exec(file)
  if (!match) return 0
  const digits = (value: string): number[] => [Number(value.slice(0, 4)), Number(value.slice(4, 6)), Number(value.slice(6, 8)), Number(value.slice(8, 10)), Number(value.slice(10, 12)), Number(value.slice(12, 14))]
  const [year, month, day, hour, minute, second] = digits(`${match[1]}${match[2]}`)
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

export async function saveGame(state: GameState, file: string | null): Promise<boolean> {
  if (!file) return false
  try {
    await getBackend().write(file, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export async function createSaveFile(state: GameState): Promise<string> {
  return getBackend().create(JSON.stringify(state))
}

export async function loadGame(file: string): Promise<GameState | null> {
  try {
    const raw = await getBackend().load(file)
    if (!raw) return null
    let state = JSON.parse(raw) as GameState
    if (state.version === 1) state = migrateV1(state)
    if (state.version === 2) state = migrateV2(state)
    if (state.version === 3) state = migrateV3(state)
    if (state.version !== BALANCE.version || !Array.isArray(state.projects) || !Array.isArray(state.jobs)) return null
    state.paused = true
    return state
  } catch {
    return null
  }
}

export async function quitApp(): Promise<void> {
  await getBackend().quit()
}

export async function saveDir(): Promise<string | null> {
  return getBackend().saveDir()
}

export function onAppClose(handler: () => void): void {
  const listen = window.__TAURI__?.event?.listen
  if (!listen) return
  void listen('menu://close', handler).catch(() => undefined)
}

function migrateV1(state: GameState): GameState {
  state.version = 2
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

function migrateV2(state: GameState): GameState {
  state.version = 3
  state.seasonIndex ??= 0
  state.seasonCompleted ??= 0
  state.seasonRevenue ??= 0
  state.completedTutorial ??= []
  state.equipmentSold ??= 0
  state.usedSuppliers ??= []
  state.seasonNotice ??= null
  return state
}

function migrateV3(state: GameState): GameState {
  state.version = BALANCE.version
  state.companyName ||= 'Ваша компания'
  state.companyAvatar ??= 0
  state.financeHistory ??= []
  return state
}