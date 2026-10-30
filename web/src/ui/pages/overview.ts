import { BALANCE } from '../../game/balance'
import { buildingById } from '../../game/catalog'
import { netWorth } from '../../game/engine'
import { TUTORIAL_STEPS, nextTutorialStep } from '../../game/progression'
import { capitalProgress, projectProgress, seasonGoalMet } from '../../game/selectors'
import { currentSeason, seasonEffectText } from '../../game/seasons'
import { badge, compactMoney, journalItem, money, pageHeading, percent, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderOverview(ctx: ViewContext): string {
  const { state } = ctx
  const worth = netWorth(state)
  const active = state.projects
  const season = currentSeason(state)
  const goal = season.goal
  const step = nextTutorialStep(state)
  const completedSteps = state.completedTutorial.length
  const leaseDaily = state.equipment.reduce((sum, asset) => sum + (asset.status === 'leased' ? asset.leaseDaily : 0), 0)
  const recent = state.journal.slice(-4).reverse()
  const completedProgress = Math.min(1, state.seasonCompleted / goal.completed)
  return `${pageHeading('Command center', `Good day, director`, 'Key metrics, season goals and your company development program.', `<button class="btn btn-primary" data-route="jobs">${icon('plus')} Find a contract</button>`)}
    <section class="season-card">
      <div class="season-icon">${icon('hardhat')}</div>
      <div class="season-copy"><div class="eyebrow">Season ${Math.min(state.seasonIndex + 1, 10)} / 10 · ${season.name} · day ${state.day} of ${BALANCE.seasonDays}</div><h2>${season.title}${seasonGoalMet(state) ? badge('Goal met', 'success') : ''}</h2><p>${seasonEffectText(state) || 'No special season conditions'}</p></div>
      <div class="season-progress"><div><span>Capital</span><strong>${compactMoney(worth)} / ${compactMoney(goal.capital)}</strong></div>${progress(capitalProgress(state))}<div class="season-rep">${icon('star')} Reputation <strong>${state.reputation} / ${goal.reputation}</strong></div><div class="season-rep">${icon('check')} Projects <strong>${state.seasonCompleted} / ${goal.completed}</strong></div>${progress(completedProgress)}</div>
    </section>
    <section class="kpi-grid">
      <article class="kpi-card"><div class="kpi-icon orange">${icon('wallet')}</div><div><span>Free cash</span><strong>${compactMoney(state.money)}</strong><small>${state.debt ? `Debt ${money(state.debt)}` : 'No obligations'}</small></div></article>
      <article class="kpi-card"><div class="kpi-icon teal">${icon('construction')}</div><div><span>Active projects</span><strong>${active.length}</strong><small>${state.seasonCompleted} delivered this season</small></div></article>
      <article class="kpi-card"><div class="kpi-icon blue">${icon('star')}</div><div><span>Reputation</span><strong>${state.reputation}<em>/100</em></strong><small>${completedSteps} development steps done</small></div></article>
      <article class="kpi-card"><div class="kpi-icon sand">${icon('bank')}</div><div><span>Payments tomorrow</span><strong>${compactMoney((state.loan?.daily ?? 0) + leaseDaily)}</strong><small>Loan and lease</small></div></article>
    </section>
    <div class="dashboard-grid">
      ${step ? `<section class="card next-step-card"><div class="card-header"><div><div class="eyebrow">Next step · ${completedSteps + 1} of ${TUTORIAL_STEPS.length}</div><h2>${step.title}</h2></div><span class="step-number">${String(completedSteps + 1).padStart(2, '0')}</span></div><p>${step.description}</p><div class="next-step-route"><span>${step.reward > 0 ? `${icon('star')} Reward: +${step.reward} reputation` : ''}</span><button class="text-btn" data-route="${step.route}">Go to ${icon('arrow')}</button></div></section>` : `<section class="card next-step-card"><div class="card-header"><div><div class="eyebrow">Development program</div><h2>All steps completed</h2></div><span class="step-number">${TUTORIAL_STEPS.length}</span></div><p>Your company has mastered the core features. Keep an eye on season goals and special projects.</p><div class="next-step-route"><span>${icon('check')} +${TUTORIAL_STEPS.reduce((sum, item) => sum + item.reward, 0)} reputation earned</span><button class="text-btn" data-route="jobs">To jobs ${icon('arrow')}</button></div></section>`}
      <section class="card"><div class="card-header"><div><div class="eyebrow">Company feed</div><h2>Latest events</h2></div><button class="icon-btn" data-action="journal" aria-label="Open journal">${icon('journal')}</button></div><div class="mini-journal">${recent.map(journalItem).join('')}</div></section>
    </div>
    <section class="section-block"><div class="section-title"><div><h2>Projects in progress</h2><p>Deadlines and build progress</p></div><button class="text-btn" data-route="construction">All projects ${icon('arrow')}</button></div>
      ${active.length ? `<div class="project-mini-grid">${active.map((project) => `<article class="card project-mini"><div class="project-mini-top"><span class="building-mark">${buildingById(project.job.building).short}</span>${badge(project.started ? 'Under construction' : 'Preparation', project.started ? 'success' : 'warning')}</div><h3>${buildingById(project.job.building).name}</h3><p>${project.job.client}</p>${progress(projectProgress(project), 'Overall progress')}<div class="project-mini-footer"><span>${icon('clock')} Deadline: day ${project.job.deadline}</span><button class="text-btn" data-action="open-project" data-id="${project.id}">Open ${icon('chevron')}</button></div></article>`).join('')}</div>` : `<div class="card inline-empty">${icon('construction')}<div><strong>Sites are free</strong><p>Take a contract to start your first project.</p></div><button class="btn btn-secondary" data-route="jobs">To jobs</button></div>`}
    </section>
    ${state.completed.length ? `<section class="card completed-banner"><div class="kpi-icon teal">${icon('check')}</div><div><span>Latest result</span><strong>${buildingById(state.completed[0].job.building).name} · ${money(state.completed[0].profit)}</strong></div><span class="muted">Net profit</span></section>` : ''}
    <footer class="dashboard-footer"><span>Season revenue: <strong>${money(state.seasonRevenue)}</strong></span><span>Days completed: <strong>${percent(Math.min(1, state.day / BALANCE.seasonDays))}</strong></span></footer>`
}