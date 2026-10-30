import { assignCrew, buyMissingForProject, buyProvision, fireWorker, hireWorker, restockMaterialFromWarehouse, restockProjectFromWarehouse, setSpeed, startCurrentStage, startFullProject, startResearch, takeJob, togglePause, allocateProjectStage } from '../game/actions'
import { BALANCE } from '../game/balance'
import { buildingById, equipmentById } from '../game/catalog'
import { acquireEquipment, assignEquipment, createNewGame, isDebtBlocked, isResearched, netWorth, overdraftLimit, purchaseMaterial, quoteMaterial, repayDebt, resolveEvent, sellEquipment, takeLoan, tickHour } from '../game/engine'
import { eventById } from '../game/events'
import { applyTutorialProgress } from '../game/progression'
import { createSaveFile, isDesktop, listSaves, loadGame, onAppClose, quitApp, saveDir, saveGame } from '../game/persistence'
import type { SaveMeta } from '../game/persistence'
import { companyStatus, projectCosts } from '../game/selectors'
import { workDayEnd } from '../game/seasons'
import type { ActionResult, EquipmentId, GameState, MaterialId, ProvisionId, Speed, SupplierId } from '../game/types'
import { badge, compactMoney, companyAvatar, esc, journalItem, money, pad } from './components'
import { icon } from './icons'
import { eventPortrait } from './eventArt'
import { renderBank } from './pages/bank'
import { renderCompetitors } from './pages/competitors'
import { renderCompany } from './pages/company'
import { renderConstruction } from './pages/construction'
import { renderEquipment } from './pages/equipment'
import { renderHr } from './pages/hr'
import { renderJobs } from './pages/jobs'
import { renderMarket } from './pages/market'
import { renderOverview } from './pages/overview'
import { renderReport } from './pages/report'
import { renderTechnology } from './pages/technology'
import { patchDom } from './dom'
import { ROUTES } from './types'
import type { MarketTab, Route, ViewContext } from './types'

