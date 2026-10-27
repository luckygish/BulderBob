import { buildingById } from '../../game/catalog'
import { badge, money, pageHeading, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderCompetitors(ctx: ViewContext): string {
  const { state } = ctx
  const sorted = [...state.bots].sort((a, b) => b.totalProfit - a.totalProfit)
  return `${pageHeading('Деловой климат', 'Конкуренты', 'Общие заказы, рабочие и материалы: соперники влияют на ваш рынок.', badge(`${state.bots.length} компании`, 'info'))}
    <div class="notice notice-info">${icon('competitors')}<div><strong>Один рынок на всех</strong><span>Каждый день боты выбирают заказы по своей стратегии, нанимают кандидатов и выкупают реальные лоты.</span></div></div>
    <section class="competitor-list">${sorted.map((bot, index) => {
      const level = bot.totalProfit >= 3_000_000 ? 'Профи' : bot.totalProfit >= 1_000_000 ? 'Опытный' : 'Новичок'
      const stateText = bot.state === 'cooldown' ? `Пауза · ${bot.cooldown} дн.` : bot.project ? 'Объект в работе' : 'Выбирает заказ'
      const strategy = bot.strategy === 'aggressive' ? 'Агрессивная' : bot.strategy === 'moderate' ? 'Умеренная' : 'Консервативная'
      return `<article class="card competitor-card"><div class="rank">${index + 1}</div><div class="competitor-identity"><div class="company-logo">${bot.name.slice(0, 1)}</div><div><h2>${bot.name}</h2><div class="skill-list">${badge(level, level === 'Профи' ? 'success' : 'neutral')}${badge(strategy, 'info')}</div></div></div><div class="competitor-job"><span>Текущий заказ</span><strong>${bot.project ? buildingById(bot.project.job.building).name : 'Нет активного заказа'}</strong><small>${stateText} · бригада ${bot.crew.length} чел.</small></div><div class="competitor-progress">${progress(bot.project?.progress ?? 0, 'Прогресс')}</div><div class="competitor-capital"><span>Капитал</span><strong>${money(bot.money)}</strong><small>Прибыль за сезон: ${money(bot.totalProfit)}</small></div></article>`
    }).join('')}</section>
    <div class="exit-save-row"><button class="btn btn-danger btn-small" data-action="save-exit">${icon('close')} Выйти и сохранить</button></div>
    <div class="footnote">Рейтинг строится по накопленной прибыли. Капитал включает доступные деньги компании.</div>`
}
