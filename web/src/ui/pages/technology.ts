import { TECHNOLOGIES, techById } from '../../game/catalog'
import { isResearched, netWorth } from '../../game/engine'
import { badge, money, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderTechnology(ctx: ViewContext): string {
  const { state } = ctx
  const current = Object.entries(state.research).find(([, research]) => research.status === 'researching')
  const branches = ['Management', 'Personnel', 'Finance']
  return `${pageHeading('Company development', 'Technologies', 'Invest profits into scaling, people and financial instruments.', badge(`${Object.values(state.research).filter((item) => item.status === 'done').length} / ${TECHNOLOGIES.length} researched`, 'info'))}
    ${current ? `<section class="card research-active"><div class="kpi-icon blue">${icon('tech')}</div><div><div class="eyebrow">Active research</div><h2>${techById(current[0]).name}</h2><p>${current[1].progress} of ${techById(current[0]).days} days done</p></div><div>${progress(current[1].progress / techById(current[0]).days)}</div></section>` : `<div class="notice notice-info">${icon('tech')}<div><strong>Lab is free</strong><span>Only one technology can be researched at a time. Payment is taken when you start.</span></div></div>`}
    <section class="tech-branches">${branches.map((branch) => `<div class="tech-branch"><div class="branch-title"><span>${icon(branch === 'Management' ? 'construction' : branch === 'Personnel' ? 'hr' : 'bank')}</span><div><h2>${branch}</h2><p>${branch === 'Management' ? 'More projects' : branch === 'Personnel' ? 'Faster and more flexible' : 'Capital for growth'}</p></div></div><div class="tech-path">${TECHNOLOGIES.filter((tech) => tech.branch === branch).map((tech) => {
      const research = state.research[tech.id]
      const done = isResearched(state, tech.id)
      const researching = research?.status === 'researching'
      const locked = (tech.requires && !isResearched(state, tech.requires)) || (tech.requiresReputation !== undefined && state.reputation < tech.requiresReputation) || (tech.requiresCapital !== undefined && netWorth(state) < tech.requiresCapital)
      const capitalText = tech.requiresCapital ? `${(tech.requiresCapital / 1_000_000).toLocaleString('en-US')}M` : ''
      return `<article class="card tech-card ${done ? 'done' : researching ? 'researching' : locked ? 'locked' : ''}"><div class="tech-status-line"><span class="tech-node">${done ? icon('check') : researching ? icon('clock') : locked ? icon('close') : icon('tech')}</span>${badge(done ? 'Researched' : researching ? 'In progress' : locked ? 'Locked' : 'Available', done ? 'success' : researching ? 'info' : locked ? 'neutral' : 'warning')}</div><h3>${tech.name}</h3><p>${tech.description}</p>${tech.requires ? `<span class="tech-requirement">Requires: ${techById(tech.requires).name}</span>` : ''}${tech.requiresReputation ? `<span class="tech-requirement">Requires reputation ${tech.requiresReputation}</span>` : ''}${capitalText ? `<span class="tech-requirement">Requires capital ${capitalText}</span>` : ''}<div class="tech-footer"><div><strong>${money(tech.cost)}</strong><span>${tech.days} days</span></div><button class="btn btn-small ${done || researching || locked ? 'btn-ghost' : 'btn-secondary'}" data-action="research" data-id="${tech.id}" ${done || researching || locked ? 'disabled' : ''}>${done ? 'Applied' : researching ? 'Researching' : 'Research'}</button></div></article>`
    }).join('')}</div></div>`).join('')}</section>`
}
