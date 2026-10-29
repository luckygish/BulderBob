import { BALANCE } from '../../game/balance'
import { buildingById } from '../../game/catalog'
import { isResearched, netWorth, warehouseStorageFee } from '../../game/engine'
import { capitalProgress, companyStatus, equipmentMaintenance, projectCosts, seasonGoalMet } from '../../game/selectors'
import { currentSeason, seasonEffectText } from '../../game/seasons'
import type { FinanceSnapshot, GameState, Project } from '../../game/types'
import { badge, compactMoney, money, pageHeading, percent, progress } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

function niceStep(raw: number): number {
  if (raw <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const factor = raw / power
  const nice = factor <= 1 ? 1 : factor <= 2 ? 2 : factor <= 5 ? 5 : 10
  return nice * power
}

function dayTickIndexes(count: number): number[] {
  const total = 5
  const indexes = new Set<number>()
  for (let index = 0; index < total; index += 1) {
    indexes.add(Math.round(((count - 1) * index) / (total - 1)))
  }
  return [...indexes]
}

function lineChart(history: FinanceSnapshot[], keys: { key: 'capital' | 'cash' | 'reputation'; label: string; className: string }[]): string {
  if (history.length < 2) return `<div class="chart-empty">${icon('trend')}<strong>Недостаточно данных</strong><span>График появится после нескольких игровых дней.</span></div>`
  const width = 660
  const height = 250
  const padTop = 18
  const padLeft = 66
  const padRight = 18
  const padBottom = 48
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const values = history.flatMap((item) => keys.map(({ key }) => item[key]))
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const range = Math.max(1, rawMax - rawMin)
  let step = niceStep(range / 4)
  let min = Math.floor(rawMin / step) * step
  let top = Math.ceil(rawMax / step) * step
  if (Math.round((top - min) / step) > 4) {
    step = niceStep(range / 2)
    min = Math.floor(rawMin / step) * step
    top = Math.ceil(rawMax / step) * step
  }
  if (top <= min) top = min + step
  const format = (value: number) => keys[0].key === 'reputation' ? String(Math.round(value)) : compactMoney(value)
  const yTicks: number[] = []
  for (let value = min; value <= top + step / 2; value += step) yTicks.push(Math.round(value * 100) / 100)
  const yGrid = yTicks.map((value) => {
    const y = padTop + (1 - (value - min) / (top - min)) * plotH
    return `<line class="chart-grid" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}"/><text class="chart-label" x="${padLeft - 7}" y="${y + 3}" text-anchor="end">${format(value)}</text>`
  }).join('')
  const xStep = plotW / Math.max(1, history.length - 1)
  const xGrid = dayTickIndexes(history.length).map((index) => {
    const x = padLeft + index * xStep
    return `<line class="chart-grid" x1="${x}" y1="${height - padBottom}" x2="${x}" y2="${height - padBottom + 4}"/><text class="chart-label" x="${x}" y="${height - padBottom + 18}" text-anchor="middle">День ${history[index].day}</text>`
  }).join('')
  const lines = keys.map(({ key, className }) => {
    const points = history.map((item, index) => `${padLeft + index * xStep},${padTop + (1 - (item[key] - min) / (top - min)) * plotH}`).join(' ')
    return `<polyline class="chart-line ${className}" points="${points}"/>`
  }).join('')
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}"/><line class="chart-grid" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}"/>${yGrid}${xGrid}${lines}</svg>`
}

function projectBars(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('construction')}<strong>Объектов пока нет</strong><span>После первой сдачи здесь появится диаграмма.</span></div>`
  const items = projects.slice(0, 10).reverse()
  const values = items.map((project) => Math.max(0, project.job.budget - project.penalty))
  const max = Math.max(...values, 1)
  const guides = [0, 25, 50, 75, 100].map((position) => `<i style="top:${position}%"></i>`).join('')
  return `<div class="bar-scale-label"><span>100% = ${compactMoney(max)}</span></div><div class="bar-chart"><div class="bar-guides" aria-hidden="true">${guides}</div>${items.map((project, index) => {
    const revenue = values[index]
    const profit = project.profit
    return `<div class="bar-item" title="${buildingById(project.job.building).name}: выручка ${money(revenue)}, прибыль ${money(profit)}"><span class="bar-value">${compactMoney(revenue)}</span><div class="bar-columns"><span class="bar revenue" style="height:${Math.max(4, revenue / max * 130)}px"></span><span class="bar profit ${profit >= 0 ? 'positive' : 'negative'}" style="height:${Math.max(4, Math.abs(profit) / max * 130)}px"></span></div><small>${buildingById(project.job.building).short}</small></div>`
  }).join('')}</div>`
}

function costStructure(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('document')}<strong>Нет завершённых проектов</strong><span>Структура затрат появится после сдачи.</span></div>`
  const totals = projects.reduce((sum, project) => ({
    material: sum.material + project.materialCost,
    labor: sum.labor + project.laborCost,
    logistics: sum.logistics + project.logisticsCost,
    equipment: sum.equipment + project.equipmentCost,
    factoring: sum.factoring + project.factoringFee,
  }), { material: 0, labor: 0, logistics: 0, equipment: 0, factoring: 0 })
  const total = Math.max(1, Object.values(totals).reduce((sum, value) => sum + value, 0))
  const parts = [
    ['Материалы', totals.material, 'material'],
    ['Труд', totals.labor, 'labor'],
    ['Доставка', totals.logistics, 'logistics'],
    ['Техника', totals.equipment, 'equipment'],
    ['Факторинг', totals.factoring, 'factoring'],
  ] as const
  return `<div class="cost-donut">${parts.map(([label, value, className]) => `<div class="cost-part ${className}"><span>${label}</span><strong>${percent(value / total)}</strong><div class="stock-bar"><span style="width:${value / total * 100}%"></span></div></div>`).join('')}</div>`
}

function buildingStats(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('jobs')}<strong>Нет сданных объектов</strong><span>Статистика появится после первой сдачи.</span></div>`
  const counts = new Map<string, number>()
  for (const project of projects) counts.set(project.job.building, (counts.get(project.job.building) ?? 0) + 1)
  return `<div class="type-stats">${[...counts.entries()].map(([building, count]) => `<div><span class="building-mark">${buildingById(building).short}</span><div><strong>${buildingById(building).name}</strong><small>${count} шт.</small></div></div>`).join('')}</div>`
}

