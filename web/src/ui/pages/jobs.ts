import { BALANCE } from '../../game/balance'
import { buildingById } from '../../game/catalog'
import { maxProjects } from '../../game/engine'
import { activeProjectLimitText, estimateJob } from '../../game/selectors'
import { badge, money, pageHeading, percent } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderJobs(ctx: ViewContext): string {
  const { state } = ctx
  const full = state.projects.length >= maxProjects(state)
  return `${pageHeading('Рынок подрядов', 'Доска заказов', 'Сравнивайте не только бюджет, но и маржу, трудоёмкость и срок.', badge(`${activeProjectLimitText(state)} объектов`, full ? 'warning' : 'info'))}
    <div class="notice notice-info">${icon('trend')}<div><strong>Оценка перед контрактом</strong><span>Материалы — по ценам базы «Север», труд — по текущей бригаде. Техника и доставка рассчитываются отдельно.</span></div></div>
    ${full ? `<div class="notice notice-warning">${icon('alert')}<div><strong>Достигнут лимит объектов</strong><span>Завершите текущий проект или исследуйте следующий уровень планирования.</span></div></div>` : ''}
    <section class="jobs-grid">${state.jobs.map((job) => {
      const def = buildingById(job.building)
      const estimate = estimateJob(state, job)
      const daysLeft = job.deadline - state.day
      const boardDays = job.expiresDay - state.day
      const tone = estimate.margin >= 0.25 ? 'success' : estimate.margin >= 0.12 ? 'warning' : 'danger'
      const locked = job.special && state.reputation < def.minReputation
      return `<article class="card job-card ${job.special ? 'special-job' : ''}">
        <div class="job-card-top"><span class="building-mark">${def.short}</span><div class="job-badges">${job.special ? badge('Особый', 'warning') : badge(daysLeft <= 7 ? 'Срочный' : 'Подряд', daysLeft <= 7 ? 'warning' : 'neutral')}${job.special ? badge(`До дня ${job.expiresDay}`, 'info') : ''}${badge(percent(estimate.margin), tone)}</div></div>
        <div class="job-title"><h2>${def.name}</h2><p>${job.client}</p></div>
        ${job.special ? (locked
          ? `<div class="notice notice-warning">${icon('lock')}<div><strong>Нужно ${def.minReputation} репутации</strong><span>Сейчас у вас ${state.reputation}. Выполняйте шаги прогресса и сдавайте объекты.</span></div></div>`
          : `<div class="notice notice-neutral">${icon('star')}<div><strong>+${def.reputationReward ?? 2} репутации</strong><span>Нужно бригад: ${def.requiredCrews ?? 1}. На этапах потребуется спецтехника.</span></div></div>`) : ''}
        <div class="job-budget"><span>Бюджет контракта</span><strong>${money(job.budget)}</strong></div>
        <div class="job-stats"><div><span>Материалы ≈</span><strong>${money(estimate.materials)}</strong></div><div><span>Труд ≈</span><strong>${money(estimate.labor)}</strong></div><div><span>Прибыль ≈</span><strong class="${estimate.profit >= 0 ? 'positive' : 'negative'}">${money(estimate.profit)}</strong></div><div><span>Старт ≈</span><strong>${money(estimate.startup)}</strong></div></div>
        <div class="job-deadline">${icon('clock')}<div><strong>${daysLeft} дн. до сдачи</strong><span>≈ ${estimate.days} раб. дн. · ${estimate.manHours} чел.-ч${job.special ? ` · на доске ещё ${boardDays} дн.` : ''}</span></div></div>
        <button class="btn ${estimate.margin >= 0.12 ? 'btn-primary' : 'btn-secondary'} btn-block" data-action="take-job" data-id="${job.id}" ${full || locked ? 'disabled' : ''}>${locked ? `${icon('lock')} Требуется ${def.minReputation} репутации` : `Взять в работу ${icon('arrow')}`}</button>
      </article>`
    }).join('')}</section>
    <div class="footnote">Новые подряды появляются ежедневно. Особые проекты — каждые ${BALANCE.restockDays} дня с вероятностью ${Math.round(BALANCE.specialJobChance * 100)}%, требуют репутацию от 75 и быстро уходят с доски.</div>`
}
