import { SKILLS, WORKER_TYPES } from '../../game/catalog'
import { crewEfficiency, crewHourly, maxCrews, workerBonus } from '../../game/engine'
import { badge, money, pageHeading } from '../components'
import { icon } from '../icons'
import type { Worker } from '../../game/types'
import type { ViewContext } from '../types'

function skills(worker: Worker): string {
  return worker.skills.map((id) => `<span title="${SKILLS[id].description}">${badge(SKILLS[id].name, SKILLS[id].negative ? 'danger' : id === 'tudyaga' || id === 'thrifty' ? 'success' : 'info')}</span>`).join('')
}

export function renderHr(ctx: ViewContext): string {
  const { state } = ctx
  const crewId = Math.min(ctx.crewId, maxCrews(state) - 1)
  const crew = state.crews[crewId]
  const efficiency = crewEfficiency(crew.workers, workerBonus(state))
  const hourly = crewHourly(crew.workers)
  return `${pageHeading('Люди и эффективность', 'Кадры', 'Собирайте бригаду не по ставке, а по стоимости эффективного часа.', badge(`${state.candidates.length} кандидатов`, 'info'))}
    <div class="hr-layout">
      <section class="card"><div class="card-header"><div><div class="eyebrow">Рынок труда</div><h2>Доступные специалисты</h2></div><span class="muted">До 2 навыков · обновление ежедневно</span></div><div class="candidate-list">${state.candidates.map((worker) => {
        const def = WORKER_TYPES[worker.type]
        return `<article class="candidate-card"><div class="worker-avatar">${worker.name.slice(0, 1)}</div><div class="candidate-main"><div class="candidate-name"><h3>${worker.name}</h3>${badge(def.name, worker.type === 'foreman' ? 'warning' : 'neutral')}</div><div class="skill-list">${skills(worker)}</div><div class="candidate-meta"><span>Эффективность <strong>${def.efficiency.toFixed(1)}</strong></span><span>Ставка <strong>${money(worker.rate)}/ч</strong></span></div></div><button class="btn btn-small btn-secondary" data-action="hire" data-id="${worker.id}" ${crew.workers.length >= 3 ? 'disabled' : ''}>${icon('plus')} В бригаду №${crewId + 1}</button></article>`
      }).join('')}</div></section>
      <aside class="card crew-panel"><div class="eyebrow">Состав команды</div><div class="segmented crew-tabs">${Array.from({ length: maxCrews(state) }, (_, i) => `<button class="${i === crewId ? 'active' : ''}" data-action="crew" data-id="${i}">Бригада №${i + 1}</button>`).join('')}</div><div class="crew-stats"><div><span>Эффективность</span><strong>${efficiency.toFixed(1)}</strong><small>чел.-ч / час</small></div><div><span>Смена 10 ч</span><strong>${money(hourly * 10)}</strong><small>${money(hourly)} / час</small></div></div>
        <div class="crew-list">${crew.workers.length ? crew.workers.map((worker) => `<article class="crew-worker"><div class="worker-avatar small">${worker.name.slice(0, 1)}</div><div><strong>${worker.name}</strong><span>${WORKER_TYPES[worker.type].name} · ${money(worker.rate)}/ч</span><div class="skill-list">${skills(worker)}</div></div><button class="icon-btn danger" data-action="fire" data-id="${worker.id}" aria-label="Уволить ${worker.name}">${icon('close')}</button></article>`).join('') : `<div class="crew-empty">${icon('hr')}<strong>Бригада пуста</strong><span>Наймите до 3 кандидатов из списка слева.</span></div>`}</div>
        ${crew.workers.length < 3 ? `<div class="crew-slots">${Array.from({ length: 3 - crew.workers.length }, () => '<span>Свободное место</span>').join('')}</div>` : ''}
        <div class="notice notice-neutral">${icon('trend')}<div><strong>${hourly && efficiency ? money(hourly / efficiency) : '—'} / эффективный час</strong><span>Ночная работа оплачивается с коэффициентом ×1.5. Особые проекты могут требовать две бригады.</span></div></div>
      </aside>
    </div>`
}
