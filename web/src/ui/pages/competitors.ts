import { buildingById } from '../../game/catalog'
import { badge, esc, money, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

function objectsText(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} объекта`
  return `${count} объектов`
}

export function renderCompetitors(ctx: ViewContext): string {
  const { state } = ctx
  const sorted = [...state.bots].sort((a, b) => b.totalProfit - a.totalProfit)
  return `${pageHeading('Деловой климат', 'Конкуренты', 'Общие заказы, рабочие и материалы: соперники влияют на ваш рынок.', badge(`${state.bots.length} компании`, 'info'))}
    <div class="notice notice-info">${icon('competitors')}<div><strong>Один рынок на всех</strong><span>Каждый день боты выбирают заказы по своей стратегии, нанимают кандидатов и выкупают реальные лоты.</span></div></div>
    <section class="competitor-list">${sorted.map((bot, index) => {
      const level = bot.totalProfit >= 3_000_000 ? 'Профи' : bot.totalProfit >= 1_000_000 ? 'Опытный' : 'Новичок'
      const stateText = bot.state === 'cooldown' ? `Пауза · ${bot.cooldown} дн.` : bot.projects.length > 0 ? 'Объекты в работе' : 'Выбирает заказ'
      const strategy = bot.corporation ? 'Давление рынком' : bot.strategy === 'aggressive' ? 'Агрессивная' : bot.strategy === 'moderate' ? 'Умеренная' : 'Консервативная'
      const jobNames = bot.projects.map((project) => buildingById(project.job.building).name).join(bot.projects.length > 1 ? ' · ' : '') || 'Нет активного заказа'
      const progressValue = bot.projects.length > 0 ? Math.max(...bot.projects.map((project) => project.progress)) : 0
      return `<article class="card competitor-card"><div class="rank">${index + 1}</div><div class="competitor-identity"><div class="company-logo">${esc(bot.name.slice(0, 1))}</div><div><h2>${esc(bot.name)}</h2><div class="skill-list">${badge(level, level === 'Профи' ? 'success' : 'neutral')}${badge(strategy, 'info')}${bot.corporation ? badge('Корпорация', 'danger') : ''}${!bot.corporation && bot.projects.length > 1 ? badge(objectsText(bot.projects.length), 'warning') : ''}</div></div></div><div class="competitor-job"><span>Текущие заказы</span><strong>${jobNames}</strong><small>${stateText} · бригада ${bot.crew.length} чел.</small></div><div class="competitor-progress">${progress(progressValue, 'Прогресс')}</div><div class="competitor-capital"><span>Капитал</span><strong>${money(bot.money)}</strong><small>Прибыль за сезон: ${money(bot.totalProfit)}</small></div></article>`
    }).join('')}</section>
    <div class="footnote">Рейтинг строится по накопленной прибыли. Капитал включает доступные деньги компании.</div>`
}
