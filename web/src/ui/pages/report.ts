import { BALANCE } from '../../game/balance'
import { MATERIALS } from '../../game/catalog'
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
  if (history.length < 2) return `<div class="chart-empty">${icon('trend')}<strong>Not enough data</strong><span>The chart appears after a few in-game days.</span></div>`
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
    return `<line class="chart-grid" x1="${x}" y1="${height - padBottom}" x2="${x}" y2="${height - padBottom + 4}"/><text class="chart-label" x="${x}" y="${height - padBottom + 18}" text-anchor="middle">Day ${history[index].day}</text>`
  }).join('')
  const lines = keys.map(({ key, className }) => {
    const points = history.map((item, index) => `${padLeft + index * xStep},${padTop + (1 - (item[key] - min) / (top - min)) * plotH}`).join(' ')
    return `<polyline class="chart-line ${className}" points="${points}"/>`
  }).join('')
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}"/><line class="chart-grid" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}"/>${yGrid}${xGrid}${lines}</svg>`
}

function projectBars(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('construction')}<strong>No projects yet</strong><span>The chart appears after the first delivery.</span></div>`
  const items = projects.slice(0, 10).reverse()
  const values = items.map((project) => Math.max(0, project.job.budget - project.penalty))
  const max = Math.max(...values, 1)
  const guides = [0, 25, 50, 75, 100].map((position) => `<i style="top:${position}%"></i>`).join('')
  return `<div class="bar-scale-label"><span>100% = ${compactMoney(max)}</span></div><div class="bar-chart"><div class="bar-guides" aria-hidden="true">${guides}</div>${items.map((project, index) => {
    const revenue = values[index]
    const profit = project.profit
    return `<div class="bar-item" title="${buildingById(project.job.building).name}: revenue ${money(revenue)}, profit ${money(profit)}"><span class="bar-value">${compactMoney(revenue)}</span><div class="bar-columns"><span class="bar revenue" style="height:${Math.max(4, revenue / max * 130)}px"></span><span class="bar profit ${profit >= 0 ? 'positive' : 'negative'}" style="height:${Math.max(4, Math.abs(profit) / max * 130)}px"></span></div><small>${buildingById(project.job.building).short}</small></div>`
  }).join('')}</div>`
}

function costStructure(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('document')}<strong>No completed projects</strong><span>The cost structure appears after a delivery.</span></div>`
  const totals = projects.reduce((sum, project) => ({
    material: sum.material + project.materialCost,
    labor: sum.labor + project.laborCost,
    logistics: sum.logistics + project.logisticsCost,
    equipment: sum.equipment + project.equipmentCost,
    rent: sum.rent + (project.rentCost ?? 0),
    factoring: sum.factoring + project.factoringFee,
  }), { material: 0, labor: 0, logistics: 0, equipment: 0, rent: 0, factoring: 0 })
  const total = Math.max(1, Object.values(totals).reduce((sum, value) => sum + value, 0))
  const parts = [
    ['Materials', totals.material, 'material'],
    ['Labor', totals.labor, 'labor'],
    ['Delivery', totals.logistics, 'logistics'],
    ['Rent', totals.rent, 'rent'],
    ['Equipment', totals.equipment - totals.rent, 'equipment'],
    ['Factoring', totals.factoring, 'factoring'],
  ] as const
  return `<div class="cost-donut">${parts.map(([label, value, className]) => `<div class="cost-part ${className}"><span>${label}</span><b>${money(value)}</b><strong>${percent(Math.max(0, value) / total)}</strong><div class="stock-bar"><span style="width:${Math.max(0, value) / total * 100}%"></span></div></div>`).join('')}</div>`
}

function buildingStats(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('jobs')}<strong>No delivered projects</strong><span>Statistics appear after the first delivery.</span></div>`
  const counts = new Map<string, number>()
  for (const project of projects) counts.set(project.job.building, (counts.get(project.job.building) ?? 0) + 1)
  return `<div class="type-stats">${[...counts.entries()].map(([building, count]) => `<div><span class="building-mark">${buildingById(building).short}</span><div><strong>${buildingById(building).name}</strong><small>${count} units</small></div></div>`).join('')}</div>`
}

