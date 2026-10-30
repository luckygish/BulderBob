import { BALANCE } from '../../game/balance'
import { buildingById } from '../../game/catalog'
import { isLicenseUnlocked, maxProjects } from '../../game/engine'
import { activeProjectLimitText, estimateJob } from '../../game/selectors'
import { badge, money, pageHeading, percent } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderJobs(ctx: ViewContext): string {
  const { state } = ctx
  const full = state.projects.length >= maxProjects(state)
  return `${pageHeading('Contract market', 'Job board', 'Compare not only the budget but also margin, labor and deadline.', badge(`${activeProjectLimitText(state)} projects`, full ? 'warning' : 'info'))}
    <div class="notice notice-info">${icon('trend')}<div><strong>Estimate before the contract</strong><span>Materials at North yard prices, labor at your current crew rates. Equipment and delivery are calculated separately.</span></div></div>
    ${full ? `<div class="notice notice-warning">${icon('alert')}<div><strong>Project limit reached</strong><span>Finish the current project or get the right to run parallel projects.</span></div></div>` : ''}
    <section class="jobs-grid">${state.jobs.map((job) => {
      const def = buildingById(job.building)
      const estimate = estimateJob(state, job)
      const daysLeft = job.deadline - state.day
      const boardDays = job.expiresDay - state.day
      const tone = estimate.margin >= 0.25 ? 'success' : estimate.margin >= 0.12 ? 'warning' : 'danger'
      const locked = job.special && state.reputation < def.minReputation
      const licenseLocked = Boolean(def.requiredLicense) && !isLicenseUnlocked(state, def.requiredLicense!)
      const licenseName = def.requiredLicense === 'city' ? 'City license' : def.requiredLicense === 'region' ? 'Regional license' : ''
      return `<article class="card job-card ${job.special ? 'special-job' : ''}">
        <div class="job-card-top"><span class="building-mark">${def.short}</span><div class="job-badges">${job.special ? badge('Special', 'warning') : badge(daysLeft <= 7 ? 'Urgent' : 'Contract', daysLeft <= 7 ? 'warning' : 'neutral')}${job.special ? badge(`Until day ${job.expiresDay}`, 'info') : ''}${badge(percent(estimate.margin), tone)}</div></div>
        <div class="job-title"><h2>${def.name}</h2><p>${job.client}</p></div>
        ${job.special ? (locked
          ? `<div class="notice notice-warning">${icon('lock')}<div><strong>Requires ${def.minReputation} reputation</strong><span>You currently have ${state.reputation}. Complete progress steps and deliver projects.</span></div></div>`
          : `<div class="notice notice-neutral">${icon('star')}<div><strong>+${def.reputationReward ?? 2} reputation</strong><span>Crews required: ${def.requiredCrews ?? 1}. Stages will need special equipment.</span></div></div>`) : ''}
        ${licenseLocked ? `<div class="notice notice-warning">${icon('lock')}<div><strong>Need ${licenseName}</strong><span>Research the license in the Technologies section to take such contracts.</span></div></div>` : ''}
        <div class="job-budget"><span>Contract budget</span><strong>${money(job.budget)}</strong></div>
        <div class="job-stats"><div><span>Materials ≈</span><strong>${money(estimate.materials)}</strong></div><div><span>Labor ≈</span><strong>${money(estimate.labor)}</strong></div><div><span>Profit ≈</span><strong class="${estimate.profit >= 0 ? 'positive' : 'negative'}">${money(estimate.profit)}</strong></div><div><span>Startup ≈</span><strong>${money(estimate.startup)}</strong></div></div>
        <div class="job-deadline">${icon('clock')}<div><strong>${daysLeft} days to delivery</strong><span>≈ ${estimate.days} work days · ${estimate.manHours} man-hours${job.special ? ` · up to ${boardDays} more days on board` : ''}</span></div></div>
        <button class="btn ${estimate.margin >= 0.12 ? 'btn-primary' : 'btn-secondary'} btn-block" data-action="take-job" data-id="${job.id}" ${full || locked || licenseLocked ? 'disabled' : ''}>${locked ? `${icon('lock')} Requires ${def.minReputation} reputation` : licenseLocked ? `${icon('lock')} Need ${licenseName}` : `Take the contract ${icon('arrow')}`}</button>
      </article>`
    }).join('')}</section>
    <div class="footnote">New contracts appear daily. Special projects appear every ${BALANCE.restockDays} days with a ${Math.round(BALANCE.specialJobChance * 100)}% chance, require 75+ reputation and disappear quickly.</div>`
}