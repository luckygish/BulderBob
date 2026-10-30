import { buildingById, equipmentById, materialById } from '../../game/catalog'
import { hasProvisions, inventoryQty, maxCrews, missingProvisions, projectEquipmentBonus, projectReservedQty, requiredCrews } from '../../game/engine'
import { forecastProject, projectBlockReason, projectCosts, projectProgress } from '../../game/selectors'
import { badge, emptyState, money, number, pageHeading, percent, progress } from '../components'
import { icon } from '../icons'
import type { MaterialId, Project } from '../../game/types'
import type { ViewContext } from '../types'

function renderProject(ctx: ViewContext, project: Project): string {
  const { state } = ctx
  const def = buildingById(project.job.building)
  const stageDef = def.stages[project.currentStage]
  const costs = projectCosts(project)
  const forecast = forecastProject(state, project)
  const reason = projectBlockReason(state, project)
  const stage = project.stages[project.currentStage]
  const crewCount = requiredCrews(project)
  const crewControls = Array.from({ length: crewCount }, (_, slot) => {
    const selected = project.crewIds[slot] ?? -1
    const options = [`<option value="-1" ${selected < 0 ? 'selected' : ''}>Not assigned</option>`]
    for (let i = 0; i < maxCrews(state); i += 1) options.push(`<option value="${i}" ${selected === i ? 'selected' : ''}>Crew #${i + 1} · ${state.crews[i].workers.length} people</option>`)
    return `<label class="field"><span>Crew ${slot + 1}${crewCount > 1 ? ` of ${crewCount}` : ''}</span><select data-change="assign-crew" data-project="${project.id}" data-slot="${slot}">${options.join('')}</select></label>`
  }).join('')
  const assets = state.equipment.filter((asset) => !asset.projectId || asset.projectId === project.id)
  const assetLabel = (assetId: string) => {
    const sameType = state.equipment.filter((asset) => asset.id === state.equipment.find((item) => item.assetId === assetId)?.id)
    return sameType.findIndex((asset) => asset.assetId === assetId) + 1
  }
  const missingProvision = missingProvisions(state)
  const provisionText = hasProvisions(state) ? 'Sites fully equipped' : `Need to buy: ${Object.keys(missingProvision).length} items`
  const equipmentBonus = projectEquipmentBonus(state, project)
  return `<section class="card project-workspace">
    <div class="project-header"><div class="project-identity"><span class="building-mark large">${def.short}</span><div><div class="eyebrow">${project.job.client}</div><h2>${def.name}</h2><p>Contract ${money(project.job.budget)} · delivery by day ${project.job.deadline}</p></div></div><div class="project-header-badges">${project.job.special ? badge('Special project', 'warning') : ''}${badge(project.started ? 'Active construction' : 'Preparation', project.started ? 'success' : 'warning')}${state.day > project.job.deadline ? badge('Overdue', 'danger') : badge(`${project.job.deadline - state.day} days left`, 'neutral')}</div></div>
    <div class="project-progress-row">${progress(projectProgress(project), 'Project readiness')}<div class="forecast ${forecast.onTime ? 'positive' : 'negative'}">${icon('clock')}<div><strong>≈ ${forecast.days} work days</strong><span>${forecast.onTime ? 'On schedule' : 'Risk of delay'}</span></div></div></div>
    <div class="stage-stepper">${def.stages.map((item, index) => {
      const status = project.stages[index].status
      return `<div class="stage-step ${status}"><span class="stage-dot">${status === 'completed' ? icon('check') : index + 1}</span><div><strong>${item.name}</strong><span>${status === 'completed' ? 'Completed' : status === 'in_progress' ? `${percent(project.stages[index].progress)} · building` : status === 'ready' ? 'Ready to start' : 'Awaiting resources'}</span></div></div>`
    }).join('')}</div>
    ${reason ? `<div class="notice notice-warning">${icon('alert')}<div><strong>Construction cannot proceed</strong><span>${reason}</span></div></div>` : ''}
    ${crewCount > maxCrews(state) ? `<div class="notice notice-info">${icon('hr')}<div><strong>Need a second crew</strong><span>Research Professional standards to unlock crew #2.</span></div></div>` : ''}
    <div class="project-controls">
      ${crewControls}
      <label class="field"><span>Equipment on site</span><select data-change="assign-equipment" data-project="${project.id}"><option value="">Not assigned</option>${assets.map((asset) => `<option value="${asset.assetId}" ${asset.assetId === project.equipmentAssetId ? 'selected' : ''}>${equipmentById(asset.id).name} #${assetLabel(asset.assetId)} · ${asset.status === 'rented' ? `${asset.hoursRemaining} h` : asset.status === 'owned' ? 'owned' : 'lease'}</option>`).join('')}</select></label>
      <div class="provision-check ${hasProvisions(state) ? 'ready' : ''}">${icon(hasProvisions(state) ? 'check' : 'alert')}<div><strong>Provisions</strong><span>${provisionText}. Each active project needs its own set.</span></div></div>
    </div>
    ${stageDef ? `<div class="notice notice-neutral">${icon('equipment')}<div><strong>Stage equipment</strong><span>${stageDef.requiredEquipment?.length ? `Required: ${stageDef.requiredEquipment.map((id) => equipmentById(id).name).join(' or ')}` : 'Not required'}${equipmentBonus > 0 ? ` · current bonus +${Math.round(equipmentBonus * 100)}%` : ''}</span></div></div>` : ''}
    <div class="work-grid">
      <section class="stage-detail"><div class="section-title compact"><div><div class="eyebrow">Current stage</div><h3>${stageDef?.name ?? 'All stages complete'}</h3></div>${badge(stage?.status === 'in_progress' ? 'In progress' : stage?.status === 'ready' ? 'Supplied' : 'Materials', stage?.status === 'in_progress' ? 'success' : 'info')}</div>
        <div class="material-checklist">${stageDef ? (Object.entries(stageDef.materials) as [MaterialId, number][]).map(([material, qty]) => {
          const allocated = stage.stock[material]?.qty ?? 0
          const reserved = projectReservedQty(project, material)
          const warehouse = inventoryQty(state, material)
          const enough = allocated + reserved + warehouse >= qty
          return `<div class="material-check"><span class="material-code">${materialById(material).short}</span><div><strong>${materialById(material).name}</strong><span>On site ${number(allocated)} · reserved ${number(reserved)} · warehouse ${number(warehouse)}</span></div><div class="material-need ${enough ? 'positive' : 'negative'}">${number(qty)} ${materialById(material).unit}${icon(enough ? 'check' : 'alert')}</div></div>`
        }).join('') : ''}</div>
        <div class="button-row"><button class="btn btn-secondary" data-action="allocate" data-id="${project.id}" ${!stageDef || stage.status === 'in_progress' ? 'disabled' : ''}>${icon('box')} Supply the stage</button><button class="btn btn-primary" data-action="${project.started ? 'start-stage' : 'start-full'}" data-id="${project.id}" ${stage?.status === 'in_progress' || reason ? 'disabled' : ''}>${icon('play')} ${project.started ? 'Start current stage' : 'Start full construction'}</button></div>
        ${!project.started ? `<p class="field-hint">Full construction requires materials for all stages and starts them automatically.</p>` : ''}
      </section>
      <aside class="estimate-panel"><div class="eyebrow">Live estimate</div><h3>Project economics</h3><dl class="cost-list"><div><dt>Materials</dt><dd>${money(project.materialCost)}</dd></div><div><dt>Labor</dt><dd>${money(project.laborCost)}</dd></div><div><dt>Delivery</dt><dd>${money(project.logisticsCost)}</dd></div><div><dt>Equipment</dt><dd>${money(project.equipmentCost)}</dd></div>${project.factoringFee ? `<div><dt>Factoring</dt><dd>${money(project.factoringFee)}</dd></div>` : ''}<div class="cost-total"><dt>Forecast profit</dt><dd class="${costs.profit >= 0 ? 'positive' : 'negative'}">${money(costs.profit)}</dd></div></dl><div class="margin-line"><span>Margin</span>${badge(percent(costs.margin), costs.margin >= 0.2 ? 'success' : 'warning')}</div></aside>
    </div>
  </section>`
}

export function renderConstruction(ctx: ViewContext): string {
  const { state } = ctx
  const project = state.projects.find((item) => item.id === ctx.projectId) ?? state.projects[0]
  return `${pageHeading('Production', 'Construction', 'Stages, resources, deadlines and the real economics of each project.', badge(`${state.projects.length} active`, 'info'))}
    ${state.projects.length > 1 ? `<div class="segmented project-tabs">${state.projects.map((item) => `<button class="${item.id === project?.id ? 'active' : ''}" data-action="select-project" data-id="${item.id}">${buildingById(item.job.building).name}</button>`).join('')}</div>` : ''}
    ${project ? renderProject(ctx, project) : `<div class="card">${emptyState(icon('construction'), 'No active projects yet', 'Pick a suitable contract and come back here to prepare the site.', `<button class="btn btn-primary" data-route="jobs">Open jobs ${icon('arrow')}</button>`)}</div>`}
    ${state.completed.length ? `<section class="section-block"><div class="section-title"><div><h2>Delivered projects</h2><p>Actual results without forecasts</p></div></div><div class="completed-grid">${state.completed.slice(0, 4).map((item) => `<article class="card completed-card"><span class="building-mark">${buildingById(item.job.building).short}</span><div><h3>${buildingById(item.job.building).name}</h3><p>Day ${item.completedDay} · ${item.totalHours} work h</p></div><strong class="${item.profit >= 0 ? 'positive' : 'negative'}">${money(item.profit)}</strong><button class="text-btn" data-action="report" data-id="${item.id}">Report ${icon('chevron')}</button></article>`).join('')}</div></section>` : ''}`
}