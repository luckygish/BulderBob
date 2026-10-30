import { SKILLS, WORKER_TYPES } from '../../game/catalog'
import { crewEfficiency, crewHourly, maxCrews, maxCrewSize, workerBonus } from '../../game/engine'
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
  return `${pageHeading('People and efficiency', 'HR', 'Build your crew by effective hour cost, not by rate.', badge(`${state.candidates.length} candidates`, 'info'))}
    <div class="hr-layout">
      <section class="card"><div class="card-header"><div><div class="eyebrow">Labor market</div><h2>Available specialists</h2></div><span class="muted">Up to 2 skills · refresh every 3 days</span></div><div class="candidate-list">${state.candidates.map((worker) => {
        const def = WORKER_TYPES[worker.type]
        return `<article class="candidate-card"><div class="worker-avatar">${worker.name.slice(0, 1)}</div><div class="candidate-main"><div class="candidate-name"><h3>${worker.name}</h3>${badge(def.name, worker.type === 'foreman' ? 'warning' : 'neutral')}</div><div class="skill-list">${skills(worker)}</div><div class="candidate-meta"><span>Efficiency <strong>${def.efficiency.toFixed(1)}</strong></span><span>Rate <strong>${money(worker.rate)}/h</strong></span></div></div><button class="btn btn-small btn-secondary" data-action="hire" data-id="${worker.id}" ${crew.workers.length >= maxCrewSize(state) ? 'disabled' : ''}>${icon('plus')} To crew #${crewId + 1}</button></article>`
      }).join('')}</div></section>
      <aside class="card crew-panel"><div class="eyebrow">Team composition</div><div class="segmented crew-tabs">${Array.from({ length: maxCrews(state) }, (_, i) => `<button class="${i === crewId ? 'active' : ''}" data-action="crew" data-id="${i}">Crew #${i + 1}</button>`).join('')}</div><div class="crew-stats"><div><span>Efficiency</span><strong>${efficiency.toFixed(1)}</strong><small>man-hours / hour</small></div><div><span>10 h shift</span><strong>${money(hourly * 10)}</strong><small>${money(hourly)} / hour</small></div></div>
        <div class="crew-list">${crew.workers.length ? crew.workers.map((worker) => `<article class="crew-worker"><div class="worker-avatar small">${worker.name.slice(0, 1)}</div><div><strong>${worker.name}</strong><span>${WORKER_TYPES[worker.type].name} · ${money(worker.rate)}/h</span><div class="skill-list">${skills(worker)}</div></div><button class="icon-btn danger" data-action="fire" data-id="${worker.id}" aria-label="Fire ${worker.name}">${icon('close')}</button></article>`).join('') : `<div class="crew-empty">${icon('hr')}<strong>Crew is empty</strong><span>Hire up to ${maxCrewSize(state)} candidates from the list on the left.</span></div>`}</div>
        ${crew.workers.length < maxCrewSize(state) ? `<div class="crew-slots">${Array.from({ length: maxCrewSize(state) - crew.workers.length }, () => '<span>Open slot</span>').join('')}</div>` : ''}
        <div class="notice notice-neutral">${icon('trend')}<div><strong>${hourly && efficiency ? money(hourly / efficiency) : '—'} / effective hour</strong><span>Night shifts: Night owl opens the evening until midnight (90% efficiency, +10% rate), Automation enables 24/7 construction with 75% night efficiency and ×1.5 rate. Special projects may require two crews.</span></div></div>
      </aside>
    </div>`
}