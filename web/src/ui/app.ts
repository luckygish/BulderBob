import { acknowledgeGoal, assignCrew, buyMissingForProject, buyProvision, fireWorker, hireWorker, setSpeed, startCurrentStage, startFullProject, startResearch, takeJob, togglePause, allocateProjectStage } from '../game/actions'
import { BALANCE } from '../game/balance'
import { buildingById, equipmentById } from '../game/catalog'
import { acquireEquipment, assignEquipment, createNewGame, isResearched, netWorth, purchaseMaterial, quoteMaterial, repayDebt, takeLoan, tickHour } from '../game/engine'
import { clearSave, loadGame, saveGame } from '../game/persistence'
import { projectCosts, seasonGoalMet } from '../game/selectors'
import type { ActionResult, EquipmentId, GameState, ProvisionId, Speed, SupplierId } from '../game/types'
import { badge, compactMoney, esc, journalItem, money, pad } from './components'
import { icon } from './icons'
import { renderBank } from './pages/bank'
import { renderCompetitors } from './pages/competitors'
import { renderConstruction } from './pages/construction'
import { renderEquipment } from './pages/equipment'
import { renderHr } from './pages/hr'
import { renderJobs } from './pages/jobs'
import { renderMarket } from './pages/market'
import { renderOverview } from './pages/overview'
import { renderTechnology } from './pages/technology'
import { patchDom } from './dom'
import { ROUTES } from './types'
import type { Route, ViewContext } from './types'

export class App {
  private state: GameState
  private route: Route = 'overview'
  private projectId: string | null = null
  private supplier: SupplierId = 'north'
  private crewId = 0
  private journalOpen = false
  private navOpen = false
  private timer: number | undefined
  private root: HTMLElement