function financeStats(state: GameState) {
  const completed = state.completed
  const revenue = completed.reduce((sum, project) => sum + project.job.budget - project.penalty, 0)
  const profit = completed.reduce((sum, project) => sum + project.profit, 0)
  const late = completed.filter((project) => project.penalty > 0).length
  const best = completed.reduce<Project | null>((bestProject, project) => !bestProject || project.profit > bestProject.profit ? project : bestProject, null)
  return { revenue, profit, margin: revenue ? profit / revenue : 0, late, best }
}

export function renderReport(ctx: ViewContext): string {
  const { state } = ctx
  if (!isResearched(state, 'bank_account')) return `${pageHeading('Аналитика', 'Финансовый отчёт', 'История капитала, прибыли и структуры затрат компании.', badge('Закрыто', 'neutral'))}<section class="card bank-locked"><div class="empty-icon">${icon('report')}</div><div><div class="eyebrow">Финансовая аналитика</div><h2>Откройте расчётный счёт</h2><p>После исследования «Банковский счёт» здесь будут графики капитала, денег, репутации, прибыли и структуры затрат.</p><button class="btn btn-primary" data-route="technology">Перейти к технологиям ${icon('arrow')}</button></div></section>`
  const season = currentSeason(state)
  const status = companyStatus(state)
  const stats = financeStats(state)
  const direct = state.completed.reduce((sum, project) => sum + projectCosts(project).direct, 0)
  return `${pageHeading('Аналитика компании', 'Финансовый отчёт', 'История капитала, денег, репутации и результатов сданных объектов.', badge(`${state.financeHistory.length} дн. истории`, 'info'))}
    <section class="kpi-grid report-kpis">
      <article class="kpi-card"><div class="kpi-icon orange">${icon('wallet')}</div><div><span>Капитал</span><strong>${compactMoney(netWorth(state))}</strong><small>Деньги и техника минус обязательства</small></div></article>
      <article class="kpi-card"><div class="kpi-icon teal">${icon('trend')}</div><div><span>Выручка за сезон</span><strong>${compactMoney(state.seasonRevenue)}</strong><small>За всю игру: ${compactMoney(stats.revenue)}</small></div></article>
      <article class="kpi-card"><div class="kpi-icon blue">${icon('document')}</div><div><span>Средняя маржа</span><strong>${percent(stats.margin)}</strong><small>Прибыль / выручка сданных объектов</small></div></article>
      <article class="kpi-card"><div class="kpi-icon sand">${icon('star')}</div><div><span>Текущий долг</span><strong>${money(Math.max(0, state.debt))}</strong><small>${state.debt > 0 ? 'Требует контроля' : 'Обязательств нет'}</small></div></article>
    </section>
    <div class="report-grid">
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Динамика</div><h2>Капитал и денежные средства</h2></div></div>${lineChart(state.financeHistory, [{ key: 'capital', label: 'Капитал', className: 'capital' }, { key: 'cash', label: 'Деньги', className: 'cash' }])}<div class="chart-legend"><span><i class="legend-dot capital"></i>Капитал</span><span><i class="legend-dot cash"></i>Деньги</span></div></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Репутация</div><h2>Динамика доверия</h2></div></div>${lineChart(state.financeHistory, [{ key: 'reputation', label: 'Репутация', className: 'reputation' }])}</section>
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Сданные объекты</div><h2>Выручка и прибыль</h2></div>${badge('последние 10', 'info')}</div>${projectBars(state.completed)}<div class="chart-legend"><span><i class="legend-dot revenue"></i>Выручка</span><span><i class="legend-dot profit"></i>Прибыль</span></div></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Затраты</div><h2>Структура расходов</h2></div></div>${costStructure(state.completed)}<p class="field-hint">Всего прямых затрат: ${money(direct)}</p></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Портфель</div><h2>Типы объектов</h2></div></div>${buildingStats(state.completed)}</section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Сезон</div><h2>${season.name}</h2></div>${badge(seasonGoalMet(state) ? 'цель выполнена' : `день ${state.day}/${BALANCE.seasonDays}`, seasonGoalMet(state) ? 'success' : 'info')}</div><p>${seasonEffectText(state) || 'Особых условий нет'}</p>${progress(capitalProgress(state), 'Капитал')}${progress(state.reputation / season.goal.reputation, 'Репутация')}${progress(state.seasonCompleted / season.goal.completed, 'Объекты')}</section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Компания</div><h2>${status.name}</h2></div></div>${progress(status.progress, 'До следующего статуса')}<dl class="cost-list"><div><dt>Лучший объект</dt><dd>${stats.best ? `${buildingById(stats.best.job.building).name} · ${money(stats.best.profit)}` : '—'}</dd></div><div><dt>Просроченных сдач</dt><dd>${stats.late}</dd></div><div><dt>Техника</dt><dd>${state.equipment.length} ед.</dd></div><div><dt>Обслуживание</dt><dd>${money(equipmentMaintenance(state) + warehouseStorageFee(state))} / день</dd></div><div><dt>Сумма продаж техники</dt><dd>${state.equipmentSold} ед.</dd></div></dl></section>
    </div>`
}