function buildingMarginStats(projects: Project[]): string {
  if (!projects.length) return `<div class="chart-empty">${icon('jobs')}<strong>No delivered projects</strong><span>Profitability by type appears after the first delivery.</span></div>`
  const rows = new Map<string, { count: number; revenue: number; profit: number }>()
  for (const project of projects) {
    const entry = rows.get(project.job.building) ?? { count: 0, revenue: 0, profit: 0 }
    entry.count += 1
    entry.revenue += project.job.budget - project.penalty
    entry.profit += project.profit
    rows.set(project.job.building, entry)
  }
  const sorted = [...rows.entries()].sort((a, b) => b[1].profit - a[1].profit)
  const head = `<div class="margin-stat margin-head"><span></span><span></span><span>Revenue</span><span>Profit</span><span>Margin</span></div>`
  const body = sorted.map(([id, row]) => {
    const def = buildingById(id)
    const margin = row.revenue > 0 ? row.profit / row.revenue : 0
    return `<div class="margin-stat"><span class="building-mark">${def.short}</span><div class="margin-name"><strong>${def.name}</strong><small>${row.count} units</small></div><span class="margin-value">${compactMoney(row.revenue)}</span><span class="margin-value ${row.profit >= 0 ? 'positive' : 'negative'}">${compactMoney(row.profit)}</span><strong class="margin-pct ${row.profit >= 0 ? 'positive' : 'negative'}">${percent(margin)}</strong></div>`
  }).join('')
  return `<div class="margin-stats">${head}${body}</div>`
}