  constructor(root: HTMLElement) {
    this.root = root
    this.state = loadGame() ?? createNewGame()
    this.projectId = this.state.projects[0]?.id ?? null
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
      if (document.hidden && !this.state.paused) {
        this.state.paused = true
        this.save()
        this.render()
      }
    })
    window.addEventListener('beforeunload', () => this.save())
  }

  start(): void {
    this.render()
    this.schedule()
    if (seasonGoalMet(this.state) && !this.state.goalAcknowledged) this.showGoal()
  }

  private schedule(): void {
    window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => {
      if (!this.state.paused) {
        tickHour(this.state)
        this.save()
        if (!this.isEditing()) this.render()
        if (seasonGoalMet(this.state) && !this.state.goalAcknowledged) this.showGoal()
      }
      this.schedule()
    }, this.state.paused ? 500 : BALANCE.hourMs[this.state.speed])
  }

  private isEditing(): boolean {
    const active = document.activeElement
    return active instanceof HTMLSelectElement || active instanceof HTMLInputElement || Boolean(document.querySelector('dialog[open]'))
  }

  private context(): ViewContext {
    return { state: this.state, route: this.route, projectId: this.projectId, supplier: this.supplier, crewId: this.crewId }
  }

  private page(): string {
    const ctx = this.context()
    switch (this.route) {
      case 'jobs': return renderJobs(ctx)
      case 'construction': return renderConstruction(ctx)
      case 'market': return renderMarket(ctx)
      case 'hr': return renderHr(ctx)
      case 'equipment': return renderEquipment(ctx)
      case 'technology': return renderTechnology(ctx)
      case 'bank': return renderBank(ctx)
      case 'competitors': return renderCompetitors(ctx)
      default: return renderOverview(ctx)
    }
  }

  private render(): void {
    const quantities = new Map<string, string>()
    document.querySelectorAll<HTMLInputElement>('[data-qty]').forEach((input) => quantities.set(input.dataset.qty!, input.value))
    const route = ROUTES.find((item) => item.id === this.route)!
    const work = this.state.hour >= BALANCE.workDayStart && this.state.hour < BALANCE.workDayEnd
    const markup = `<div class="app-shell ${this.navOpen ? 'nav-open' : ''}">
      <aside class="sidebar" aria-label="Основная навигация">
        <div class="brand"><span class="brand-mark">${icon('logo')}</span><div><strong>Bulder</strong><span>Строим бизнес</span></div><button class="icon-btn sidebar-close" data-action="close-nav" aria-label="Закрыть меню">${icon('close')}</button></div>
        <div class="company-chip"><span class="company-avatar">ВК</span><div><strong>Ваша компания</strong><span>ИЖС · частный подряд</span></div><span class="status-dot"></span></div>
        <nav class="main-nav">${ROUTES.map((item) => `<button class="nav-item ${item.id === this.route ? 'active' : ''}" data-route="${item.id}" ${item.id === this.route ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${item.label}</span>${item.id === 'construction' && this.state.projects.length ? `<em>${this.state.projects.length}</em>` : ''}${item.id === 'jobs' && this.state.jobs.length ? `<small>${this.state.jobs.length}</small>` : ''}</button>`).join('')}</nav>
        <div class="sidebar-season"><div class="eyebrow">Текущий сезон</div><div><strong>День ${this.state.day}</strong><span>/ ${BALANCE.seasonDays}</span></div><div class="season-track"><span style="width:${Math.min(100, this.state.day / BALANCE.seasonDays * 100)}%"></span></div><p>Капитал ${compactMoney(netWorth(this.state))}</p></div>
        <div class="sidebar-footer"><span class="status-dot"></span> Локальная игра · сохранено</div>
      </aside>
      <button class="nav-backdrop" data-action="close-nav" aria-label="Закрыть меню"></button>
      <div class="workspace">
        <header class="topbar"><div class="topbar-context"><button class="icon-btn mobile-menu" data-action="open-nav" aria-label="Открыть меню">${icon('menu')}</button><div><span>${route.label}</span><strong>${this.state.paused ? 'Игра на паузе' : work ? 'Рабочий день' : 'Ночное время'}</strong></div></div>
          <div class="topbar-metrics"><div class="top-metric money-metric"><span>На счёте</span><strong>${compactMoney(this.state.money)}</strong></div><div class="top-metric"><span>${icon('clock')} День ${this.state.day}</span><strong>${pad(this.state.hour)}:00</strong></div><div class="top-metric reputation-metric"><span>Репутация</span><strong>${icon('star')} ${this.state.reputation}</strong></div></div>
          <div class="time-controls"><button class="btn btn-small ${this.state.paused ? 'btn-primary' : 'btn-secondary'}" data-action="pause" aria-label="${this.state.paused ? 'Продолжить' : 'Пауза'}">${icon(this.state.paused ? 'play' : 'pause')}<span>${this.state.paused ? 'Продолжить' : 'Пауза'}</span></button><div class="speed-control" aria-label="Скорость игры">${([1, 2, 4] as Speed[]).map((speed) => `<button class="${this.state.speed === speed && !this.state.paused ? 'active' : ''}" data-action="speed" data-id="${speed}" aria-label="Скорость ×${speed}">×${speed}</button>`).join('')}</div></div>
          <div class="topbar-actions"><button class="icon-btn ${this.journalOpen ? 'active' : ''}" data-action="journal" aria-label="Журнал (J)">${icon('journal')}</button><button class="icon-btn" data-action="new-game" aria-label="Новая игра" title="Новая игра">${icon('plus')}</button></div>
        </header>
        ${this.state.debt > 0 ? `<div class="global-alert">${icon('alert')} Работа остановлена: обязательства ${money(this.state.debt)}.<button class="text-btn" data-route="bank">Открыть банк ${icon('arrow')}</button></div>` : ''}
        <main class="main-content" id="main-content">${this.page()}</main>
      </div>
      <div class="journal-backdrop ${this.journalOpen ? 'open' : ''}" data-action="journal"></div>
      <aside class="journal-drawer ${this.journalOpen ? 'open' : ''}" aria-label="Журнал событий"><div class="journal-header"><div><div class="eyebrow">Хроника компании</div><h2>Журнал</h2></div><button class="icon-btn" data-action="journal" aria-label="Закрыть журнал">${icon('close')}</button></div><div class="journal-list">${[...this.state.journal].reverse().map(journalItem).join('')}</div><div class="journal-footer">Последние ${this.state.journal.length} событий · клавиша J</div></aside>
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
    document.title = `${route.label} · Bulder`
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement
    const routeButton = target.closest<HTMLElement>('[data-route]')
    if (routeButton) {
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
      case 'open-nav': this.navOpen = true; this.render(); break
      case 'close-nav': this.navOpen = false; this.render(); break
      case 'journal': this.journalOpen = !this.journalOpen; this.render(); break
      case 'pause': togglePause(this.state); this.commit(); break
      case 'speed': setSpeed(this.state, Number(id) as Speed); this.commit(); break
      case 'new-game': this.confirmNewGame(); break
      case 'confirm-new-game': this.state = createNewGame(); this.projectId = null; this.route = 'overview'; this.closeModal(); clearSave(); this.commit({ ok: true, message: 'Новая компания создана.' }); break
      case 'close-modal': this.closeModal(); break
      case 'take-job': this.finish(takeJob(this.state, id)); if (this.state.projects.length) { this.projectId = this.state.projects.at(-1)!.id; this.route = 'construction'; this.render() } break
      case 'open-project': this.projectId = id; this.route = 'construction'; this.render(); break
      case 'select-project': this.projectId = id; this.render(); break
      case 'hire': this.finish(hireWorker(this.state, id, this.crewId)); break
      case 'fire': this.finish(fireWorker(this.state, id, this.crewId)); break
      case 'crew': this.crewId = Number(id); this.render(); break
      case 'supplier': this.supplier = id as SupplierId; this.render(); break
      case 'buy-material': {
        const input = document.querySelector<HTMLInputElement>(`[data-qty="${id}"]`)
        this.finish(purchaseMaterial(this.state, id as Parameters<typeof purchaseMaterial>[1], Number(input?.value), this.supplier))
        break
      }
      case 'buy-missing': {
        const projectId = this.projectId ?? this.state.projects[0]?.id
        if (projectId) this.finish(buyMissingForProject(this.state, projectId, this.supplier))
        break
      }
      case 'allocate': this.finish(allocateProjectStage(this.state, id)); break
      case 'start-stage': this.finish(startCurrentStage(this.state, id)); break
      case 'start-full': this.finish(startFullProject(this.state, id)); break
      case 'buy-provision': this.finish(buyProvision(this.state, id as ProvisionId)); break
      case 'buy-equipment': this.finish(acquireEquipment(this.state, id as EquipmentId, 'owned')); break
      case 'rent-dialog': this.showRental(id as EquipmentId); break
      case 'lease-dialog': this.showLease(id as EquipmentId); break
      case 'confirm-rent': {
        const hours = Number(document.querySelector<HTMLInputElement>('#rent-hours')?.value)
        this.closeModal(); this.finish(acquireEquipment(this.state, id as EquipmentId, 'rented', hours)); break
      }
      case 'confirm-lease': this.closeModal(); this.finish(acquireEquipment(this.state, id as EquipmentId, 'leased')); break
      case 'research': this.finish(startResearch(this.state, id)); break
      case 'loan': this.finish(takeLoan(this.state, Number(id))); break
      case 'repay-debt': this.finish(repayDebt(this.state)); break
      case 'report': this.showReport(id); break
      case 'acknowledge-goal': acknowledgeGoal(this.state); this.closeModal(); this.commit(); break
    }
  }

  private onChange(event: Event): void {
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
    if (output) output.textContent = money(quoteMaterial(this.state, material, Number(input.value), this.supplier).total)
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    if (event.key.toLowerCase() === 'j' || event.key.toLowerCase() === 'о') {
      event.preventDefault(); this.journalOpen = !this.journalOpen; this.render()
    }
    if (event.code === 'Space') { event.preventDefault(); togglePause(this.state); this.commit() }
    if (event.key === 'Escape') { this.journalOpen = false; this.navOpen = false; this.render() }
  }

  private finish(result: ActionResult): void {
    this.save()
    this.render()
    this.notify(result.message, result.ok ? 'success' : 'error')
  }

  private commit(result?: ActionResult): void {
    this.save()
    this.render()
    this.schedule()
    if (result) this.notify(result.message, result.ok ? 'success' : 'error')
  }

  private save(): void {
    saveGame(this.state)
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    const toast = document.createElement('div')
    toast.className = `toast toast-${tone}`
    toast.innerHTML = `${icon(tone === 'success' ? 'check' : 'alert')}<span>${esc(message)}</span>`
    document.body.append(toast)
    window.setTimeout(() => toast.remove(), 3_600)
  }

  private openModal(content: string): void {
    const dialog = document.querySelector<HTMLDialogElement>('#app-dialog')!
    dialog.innerHTML = `<button class="icon-btn modal-close" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button>${content}`
    dialog.showModal()
  }

  private closeModal(): void {
    document.querySelector<HTMLDialogElement>('#app-dialog')?.close()
    window.setTimeout(() => {
      if (!this.isEditing()) this.render()
    })
  }

  private confirmNewGame(): void {
    this.openModal(`<div class="modal-icon warning">${icon('alert')}</div><div class="eyebrow">Начать заново</div><h2>Создать новую компанию?</h2><p>Текущий прогресс, сохранение и история объектов будут удалены. Это действие нельзя отменить.</p><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Остаться</button><button class="btn btn-danger" data-action="confirm-new-game">Новая игра</button></div>`)
  }

  private showRental(id: EquipmentId): void {
    const item = equipmentById(id)
    this.openModal(`<div class="modal-icon">${icon('equipment')}</div><div class="eyebrow">Почасовая аренда</div><h2>${item.name}</h2><p>${money(item.rentPerHour)} за фактический рабочий час. Часы расходуются только на назначенном объекте.</p><label class="field"><span>Срок аренды, часов</span><input id="rent-hours" data-equipment="${id}" type="number" min="${item.minRentHours}" max="500" value="${item.minRentHours}" /></label><div class="modal-total"><span>К оплате</span><strong id="rent-total">${money(item.minRentHours * item.rentPerHour)}</strong></div><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Отмена</button><button class="btn btn-primary" data-action="confirm-rent" data-id="${id}">Арендовать</button></div>`)
  }

  private showLease(id: EquipmentId): void {
    const item = equipmentById(id)
    const discount = isResearched(this.state, 'good_leasing') ? 0.95 : 1
    const total = Math.round(item.price * (1 + BALANCE.leaseInterest) * discount)
    const down = Math.round(item.price * BALANCE.leaseDownPayment)
    this.openModal(`<div class="modal-icon">${icon('document')}</div><div class="eyebrow">Лизинг на ${BALANCE.leaseDays} дней</div><h2>${item.name}</h2><dl class="cost-list"><div><dt>Первый взнос 20%</dt><dd>${money(down)}</dd></div><div><dt>Полная стоимость</dt><dd>${money(total)}</dd></div><div><dt>Платёж в день</dt><dd>${money(Math.ceil((total - down) / BALANCE.leaseDays))}</dd></div><div><dt>Переплата</dt><dd>${money(total - item.price)}</dd></div></dl><div class="button-row modal-actions"><button class="btn btn-secondary" data-action="close-modal">Отмена</button><button class="btn btn-primary" data-action="confirm-lease" data-id="${id}">Оформить лизинг</button></div>`)
  }

  private showReport(id: string): void {
    const project = this.state.completed.find((item) => item.id === id)
    if (!project) return
    const costs = projectCosts(project)
    this.openModal(`<div class="modal-icon success">${icon('document')}</div><div class="eyebrow">Финансовый отчёт · день ${project.completedDay}</div><h2>${buildingById(project.job.building).name}</h2><p>${project.job.client} · ${project.totalHours} рабочих часов</p><dl class="cost-list"><div><dt>Выручка по договору</dt><dd>${money(project.job.budget)}</dd></div><div><dt>Материалы</dt><dd>−${money(project.materialCost)}</dd></div><div><dt>Труд</dt><dd>−${money(project.laborCost)}</dd></div><div><dt>Доставка</dt><dd>−${money(project.logisticsCost)}</dd></div><div><dt>Техника</dt><dd>−${money(project.equipmentCost)}</dd></div>${project.penalty ? `<div><dt>Штраф за срок</dt><dd class="negative">−${money(project.penalty)}</dd></div>` : ''}<div class="cost-total"><dt>Чистая прибыль</dt><dd class="${costs.profit >= 0 ? 'positive' : 'negative'}">${money(costs.profit)}</dd></div></dl><button class="btn btn-primary btn-block" data-action="close-modal">Закрыть отчёт</button>`)
  }

  private showGoal(): void {
    this.state.paused = true
    this.render()
    this.openModal(`<div class="modal-icon success">${icon('star')}</div><div class="eyebrow">Цель сезона достигнута</div><h2>Компания состоялась</h2><p>Капитал и репутация достигли целевых значений за ${this.state.day} дней. Можно продолжить игру без ограничения срока.</p><div class="goal-modal-stats">${badge(compactMoney(netWorth(this.state)), 'success')}${badge(`${this.state.reputation} репутации`, 'info')}</div><button class="btn btn-primary btn-block" data-action="acknowledge-goal">Продолжить развитие ${icon('arrow')}</button>`)
  }
}
