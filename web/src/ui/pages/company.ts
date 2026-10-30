import { BALANCE } from '../../game/balance'
import { netWorth } from '../../game/engine'
import { capitalProgress, companyStatus, seasonGoalMet } from '../../game/selectors'
import { currentSeason, seasonEffectText } from '../../game/seasons'
import { badge, companyAvatar, compactMoney, esc, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

const AVATAR_NAMES = ['House', 'Crane', 'Helmet', 'Quarters', 'Blueprint', 'Mark']

export function renderCompany(ctx: ViewContext): string {
  const { state } = ctx
  const season = currentSeason(state)
  const status = companyStatus(state)
  return `${pageHeading('Company profile', state.companyName, 'Manage the name and branding and track the company business status.', badge(status.name, status.index >= 3 ? 'success' : 'info'))}
    <div class="company-layout">
      <section class="card company-profile-card">
        <div class="company-profile-main">${companyAvatar(state.companyAvatar, 'company-avatar-large')}<div><div class="eyebrow">Current status</div><h2>${status.name}</h2><p>${season.name} · day ${state.day} of ${BALANCE.seasonDays}</p>${progress(status.progress, status.index >= 5 ? 'Maximum status' : 'Progress to next status')}</div></div>
        <label class="field"><span>Company name</span><input id="company-name" type="text" minlength="2" maxlength="30" value="${esc(state.companyName)}" autocomplete="off" /></label>
        <div class="button-row"><button class="btn btn-primary" data-action="save-company">${icon('check')} Save name</button><span class="field-hint">2 to 30 characters. The name is shown in the sidebar.</span></div>
      </section>
      <aside class="card"><div class="section-title compact"><div><div class="eyebrow">Summary</div><h2>Metrics</h2></div>${badge(seasonGoalMet(state) ? 'season goal met' : 'season in progress', seasonGoalMet(state) ? 'success' : 'warning')}</div><dl class="cost-list"><div><dt>Capital</dt><dd>${compactMoney(netWorth(state))}</dd></div><div><dt>Reputation</dt><dd>${state.reputation} / 100</dd></div><div><dt>Projects this season</dt><dd>${state.seasonCompleted}</dd></div><div><dt>Revenue this season</dt><dd>${compactMoney(state.seasonRevenue)}</dd></div></dl><div class="notice notice-neutral">${icon('hardhat')}<div><strong>Season conditions</strong><span>${seasonEffectText(state) || 'No special conditions'}</span></div></div>${progress(capitalProgress(state), 'Season capital goal')}</aside>
    </div>
    <section class="card"><div class="section-title"><div><h2>Company avatar</h2><p>Choose one of six brand marks.</p></div></div><div class="avatar-grid">${AVATAR_NAMES.map((name, index) => `<button class="avatar-option ${state.companyAvatar === index ? 'active' : ''}" data-action="select-avatar" data-id="${index}" aria-label="Avatar: ${name}">${companyAvatar(index)}</button>`).join('')}</div></section>
    <section class="card"><div class="section-title"><div><h2>How status grows</h2><p>Status depends on current capital and updates automatically.</p></div></div><div class="status-list"><div><strong>Private contractor</strong><span>up to $3M</span></div><div><strong>Local developer</strong><span>$3–6M</span></div><div><strong>Regional contractor</strong><span>$6–12M</span></div><div><strong>City developer</strong><span>$12–21.6M</span></div><div><strong>Federal developer</strong><span>$21.6–36M</span></div><div><strong>Real estate corporation</strong><span>from $36M</span></div></div></section>`
}
