import { BALANCE } from '../../game/balance'
import { buildingById } from '../../game/catalog'
import { netWorth } from '../../game/engine'
import { quickStartHint } from '../../game/actions'
import { capitalProgress, projectProgress, seasonGoalMet } from '../../game/selectors'
import { badge, compactMoney, journalItem, money, pageHeading, percent, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderOverview(ctx: ViewContext): string {
  const { state } = ctx
  const worth = netWorth(state)
  const active = state.projects
  const nextStep = quickStartHint(state)
  const leaseDaily = state.equipment.reduce((sum, asset) => sum + (asset.status === 'leased' ? asset.leaseDaily : 0), 0)
  const recent = state.journal.slice(-4).reverse()
  return `${pageHeading('Центр управления', `Добрый день, директор`, 'Главные показатели и задачи вашей строительной компании.', `<button class="btn btn-primary" data-route="jobs">${icon('plus')} Найти заказ</button>`)}
    <section class="season-card">
      <div class="season-icon">${icon('hardhat')}</div>
      <div class="season-copy"><div class="eyebrow">Сезон · день ${state.day} из ${BALANCE.seasonDays}</div><h2>${seasonGoalMet(state) ? 'Цель сезона достигнута' : 'От двора — к городскому масштабу'}</h2><p>Цель: ${money(BALANCE.goalCapital)} капитала и ${BALANCE.goalReputation} репутации.</p></div>
      <div class="season-progress"><div><span>Капитал</span><strong>${compactMoney(worth)}</strong></div>${progress(capitalProgress(state))}<div class="season-rep">${icon('star')} Репутация <strong>${state.reputation}</strong></div></div>
    </section>
    <section class="kpi-grid">
      <article class="kpi-card"><div class="kpi-icon orange">${icon('wallet')}</div><div><span>Свободные деньги</span><strong>${compactMoney(state.money)}</strong><small>${state.debt ? `Долг ${money(state.debt)}` : 'Обязательств нет'}</small></div></article>
      <article class="kpi-card"><div class="kpi-icon teal">${icon('construction')}</div><div><span>Активные объекты</span><strong>${active.length}</strong><small>${state.completed.length} сдано за сезон</small></div></article>
      <article class="kpi-card"><div class="kpi-icon blue">${icon('star')}</div><div><span>Репутация</span><strong>${state.reputation}<em>/100</em></strong><small>${state.reputation >= 60 ? 'Доступны премиальные заказы' : 'Растите с каждой сдачей'}</small></div></article>
      <article class="kpi-card"><div class="kpi-icon sand">${icon('bank')}</div><div><span>Платежи завтра</span><strong>${compactMoney((state.loan?.daily ?? 0) + leaseDaily)}</strong><small>Кредит и лизинг</small></div></article>
    </section>
    <div class="dashboard-grid">
      <section class="card next-step-card"><div class="card-header"><div><div class="eyebrow">Следующий шаг</div><h2>${nextStep}</h2></div><span class="step-number">01</span></div><p>Соберите ресурсы заранее, чтобы не потерять маржу на срочных закупках и простое бригады.</p><div class="next-step-route"><span>${icon('document')} Подсказка учитывает текущее состояние</span><button class="text-btn" data-route="${active.length ? 'construction' : 'jobs'}">Перейти ${icon('arrow')}</button></div></section>
      <section class="card"><div class="card-header"><div><div class="eyebrow">Лента компании</div><h2>Последние события</h2></div><button class="icon-btn" data-action="journal" aria-label="Открыть журнал">${icon('journal')}</button></div><div class="mini-journal">${recent.map(journalItem).join('')}</div></section>
    </div>
    <section class="section-block"><div class="section-title"><div><h2>Объекты в работе</h2><p>Сроки и ход строительства</p></div><button class="text-btn" data-route="construction">Все объекты ${icon('arrow')}</button></div>
      ${active.length ? `<div class="project-mini-grid">${active.map((project) => `<article class="card project-mini"><div class="project-mini-top"><span class="building-mark">${buildingById(project.job.building).short}</span>${badge(project.started ? 'Строится' : 'Подготовка', project.started ? 'success' : 'warning')}</div><h3>${buildingById(project.job.building).name}</h3><p>${project.job.client}</p>${progress(projectProgress(project), 'Общий прогресс')}<div class="project-mini-footer"><span>${icon('clock')} Срок: день ${project.job.deadline}</span><button class="text-btn" data-action="open-project" data-id="${project.id}">Открыть ${icon('chevron')}</button></div></article>`).join('')}</div>` : `<div class="card inline-empty">${icon('construction')}<div><strong>Площадки свободны</strong><p>Возьмите заказ, чтобы начать первый объект.</p></div><button class="btn btn-secondary" data-route="jobs">К заказам</button></div>`}
    </section>
    ${state.completed.length ? `<section class="card completed-banner"><div class="kpi-icon teal">${icon('check')}</div><div><span>Последний результат</span><strong>${buildingById(state.completed[0].job.building).name} · ${money(state.completed[0].profit)}</strong></div><span class="muted">Чистая прибыль</span></section>` : ''}
    <footer class="dashboard-footer"><span>Выручка за сезон: <strong>${money(state.totalRevenue)}</strong></span><span>Завершено дней: <strong>${percent(Math.min(1, state.day / BALANCE.seasonDays))}</strong></span></footer>`
}
