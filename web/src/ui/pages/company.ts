import { BALANCE } from '../../game/balance'
import { netWorth } from '../../game/engine'
import { capitalProgress, companyStatus, seasonGoalMet } from '../../game/selectors'
import { currentSeason, seasonEffectText } from '../../game/seasons'
import { badge, companyAvatar, compactMoney, esc, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

const AVATAR_NAMES = ['Дом', 'Кран', 'Каска', 'Квартал', 'Чертёж', 'Знак']

export function renderCompany(ctx: ViewContext): string {
  const { state } = ctx
  const season = currentSeason(state)
  const status = companyStatus(state)
  return `${pageHeading('Профиль компании', state.companyName, 'Управляйте именем, внешним видом и следите за деловым статусом компании.', badge(status.name, status.index >= 3 ? 'success' : 'info'))}
    <div class="company-layout">
      <section class="card company-profile-card">
        <div class="company-profile-main">${companyAvatar(state.companyAvatar, 'company-avatar-large')}<div><div class="eyebrow">Текущий статус</div><h2>${status.name}</h2><p>${season.name} · день ${state.day} из ${BALANCE.seasonDays}</p>${progress(status.progress, status.index >= 5 ? 'Максимальный статус' : 'Прогресс до следующего статуса')}</div></div>
        <label class="field"><span>Название компании</span><input id="company-name" type="text" minlength="2" maxlength="30" value="${esc(state.companyName)}" autocomplete="off" /></label>
        <div class="button-row"><button class="btn btn-primary" data-action="save-company">${icon('check')} Сохранить название</button><span class="field-hint">От 2 до 30 символов. Название видно в боковой панели.</span></div>
      </section>
      <aside class="card"><div class="section-title compact"><div><div class="eyebrow">Сводка</div><h2>Показатели</h2></div>${badge(seasonGoalMet(state) ? 'цель сезона выполнена' : 'сезон идёт', seasonGoalMet(state) ? 'success' : 'warning')}</div><dl class="cost-list"><div><dt>Капитал</dt><dd>${compactMoney(netWorth(state))}</dd></div><div><dt>Репутация</dt><dd>${state.reputation} / 100</dd></div><div><dt>Объектов за сезон</dt><dd>${state.seasonCompleted}</dd></div><div><dt>Выручка за сезон</dt><dd>${compactMoney(state.seasonRevenue)}</dd></div></dl><div class="notice notice-neutral">${icon('hardhat')}<div><strong>Сезонные условия</strong><span>${seasonEffectText(state) || 'Особых условий нет'}</span></div></div>${progress(capitalProgress(state), 'Цель сезона по капиталу')}</aside>
    </div>
    <section class="card"><div class="section-title"><div><h2>Аватар компании</h2><p>Выберите один из шести фирменных знаков.</p></div></div><div class="avatar-grid">${AVATAR_NAMES.map((name, index) => `<button class="avatar-option ${state.companyAvatar === index ? 'active' : ''}" data-action="select-avatar" data-id="${index}" aria-label="Аватар: ${name}">${companyAvatar(index)}</button>`).join('')}</div></section>
    <section class="card"><div class="section-title"><div><h2>Как растёт статус</h2><p>Статус зависит от текущего капитала и обновляется автоматически.</p></div></div><div class="status-list"><div><strong>ИЖС · Частный подряд</strong><span>до 3 млн ₽</span></div><div><strong>Местный застройщик</strong><span>3–6 млн ₽</span></div><div><strong>Региональный подрядчик</strong><span>6–12 млн ₽</span></div><div><strong>Городской девелопер</strong><span>12–21,6 млн ₽</span></div><div><strong>Федеральный застройщик</strong><span>21,6–36 млн ₽</span></div><div><strong>Корпорация недвижимости</strong><span>от 36 млн ₽</span></div></div></section>`
}