function priceChart(history: GameState['priceHistory']): string {
  const depth = Math.max(0, ...Object.values(history).map((values) => values.length))
  if (depth < 2) return `<div class="chart-empty">${icon('trend')}<strong>Not enough data</strong><span>The price chart appears after a few market recalculations.</span></div>`
  const width = 660
  const height = 250
  const padTop = 18
  const padLeft = 66
  const padRight = 18
  const padBottom = 48
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom
  const all = Object.values(history).flatMap((values) => values)
  const rawMin = Math.min(...all)
  const rawMax = Math.max(...all)
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
  const yTicks: number[] = []
  for (let value = min; value <= top + step / 2; value += step) yTicks.push(Math.round(value * 100) / 100)
  const yGrid = yTicks.map((value) => {
    const y = padTop + (1 - (value - min) / (top - min)) * plotH
    return `<line class="chart-grid" x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}"/><text class="chart-label" x="${padLeft - 7}" y="${y + 3}" text-anchor="end">${compactMoney(value)}</text>`
  }).join('')
  const xStep = plotW / Math.max(1, depth - 1)
  const total = 5
  const xIndexes: number[] = []
  for (let index = 0; index < total; index += 1) xIndexes.push(Math.round(((depth - 1) * index) / (total - 1)))
  const xGrid = xIndexes.map((index) => {
    const x = padLeft + index * xStep
    return `<line class="chart-grid" x1="${x}" y1="${height - padBottom}" x2="${x}" y2="${height - padBottom + 4}"/><text class="chart-label" x="${x}" y="${height - padBottom + 18}" text-anchor="middle">Sample #${index + 1}</text>`
  }).join('')
  const lines = MATERIALS.map((material) => {
    const values = history[material.id]
    const points = Array.from({ length: depth }, (_, index) => {
      const value = values[index] ?? values[values.length - 1] ?? 0
      return `${padLeft + index * xStep},${padTop + (1 - (value - min) / (top - min)) * plotH}`
    }).join(' ')
    return `<polyline class="chart-line price-${material.id}" points="${points}"/>`
  }).join('')
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img"><line class="chart-grid" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}"/><line class="chart-grid" x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}"/>${yGrid}${xGrid}${lines}</svg>`
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
  if (!isResearched(state, 'bank_account')) return `${pageHeading('Analytics', 'Financial report', 'History of capital, profit and the company cost structure.', badge('Closed', 'neutral'))}<section class="card bank-locked"><div class="empty-icon">${icon('report')}</div><div><div class="eyebrow">Financial analytics</div><h2>Open a current account</h2><p>After researching "Bank account", capital, cash, reputation, profit and cost structure charts will appear here.</p><button class="btn btn-primary" data-route="technology">Go to Technologies ${icon('arrow')}</button></div></section>`
  const season = currentSeason(state)
  const status = companyStatus(state)
  const stats = financeStats(state)
  const direct = state.completed.reduce((sum, project) => sum + projectCosts(project).direct, 0)
  return `${pageHeading('Company analytics', 'Financial report', 'History of capital, cash, reputation and delivered project results.', badge(`${state.financeHistory.length} days of history`, 'info'))}
    <section class="kpi-grid report-kpis">
      <article class="kpi-card"><div class="kpi-icon orange">${icon('wallet')}</div><div><span>Capital</span><strong>${compactMoney(netWorth(state))}</strong><small>Cash and equipment minus liabilities</small></div></article>
      <article class="kpi-card"><div class="kpi-icon teal">${icon('trend')}</div><div><span>Season revenue</span><strong>${compactMoney(state.seasonRevenue)}</strong><small>All-time: ${compactMoney(stats.revenue)}</small></div></article>
      <article class="kpi-card"><div class="kpi-icon blue">${icon('document')}</div><div><span>Average margin</span><strong>${percent(stats.margin)}</strong><small>Profit / revenue of delivered projects</small></div></article>
      <article class="kpi-card"><div class="kpi-icon sand">${icon('star')}</div><div><span>Current debt</span><strong>${money(Math.max(0, state.debt))}</strong><small>${state.debt > 0 ? 'Needs attention' : 'No liabilities'}</small></div></article>
    </section>
    <div class="report-grid">
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Dynamics</div><h2>Capital and cash</h2></div></div>${lineChart(state.financeHistory, [{ key: 'capital', label: 'Capital', className: 'capital' }, { key: 'cash', label: 'Cash', className: 'cash' }])}<div class="chart-legend"><span><i class="legend-dot capital"></i>Capital</span><span><i class="legend-dot cash"></i>Cash</span></div></section>
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Market</div><h2>Material prices</h2></div></div>${priceChart(state.priceHistory)}<div class="chart-legend price-legend">${MATERIALS.map((material) => `<span><i class="legend-dot price-${material.id}"></i>${material.name}</span>`).join('')}</div></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Reputation</div><h2>Trust dynamics</h2></div></div>${lineChart(state.financeHistory, [{ key: 'reputation', label: 'Reputation', className: 'reputation' }])}</section>
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Delivered projects</div><h2>Revenue and profit</h2></div>${badge('last 10', 'info')}</div>${projectBars(state.completed)}<div class="chart-legend"><span><i class="legend-dot revenue"></i>Revenue</span><span><i class="legend-dot profit"></i>Profit</span></div></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Costs</div><h2>Cost structure</h2></div></div>${costStructure(state.completed)}<p class="field-hint">Total direct costs: ${money(direct)}</p></section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Portfolio</div><h2>Project types</h2></div></div>${buildingStats(state.completed)}</section>
      <section class="card report-card wide"><div class="section-title compact"><div><div class="eyebrow">Profitability</div><h2>Profit by project type</h2></div>${badge('all-time', 'info')}</div>${buildingMarginStats(state.completed)}</section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Season</div><h2>${season.name}</h2></div>${badge(seasonGoalMet(state) ? 'goal met' : `day ${state.day}/${BALANCE.seasonDays}`, seasonGoalMet(state) ? 'success' : 'info')}</div><p>${seasonEffectText(state) || 'No special conditions'}</p>${progress(capitalProgress(state), 'Capital')}${progress(state.reputation / season.goal.reputation, 'Reputation')}${progress(state.seasonCompleted / season.goal.completed, 'Projects')}</section>
      <section class="card report-card"><div class="section-title compact"><div><div class="eyebrow">Company</div><h2>${status.name}</h2></div></div>${progress(status.progress, 'To next status')}<dl class="cost-list"><div><dt>Best project</dt><dd>${stats.best ? `${buildingById(stats.best.job.building).name} · ${money(stats.best.profit)}` : '—'}</dd></div><div><dt>Late deliveries</dt><dd>${stats.late}</dd></div><div><dt>Equipment</dt><dd>${state.equipment.length} units</dd></div><div><dt>Maintenance</dt><dd>${money(equipmentMaintenance(state) + warehouseStorageFee(state))} / day</dd></div><div><dt>Equipment sold</dt><dd>${state.equipmentSold} units</dd></div></dl></section>
    </div>`
}