export class App {
  private state: GameState | null = null
  private activeSave: string | null = null
  private route: Route = 'overview'
  private projectId: string | null = null
  private supplier: SupplierId = 'north'
  private marketTab: MarketTab = 'north'
  private crewId = 0
  private journalOpen = false
  private navOpen = false
  private timer: number | undefined
  private closing = false
  private menuMode: 'start' | 'load' = 'start'
  private menuSaves: SaveMeta[] = []
  private menuBusy = false
  private saveDirText = ''
  private root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    document.addEventListener('click', (event) => this.onClick(event))
    document.addEventListener('change', (event) => this.onChange(event))
    document.addEventListener('input', (event) => this.onInput(event))
    document.addEventListener('keydown', (event) => this.onKeydown(event))
    document.addEventListener('focusout', (event) => {
      if (event.target instanceof HTMLSelectElement || event.target instanceof HTMLInputElement) {
        window.setTimeout(() => {
          if (!this.isEditing()) this.render()
        })
      }
    })
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state && !this.state.paused) {
        this.state.paused = true
        this.save()
        this.render()
      }
    })
    window.addEventListener('beforeunload', () => this.save())
    onAppClose(() => { void this.handleClose() })
  }

  start(): void {
    this.renderStartScreen()
    window.setInterval(() => { void this.flushSave() }, 30_000)
  }

  private schedule(): void {
    window.clearTimeout(this.timer)
    if (!this.state) return
    this.timer = window.setTimeout(() => {
      if (!this.state) return
      if (!this.state.paused) {
        tickHour(this.state)
        applyTutorialProgress(this.state)
        this.save()
        if (!this.isEditing()) this.render()
        if (this.state.seasonNotice) this.showSeasonNotice()
        if (this.state.event) this.showEvent()
      }
      this.schedule()
    }, this.state.paused ? 500 : BALANCE.hourMs[this.state.speed])
  }

  private isEditing(): boolean {
    const active = document.activeElement
    return active instanceof HTMLSelectElement || active instanceof HTMLInputElement || Boolean(document.querySelector('dialog[open]'))
  }

  private saveCompanyName(): void {
    const input = document.querySelector<HTMLInputElement>('#company-name')
    const name = input?.value.trim().replace(/\s+/g, ' ') ?? ''
    if (name.length < 2 || name.length > 30) this.commit({ ok: false, message: 'Company name must be 2–30 characters.' })
    else { this.state!.companyName = name; this.commit({ ok: true, message: 'Company name saved.' }) }
  }

  private context(): ViewContext {
    return { state: this.state!, route: this.route, projectId: this.projectId, supplier: this.supplier, marketTab: this.marketTab, crewId: this.crewId }
  }

  private page(): string {
    const ctx = this.context()
    switch (this.route) {
      case 'company': return renderCompany(ctx)
      case 'jobs': return renderJobs(ctx)
      case 'construction': return renderConstruction(ctx)
      case 'market': return renderMarket(ctx)
      case 'hr': return renderHr(ctx)
      case 'equipment': return renderEquipment(ctx)
      case 'technology': return renderTechnology(ctx)
      case 'bank': return renderBank(ctx)
      case 'report': return renderReport(ctx)
      case 'competitors': return renderCompetitors(ctx)
      default: return renderOverview(ctx)
    }
  }

  private startScreenMarkup(): string {
    return `<div class="start-screen"><div class="start-shell">
      <div class="start-logo">${icon('logo')}</div>
      <div class="eyebrow">Economic simulation</div>
      <h1>Bulder</h1>
      <p>Build projects, hire crews and outplay competitors on a shared market.</p>
      <div class="start-actions">
        <button class="btn btn-primary start-btn" data-action="menu-new-game">${icon('plus')} New game</button>
        <button class="btn btn-secondary start-btn" data-action="menu-load">${icon('document')} Load</button>
        <button class="btn btn-ghost start-btn" data-action="menu-quit">${icon('close')} Quit</button>
      </div>
      ${this.saveDirText ? `<p class="start-save-dir">${esc(this.saveDirText)}</p>` : ''}
    </div></div>`
  }

  private loadScreenMarkup(): string {
    const rows = this.menuSaves.length
      ? `<div class="save-table">${this.menuSaves.map((save) => `
        <div class="save-row">
          <div class="save-file"><strong>${esc(save.companyName)}</strong></div>
          <div class="save-meta">Day ${save.day} · Season ${save.season}</div>
          <div class="save-capital">${compactMoney(save.capital)}</div>
          <div class="save-date">${this.formatSaveDate(save.savedAt)}</div>
          <button class="btn btn-primary save-load" data-action="load-save" data-file="${esc(save.file)}">Load</button>
        </div>`).join('')}</div>`
      : `<div class="save-empty">${icon('document')}<strong>No saves</strong><span>Start a new game — your company will appear in the list.</span></div>`
    return `<div class="start-screen"><div class="start-shell load-shell">
      <div class="eyebrow">Continue</div>
      <h1>Load</h1>
      <div class="save-list-head"><span>Company</span><span>Day / Season</span><span>Capital</span><span>Date</span><span></span></div>
      ${this.menuBusy ? `<div class="start-busy">Loading…</div>` : rows}
      <div class="start-actions load-actions">
        <button class="btn btn-secondary start-btn" data-action="menu-new-game">${icon('plus')} New game</button>
        <button class="btn btn-ghost start-btn" data-action="menu-back">${icon('arrow')} Back</button>
      </div>
      ${this.saveDirText ? `<p class="start-save-dir">${esc(this.saveDirText)}</p>` : ''}
    </div></div>`
  }

  private renderStartScreen(): void {
    const markup = this.menuMode === 'load' ? this.loadScreenMarkup() : this.startScreenMarkup()
    const stage = document.createElement('div')
    stage.innerHTML = markup
    this.root.replaceChildren(stage.firstElementChild!)
    document.title = this.menuMode === 'load' ? 'Load · Bulder' : 'Bulder — construction tycoon'
  }

  private formatSaveDate(time: number): string {
    if (!time) return '—'
    return new Date(time).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  private async startNewGame(): Promise<void> {
    if (this.state && this.activeSave) await saveGame(this.state, this.activeSave)
    this.state = createNewGame()
    try {
      this.activeSave = await createSaveFile(this.state)
    } catch {
      this.activeSave = null
    }
    this.projectId = this.state.projects[0]?.id ?? null
    this.route = 'overview'
    this.journalOpen = false
    this.navOpen = false
    this.menuMode = 'start'
    this.render()
    this.schedule()
    this.notify('New company created.', 'success')
    this.showWelcome()
  }

  private showWelcome(): void {
    const state = this.state
    if (!state) return
    state.paused = true
    this.render()
    this.openModal(`<div class="modal-icon">${icon('hardhat')}</div>
      <div class="eyebrow">Career start</div>
      <h2>Hi!</h2>
      <p>You are site foreman Balder Bob. For twenty years you worked for other companies, and now you have saved up starting capital — time to open your own business. Ahead are ten seasons of construction, crews and competition. Build something great!</p>
      <div class="button-row modal-actions"><button class="btn btn-primary" data-action="welcome-start">Let's work!</button></div>`)
  }

  private async loadSavedGame(file: string): Promise<void> {
    const loaded = await loadGame(file)
    if (!loaded) {
      this.menuBusy = false
      this.notify('Failed to load the save.', 'error')
      void this.refreshLoadScreen()
      return
    }
    this.state = loaded
    this.menuBusy = false
    this.activeSave = file
    this.projectId = loaded.projects[0]?.id ?? null
    this.route = 'overview'
    this.journalOpen = false
    this.navOpen = false
    this.render()
    this.schedule()
    if (loaded.seasonNotice) this.showSeasonNotice()
    if (loaded.event) this.showEvent()
    this.notify('Save loaded.', 'success')
  }

  private async refreshLoadScreen(): Promise<void> {
    try {
      const [saves, dir] = await Promise.all([listSaves(), saveDir()])
      this.menuSaves = saves
      this.saveDirText = dir ?? ''
    } catch {
      this.menuSaves = []
    }
    this.menuBusy = false
    this.renderStartScreen()
  }

  private async flushSave(): Promise<void> {
    if (this.state && this.activeSave && !this.closing) await saveGame(this.state, this.activeSave)
  }

  private async handleClose(): Promise<void> {
    if (this.closing) return
    this.closing = true
    this.showSaveOverlay()
    if (this.state && this.activeSave) await saveGame(this.state, this.activeSave)
    try {
      await quitApp()
    } catch {
      this.closing = false
      document.querySelector('.save-overlay')?.remove()
    }
  }

  private async saveAndExit(): Promise<void> {
    if (this.state && this.activeSave) await saveGame(this.state, this.activeSave)
    window.clearTimeout(this.timer)
    this.timer = undefined
    this.state = null
    this.activeSave = null
    this.projectId = null
    this.journalOpen = false
    this.navOpen = false
    this.menuMode = 'start'
    this.menuBusy = false
    this.renderStartScreen()
    this.notify('Game saved. See you later!', 'success')
  }

  private showSaveOverlay(): void {
    const overlay = document.createElement('div')
    overlay.className = 'save-overlay'
    overlay.innerHTML = `<div class="save-overlay-card"><div class="save-spinner"></div><span>Saving…</span></div>`
    document.body.append(overlay)
  }

  private render(): void {
    if (!this.state || this.closing) {
      if (!this.state) this.renderStartScreen()
      return
    }
    const state = this.state
    const quantities = new Map<string, string>()
    document.querySelectorAll<HTMLInputElement>('[data-qty]').forEach((input) => quantities.set(input.dataset.qty!, input.value))
    const companyNameValue = document.querySelector<HTMLInputElement>('#company-name')?.value ?? null
    const route = ROUTES.find((item) => item.id === this.route)!
    const visibleRoutes = ROUTES.filter((item) => item.id !== 'report' || isResearched(state, 'bank_account'))
    const company = companyStatus(state)
    const work = state.hour >= BALANCE.workDayStart && state.hour < workDayEnd(state)
    const saveName = this.activeSave ? this.activeSave.replace(/\.json$/, '') : ''
    const navMarkup = visibleRoutes.map((item) => `<button class="nav-item ${item.id === this.route ? 'active' : ''}" data-route="${item.id}" ${item.id === this.route ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span>${item.id === 'construction' && state.projects.length ? `<em>${state.projects.length}</em>` : ''}${item.id === 'jobs' && state.jobs.length ? `<small>${state.jobs.length}</small>` : ''}</button>${item.id === 'competitors' ? `<button class="nav-item nav-exit" data-action="save-exit">${icon('close')}<span>Save and exit</span></button>` : ''}`).join('')
    const markup = `<div class="app-shell ${this.navOpen ? 'nav-open' : ''}">
      <aside class="sidebar" aria-label="Main navigation">
        <div class="brand"><span class="brand-mark">${icon('logo')}</span><div><strong>Bulder</strong><span>Building business</span></div><button class="icon-btn sidebar-close" data-action="close-nav" aria-label="Close menu">${icon('close')}</button></div>
        <button class="company-chip" data-route="company">${companyAvatar(state.companyAvatar, 'company-avatar-small')}<div><strong>${esc(state.companyName)}</strong><span>${company.name}</span></div><span class="status-dot"></span></button>
        <nav class="main-nav">${navMarkup}</nav>
        <div class="sidebar-season"><div class="eyebrow">Current season</div><div><strong>Day ${state.day}</strong><span>/ ${BALANCE.seasonDays}</span></div><div class="season-track"><span style="width:${Math.min(100, state.day / BALANCE.seasonDays * 100)}%"></span></div><p>Capital ${compactMoney(netWorth(state))}</p></div>
        <div class="sidebar-footer" title="${esc(this.activeSave ?? '')}"><span class="status-dot"></span><span class="save-file-label">${saveName ? `Save: ${esc(saveName)}` : 'No save file created yet'}</span></div>
      </aside>
      <button class="nav-backdrop" data-action="close-nav" aria-label="Close menu"></button>
      <div class="workspace">
        <header class="topbar"><div class="topbar-context"><button class="icon-btn mobile-menu" data-action="open-nav" aria-label="Open menu">${icon('menu')}</button><div><span>${route.label}</span><strong>${state.paused ? 'Game paused' : work ? 'Workday' : 'Night time'}</strong></div></div>
          <div class="topbar-metrics"><div class="top-metric money-metric"><span>On account</span><strong>${compactMoney(state.money)}</strong></div><div class="top-metric"><span>${icon('clock')} Day ${state.day}</span><strong>${pad(state.hour)}:00</strong></div><div class="top-metric reputation-metric" title="Reputation affects orders, technologies and achievements." tabindex="0"><span>Reputation</span><strong>${icon('star')} ${state.reputation}</strong><div class="rep-tooltip" role="tooltip">Reputation affects orders, technologies and achievements. Earn it through victories and events.</div></div></div>
          <div class="time-controls"><button class="btn btn-small ${state.paused ? 'btn-primary' : 'btn-secondary'}" data-action="pause" aria-label="${state.paused ? 'Resume' : 'Pause'}">${icon(state.paused ? 'play' : 'pause')}<span>${state.paused ? 'Resume' : 'Pause'}</span></button><div class="speed-control" aria-label="Game speed">${([1, 2, 4] as Speed[]).map((speed) => `<button class="${state.speed === speed && !state.paused ? 'active' : ''}" data-action="speed" data-id="${speed}" aria-label="Speed ×${speed}">×${speed}</button>`).join('')}</div></div>
          <div class="topbar-actions"><button class="icon-btn ${this.journalOpen ? 'active' : ''}" data-action="journal" aria-label="Journal (J)">${icon('journal')}</button><button class="icon-btn" data-action="new-game" aria-label="New game" title="New game">${icon('plus')}</button></div>
        </header>
        ${isDebtBlocked(state) ? `<div class="global-alert">${icon('alert')} Work halted: obligations ${money(state.debt)}.<button class="text-btn" data-route="bank">Open bank ${icon('arrow')}</button></div>` : ''}
        <main class="main-content" id="main-content">${this.page()}</main>
      </div>
      <div class="journal-backdrop ${this.journalOpen ? 'open' : ''}" data-action="journal"></div>
      <aside class="journal-drawer ${this.journalOpen ? 'open' : ''}" aria-label="Event journal"><div class="journal-header"><div><div class="eyebrow">Company chronicle</div><h2>Journal</h2></div><button class="icon-btn" data-action="journal" aria-label="Close journal">${icon('close')}</button></div><div class="journal-list">${[...state.journal].reverse().map(journalItem).join('')}</div><div class="journal-footer">Last ${state.journal.length} events · press J</div></aside>
      <dialog id="app-dialog" class="app-dialog"></dialog>
    </div>`
    const stage = document.createElement('div')
    stage.innerHTML = markup
    const source = stage.firstElementChild!
    const current = this.root.firstElementChild
    if (current) patchDom(current, source)
    else this.root.replaceChildren(source)
    document.querySelectorAll<HTMLInputElement>('[data-qty]').forEach((input) => {
      input.value = quantities.get(input.dataset.qty!) ?? input.value
      this.updateQuote(input)
    })
    if (companyNameValue !== null) {
      const input = document.querySelector<HTMLInputElement>('#company-name')
      if (input) input.value = companyNameValue
    }
    document.title = `${route.label} · Bulder`
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement
    const routeButton = target.closest<HTMLElement>('[data-route]')
    if (routeButton) {
      if (!this.state) return
      this.route = routeButton.dataset.route as Route
      this.navOpen = false
      this.render()
      return
    }
    const button = target.closest<HTMLButtonElement>('[data-action]')
    if (!button || button.disabled) return
    const action = button.dataset.action
    const id = button.dataset.id ?? ''
    switch (action) {
      case 'open-nav': if (this.state) { this.navOpen = true; this.render() } break
      case 'close-nav': if (this.state) { this.navOpen = false; this.render() } break
      case 'journal': if (this.state) { this.journalOpen = !this.journalOpen; this.render() } break
      case 'menu-new-game': void this.startNewGame(); break
      case 'menu-load':
        this.menuMode = 'load'
        this.menuBusy = true
        this.renderStartScreen()
        void this.refreshLoadScreen()
        break
      case 'menu-back':
        this.menuMode = 'start'
        this.menuSaves = []
        this.renderStartScreen()
        break
      case 'menu-quit': void this.quitToMenu(); break
      case 'load-save':
        this.menuBusy = true
        this.renderStartScreen()
        void this.loadSavedGame(button.dataset.file ?? '')
        break
      case 'select-avatar': this.state!.companyAvatar = Math.max(0, Math.min(5, Number(id))); this.commit({ ok: true, message: 'Company avatar updated.' }); break
      case 'save-company': this.saveCompanyName(); break
      case 'pause': togglePause(this.state!); this.commit(); break
      case 'speed': setSpeed(this.state!, Number(id) as Speed); this.commit(); break
      case 'new-game': this.confirmNewGame(); break
      case 'confirm-new-game': this.closeModal(); void this.startNewGame(); break
      case 'close-modal':
        if (this.state?.event || this.state?.seasonNotice) {
          this.notify('Choose an option.', 'error')
          break
        }
        this.closeModal(); break
      case 'event-option': {
        const [eventId, optionIndex] = id.split(':')
        this.closeModal()
        this.commit(resolveEvent(this.state!, eventId, Number(optionIndex)))
        break
      }
      case 'save-exit': void this.saveAndExit(); break
      case 'take-job': this.finish(takeJob(this.state!, id)); if (this.state!.projects.length) this.projectId = this.state!.projects.at(-1)!.id; break
      case 'open-project': this.projectId = id; this.route = 'construction'; this.render(); break
      case 'select-project': this.projectId = id; this.render(); break
      case 'hire': this.finish(hireWorker(this.state!, id, this.crewId)); break
      case 'fire': this.finish(fireWorker(this.state!, id, this.crewId)); break
      case 'crew': this.crewId = Number(id); this.render(); break
      case 'supplier':
        if (id === 'warehouse') this.marketTab = 'warehouse'
        else { this.supplier = id as SupplierId; this.marketTab = id as SupplierId }
        this.render()
        break
      case 'restock-from-warehouse': {
        const projectId = this.projectId ?? this.state!.projects[0]?.id
        if (projectId) this.finish(restockProjectFromWarehouse(this.state!, projectId))
        break
      }
      case 'restock-material': {
        const projectId = this.projectId ?? this.state!.projects[0]?.id
        const input = document.querySelector<HTMLInputElement>(`[data-qty="${id}"]`)
        if (projectId) this.finish(restockMaterialFromWarehouse(this.state!, projectId, id as MaterialId, Number(input?.value)))
        break
      }
      case 'buy-material': {
        const input = document.querySelector<HTMLInputElement>(`[data-qty="${id}"]`)
        this.finish(purchaseMaterial(this.state!, id as Parameters<typeof purchaseMaterial>[1], Number(input?.value), this.supplier))
        break
      }
      case 'buy-missing': {
        const projectId = this.projectId ?? this.state!.projects[0]?.id
        if (projectId) this.finish(buyMissingForProject(this.state!, projectId, this.supplier))
        break
      }
      case 'allocate': this.finish(allocateProjectStage(this.state!, id)); break
      case 'start-stage': this.finish(startCurrentStage(this.state!, id)); break
      case 'start-full': this.finish(startFullProject(this.state!, id)); break
      case 'buy-provision': this.finish(buyProvision(this.state!, id as ProvisionId)); break
      case 'buy-equipment': this.finish(acquireEquipment(this.state!, id as EquipmentId, 'owned')); break
      case 'rent-dialog': this.showRental(id as EquipmentId); break
      case 'lease-dialog': this.showLease(id as EquipmentId); break
      case 'confirm-rent': {
        const hours = Number(document.querySelector<HTMLInputElement>('#rent-hours')?.value)
        this.closeModal(); this.finish(acquireEquipment(this.state!, id as EquipmentId, 'rented', hours)); break
      }
      case 'confirm-lease': this.closeModal(); this.finish(acquireEquipment(this.state!, id as EquipmentId, 'leased')); break
      case 'sell-dialog': this.showSellEquipment(id); break
      case 'confirm-sell-equipment': this.closeModal(); this.finish(sellEquipment(this.state!, id)); break
      case 'research': this.finish(startResearch(this.state!, id)); break
      case 'loan': this.finish(takeLoan(this.state!, Number(id))); break
      case 'repay-debt': this.finish(repayDebt(this.state!)); break
      case 'report': this.showReport(id); break
      case 'acknowledge-season': this.state!.seasonNotice = null; this.state!.paused = false; this.closeModal(); this.commit(); break
      case 'welcome-start': this.state!.paused = false; this.closeModal(); break
    }
  }

  private onChange(event: Event): void {
    if (!this.state) return
    const input = event.target as HTMLInputElement | HTMLSelectElement
    const action = input.dataset.change
    if (action === 'assign-crew') this.finish(assignCrew(this.state, input.dataset.project!, Number(input.value), Number(input.dataset.slot ?? 0)))
    if (action === 'assign-equipment') {
      const project = this.state.projects.find((item) => item.id === input.dataset.project)
      if (project) this.finish(assignEquipment(this.state, project, input.value || null))
    }
    if (action === 'market-project') { this.projectId = input.value; this.render() }
  }

  private onInput(event: Event): void {
    const input = event.target as HTMLInputElement
    if (input.dataset.qty) this.updateQuote(input)
    if (input.id === 'rent-hours') {
      const equipment = equipmentById(input.dataset.equipment!)
      const output = document.querySelector('#rent-total')
      if (output) output.textContent = money(Number(input.value) * equipment.rentPerHour)
    }
  }

  private updateQuote(input: HTMLInputElement): void {
    const material = input.dataset.qty as Parameters<typeof quoteMaterial>[1]
    const output = document.querySelector(`[data-quote="${input.dataset.qty}"]`)
    if (output) output.textContent = money(quoteMaterial(this.state!, material, Number(input.value), this.supplier).total)
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement && event.target.id === 'company-name' && event.key === 'Enter') {
      event.preventDefault()
      this.saveCompanyName()
      return
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (!this.state) {
      if (event.key === 'Escape' && this.menuMode === 'load') {
        this.menuMode = 'start'
        this.renderStartScreen()
      }
      return
    }
    if (event.key.toLowerCase() === 'j') {
      event.preventDefault(); this.journalOpen = !this.journalOpen; this.render()
    }
    if (event.code === 'Space') { event.preventDefault(); togglePause(this.state); this.commit() }
    if (event.key === 'Escape') { this.journalOpen = false; this.navOpen = false; this.render() }
  }

  private finish(result: ActionResult): void {
    const tutorial = applyTutorialProgress(this.state!)
    this.save()
    this.render()
this.notify(result.message, result.ok ? 'success' : 'error')
    if (tutorial) this.notify(tutorial.reward > 0 ? `Step completed: ${tutorial.title} · +${tutorial.reward} reputation` : `Step completed: ${tutorial.title}`, 'success')
  }

  private commit(result?: ActionResult): void {
    const tutorial = applyTutorialProgress(this.state!)
    this.save()
    this.render()
    this.schedule()
    if (result) this.notify(result.message, result.ok ? 'success' : 'error')
    if (tutorial) this.notify(tutorial.reward > 0 ? `Step completed: ${tutorial.title} · +${tutorial.reward} reputation` : `Step completed: ${tutorial.title}`, 'success')
  }

  private save(): void {
    if (this.state && this.activeSave && !this.closing) void saveGame(this.state, this.activeSave)
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    const toast = document.createElement('div')
    toast.className = `toast toast-${tone}`
    toast.innerHTML = `${icon(tone === 'success' ? 'check' : 'alert')}<span>${esc(message)}</span>`
    document.body.append(toast)
    window.setTimeout(() => toast.remove(), 3_600)
  }

  private openModal(content: string, className?: string): void {
    const dialog = document.querySelector<HTMLDialogElement>('#app-dialog')
    if (!dialog) return
    dialog.classList.toggle('event-active', className === 'event-active')
    dialog.innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Close">${icon('close')}</button>${content}`
    dialog.showModal()
  }

  private closeModal(): void {
    document.querySelector<HTMLDialogElement>('#app-dialog')?.close()
    window.setTimeout(() => {
      if (!this.isEditing()) this.render()
    })
  }

  private confirmNewGame(): void {
    this.openModal(`<div class="modal-icon warning">${icon('alert')}</div><div class="eyebrow">Start over</div><h2>Create a new company?</h2><p>Current progress stays in its own save file; a new game will begin.</p><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Stay</button><button class="btn btn-danger" data-action="confirm-new-game">New game</button></div>`)
  }

  private async quitToMenu(): Promise<void> {
    if (isDesktop()) {
      this.closing = true
      try {
        await quitApp()
      } catch {
        this.closing = false
      }
    } else {
      this.notify('In the browser version the window cannot be closed — close the tab.', 'success')
    }
  }

  private showRental(id: EquipmentId): void {
    const item = equipmentById(id)
    this.openModal(`<div class="modal-icon">${icon('equipment')}</div><div class="eyebrow">Hourly rental</div><h2>${item.name}</h2><p>${money(item.rentPerHour)} per actual work hour. Hours are spent only on the assigned project.</p><label class="field"><span>Rental period, hours</span><input id="rent-hours" data-equipment="${id}" type="number" min="${item.minRentHours}" max="500" value="${item.minRentHours}" /></label><div class="modal-total"><span>To pay</span><strong id="rent-total">${money(item.minRentHours * item.rentPerHour)}</strong></div><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-rent" data-id="${id}">Rent</button></div>`)
  }

  private showLease(id: EquipmentId): void {
    const item = equipmentById(id)
    const discount = isResearched(this.state!, 'good_leasing') ? 0.92 : 1
    const total = Math.round(item.price * (1 + BALANCE.leaseInterest) * discount)
    const down = Math.round(item.price * BALANCE.leaseDownPayment)
    this.openModal(`<div class="modal-icon">${icon('document')}</div><div class="eyebrow">Lease for ${BALANCE.leaseDays} days</div><h2>${item.name}</h2><dl class="cost-list"><div><dt>Down payment 20%</dt><dd>${money(down)}</dd></div><div><dt>Full cost</dt><dd>${money(total)}</dd></div><div><dt>Daily payment</dt><dd>${money(Math.ceil((total - down) / BALANCE.leaseDays))}</dd></div><div><dt>Overpayment</dt><dd>${money(total - item.price)}</dd></div></dl><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-lease" data-id="${id}">Sign lease</button></div>`)
  }

  private showReport(id: string): void {
    const project = this.state!.completed.find((item) => item.id === id)
    if (!project) return
    const costs = projectCosts(project)
    const finalPayment = Math.max(0, project.job.budget - project.penalty - project.advance)
    this.openModal(`<div class="modal-icon success">${icon('document')}</div><div class="eyebrow">Financial report · day ${project.completedDay}</div><h2>${buildingById(project.job.building).name}</h2><p>${project.job.client} · ${project.totalHours} work hours</p><dl class="cost-list"><div><dt>Contract budget</dt><dd>${money(project.job.budget)}</dd></div>${project.advance ? `<div><dt>Advance received earlier</dt><dd>−${money(project.advance)}</dd></div>` : ''}${project.penalty ? `<div><dt>Late penalty</dt><dd class="negative">−${money(project.penalty)}</dd></div>` : ''}<div><dt>Payment on delivery</dt><dd class="positive">${money(finalPayment)}</dd></div><div><dt>Materials</dt><dd>−${money(project.materialCost)}</dd></div><div><dt>Labor</dt><dd>−${money(project.laborCost)}</dd></div><div><dt>Delivery</dt><dd>−${money(project.logisticsCost)}</dd></div><div><dt>Equipment</dt><dd>−${money(project.equipmentCost)}</dd></div>${project.factoringFee ? `<div><dt>Factoring fee</dt><dd>−${money(project.factoringFee)}</dd></div>` : ''}<div class="cost-total"><dt>Net profit</dt><dd class="${costs.profit >= 0 ? 'positive' : 'negative'}">${money(costs.profit)}</dd></div></dl><button class="btn btn-primary btn-block" data-action="close-modal">Close report</button>`)
  }

  private showSellEquipment(assetId: string): void {
    const asset = this.state!.equipment.find((item) => item.assetId === assetId)
    if (!asset) return
    const item = equipmentById(asset.id)
    const saleRate = this.state!.research.dealer_network?.status === 'done' ? 0.85 : 0.7
    const price = Math.round(item.price * saleRate)
    this.openModal(`<div class="modal-icon warning">${icon('equipment')}</div><div class="eyebrow">Selling equipment</div><h2>${item.name}</h2><p>Owned equipment can be sold for ${Math.round(saleRate * 100)}% of its original price. Equipment will be removed from the project if assigned.</p><dl class="cost-list"><div><dt>Original price</dt><dd>${money(item.price)}</dd></div><div><dt>Sale price</dt><dd class="positive">${money(price)}</dd></div><div><dt>Capital loss</dt><dd class="negative">−${money(item.price - price)}</dd></div></dl><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Cancel</button><button class="btn btn-danger" data-action="confirm-sell-equipment" data-id="${asset.assetId}">Sell</button></div>`)
  }

  private showEvent(): void {
    const state = this.state
    const id = state?.event
    if (!state || !id) return
    const def = eventById(id)
    state.paused = true
    this.render()
    const options = def.options.map((option, index) => {
      const repLocked = option.requiresReputation !== undefined && state.reputation < option.requiresReputation
      const cost = option.effect.cash ?? 0
      const poor = cost < 0 && (isDebtBlocked(state) || state.money - (-cost) < -overdraftLimit(state))
      const disabled = repLocked || poor
      const hint = repLocked ? `Requires ${option.requiresReputation} reputation` : poor ? 'Not enough funds' : option.hint ?? ''
      return `<div class="event-option"><button class="btn btn-primary btn-block" data-action="event-option" data-id="${def.id}:${index}" ${disabled ? 'disabled' : ''}>${esc(option.label)}</button>${hint ? `<span class="event-effect">${esc(hint)}</span>` : ''}</div>`
    }).join('')
    this.openModal(`<div class="event-modal">
      <img class="event-portrait" src="${eventPortrait(def.id)}" alt="${esc(def.eyebrow)}">
      <div>
        <div class="modal-icon warning">${icon('phone')}</div>
        <div class="eyebrow">${esc(def.eyebrow)}</div>
        <h2>${esc(def.title)}</h2>
        <p>${esc(def.text)}</p>
        <div class="event-options">${options}</div>
      </div>
    </div>`, 'event-active')
  }

  private showSeasonNotice(): void {
    const notice = this.state!.seasonNotice
    if (!notice) return
    this.state!.paused = true
    this.render()
    this.openModal(`<div class="modal-icon ${notice.success ? 'success' : 'warning'}">${icon(notice.success ? 'star' : 'alert')}</div><div class="eyebrow">Season summary</div><h2>${notice.title}</h2><p>${notice.text}</p>${notice.final ? `<p>The company completed all ten seasons. You may continue in free mode.</p>` : ''}<div class="goal-modal-stats">${badge(compactMoney(netWorth(this.state!)), notice.success ? 'success' : 'warning')}${badge(`${this.state!.reputation} reputation`, 'info')}</div><button class="btn btn-primary btn-block" data-action="acknowledge-season">Start next season ${icon('arrow')}</button>`)
  }
}