import { buildingById } from '../../game/catalog'
import { badge, esc, money, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

function objectsText(count: number): string {
  return `${count} projects`
}

export function renderCompetitors(ctx: ViewContext): string {
  const { state } = ctx
  const sorted = [...state.bots].sort((a, b) => b.totalProfit - a.totalProfit)
  return `${pageHeading('Business climate', 'Competitors', 'Shared jobs, workers and materials: rivals shape your market.', badge(`${state.bots.length} companies`, 'info'))}
    <div class="notice notice-info">${icon('competitors')}<div><strong>One market for everyone</strong><span>Every day rivals pick jobs by strategy, hire candidates and buy up real lots.</span></div></div>
    <section class="competitor-list">${sorted.map((bot, index) => {
      const level = bot.totalProfit >= 3_000_000 ? 'Pro' : bot.totalProfit >= 1_000_000 ? 'Experienced' : 'Novice'
      const stateText = bot.state === 'cooldown' ? `Paused · ${bot.cooldown} d.` : bot.projects.length > 0 ? 'Projects in work' : 'Choosing a contract'
      const strategy = bot.corporation ? 'Market pressure' : bot.strategy === 'aggressive' ? 'Aggressive' : bot.strategy === 'moderate' ? 'Moderate' : 'Conservative'
      const jobNames = bot.projects.map((project) => buildingById(project.job.building).name).join(bot.projects.length > 1 ? ' · ' : '') || 'No active contract'
      const progressValue = bot.projects.length > 0 ? Math.max(...bot.projects.map((project) => project.progress)) : 0
      return `<article class="card competitor-card"><div class="rank">${index + 1}</div><div class="competitor-identity"><div class="company-logo">${esc(bot.name.slice(0, 1))}</div><div><h2>${esc(bot.name)}</h2><div class="skill-list">${badge(level, level === 'Pro' ? 'success' : 'neutral')}${badge(strategy, 'info')}${bot.corporation ? badge('Corporation', 'danger') : ''}${!bot.corporation && bot.projects.length > 1 ? badge(objectsText(bot.projects.length), 'warning') : ''}</div></div></div><div class="competitor-job"><span>Current contracts</span><strong>${jobNames}</strong><small>${stateText} · crew ${bot.crew.length} people</small></div><div class="competitor-progress">${progress(progressValue, 'Progress')}</div><div class="competitor-capital"><span>Capital</span><strong>${money(bot.money)}</strong><small>Season profit: ${money(bot.totalProfit)}</small></div></article>`
    }).join('')}</section>
    <div class="footnote">Ranking is based on accumulated profit. Capital includes the company available cash.</div>`
}
