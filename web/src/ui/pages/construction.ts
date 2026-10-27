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
    const options = [`<option value="-1" ${selected < 0 ? 'selected' : ''}>Не назначена</option>`]
    for (let i = 0; i < maxCrews(state); i += 1) options.push(`<option value="${i}" ${selected === i ? 'selected' : ''}>Бригада №${i + 1} · ${state.crews[i].workers.length} чел.</option>`)
    return `<label class="field"><span>Бригада ${slot + 1}${crewCount > 1 ? ` из ${crewCount}` : ''}</span><select data-change="assign-crew" data-project="${project.id}" data-slot="${slot}">${options.join('')}</select></label>`
  }).join('')
  const assets = state.equipment.filter((asset) => !asset.projectId || asset.projectId === project.id)
  const assetLabel = (assetId: string) => {
    const sameType = state.equipment.filter((asset) => asset.id === state.equipment.find((item) => item.assetId === assetId)?.id)
    return sameType.findIndex((asset) => asset.assetId === assetId) + 1
  }
  const missingProvision = missingProvisions(state)
  const provisionText = hasProvisions(state) ? 'Площадки укомплектованы' : `Нужно докупить: ${Object.keys(missingProvision).length} позиции`
  const equipmentBonus = projectEquipmentBonus(state, project)
  return `<section class="card project-workspace">
    <div class="project-header"><div class="project-identity"><span class="building-mark large">${def.short}</span><div><div class="eyebrow">${project.job.client}</div><h2>${def.name}</h2><p>Договор ${money(project.job.budget)} · сдача до дня ${project.job.deadline}</p></div></div><div class="project-header-badges">${project.job.special ? badge('Особый проект', 'warning') : ''}${badge(project.started ? 'Активная стройка' : 'Подготовка', project.started ? 'success' : 'warning')}${state.day > project.job.deadline ? badge('Просрочен', 'danger') : badge(`${project.job.deadline - state.day} дн. осталось`, 'neutral')}</div></div>
    <div class="project-progress-row">${progress(projectProgress(project), 'Готовность объекта')}<div class="forecast ${forecast.onTime ? 'positive' : 'negative'}">${icon('clock')}<div><strong>≈ ${forecast.days} раб. дн.</strong><span>${forecast.onTime ? 'Укладываетесь в срок' : 'Есть риск просрочки'}</span></div></div></div>
    <div class="stage-stepper">${def.stages.map((item, index) => {
      const status = project.stages[index].status
      return `<div class="stage-step ${status}"><span class="stage-dot">${status === 'completed' ? icon('check') : index + 1}</span><div><strong>${item.name}</strong><span>${status === 'completed' ? 'Завершён' : status === 'in_progress' ? `${percent(project.stages[index].progress)} · строится` : status === 'ready' ? 'Готов к запуску' : 'Ожидает ресурсов'}</span></div></div>`
    }).join('')}</div>
    ${reason ? `<div class="notice notice-warning">${icon('alert')}<div><strong>Стройка не может идти</strong><span>${reason}</span></div></div>` : ''}
    ${crewCount > maxCrews(state) ? `<div class="notice notice-info">${icon('hr')}<div><strong>Нужна вторая бригада</strong><span>Исследуйте «Профстандарты», чтобы открыть бригаду №2.</span></div></div>` : ''}
    <div class="project-controls">
      ${crewControls}
      <label class="field"><span>Техника на объекте</span><select data-change="assign-equipment" data-project="${project.id}"><option value="">Не назначена</option>${assets.map((asset) => `<option value="${asset.assetId}" ${asset.assetId === project.equipmentAssetId ? 'selected' : ''}>${equipmentById(asset.id).name} №${assetLabel(asset.assetId)} · ${asset.status === 'rented' ? `${asset.hoursRemaining} ч` : asset.status === 'owned' ? 'своя' : 'лизинг'}</option>`).join('')}</select></label>
      <div class="provision-check ${hasProvisions(state) ? 'ready' : ''}">${icon(hasProvisions(state) ? 'check' : 'alert')}<div><strong>Обеспечение</strong><span>${provisionText}. На каждый активный объект нужен свой комплект.</span></div></div>
    </div>
    ${stageDef ? `<div class="notice notice-neutral">${icon('equipment')}<div><strong>Техника этапа</strong><span>${stageDef.requiredEquipment?.length ? `Обязательно: ${stageDef.requiredEquipment.map((id) => equipmentById(id).name).join(' или ')}` : 'Не обязательна'}${equipmentBonus > 0 ? ` · текущий бонус +${Math.round(equipmentBonus * 100)}%` : ''}</span></div></div>` : ''}
    <div class="work-grid">
      <section class="stage-detail"><div class="section-title compact"><div><div class="eyebrow">Текущий этап</div><h3>${stageDef?.name ?? 'Все этапы завершены'}</h3></div>${badge(stage?.status === 'in_progress' ? 'В работе' : stage?.status === 'ready' ? 'Обеспечен' : 'Материалы', stage?.status === 'in_progress' ? 'success' : 'info')}</div>
        <div class="material-checklist">${stageDef ? (Object.entries(stageDef.materials) as [MaterialId, number][]).map(([material, qty]) => {
          const allocated = stage.stock[material]?.qty ?? 0
          const reserved = projectReservedQty(project, material)
          const warehouse = inventoryQty(state, material)
          const enough = allocated + reserved + warehouse >= qty
          return `<div class="material-check"><span class="material-code">${materialById(material).short}</span><div><strong>${materialById(material).name}</strong><span>На объекте ${number(allocated)} · резерв ${number(reserved)} · общий склад ${number(warehouse)}</span></div><div class="material-need ${enough ? 'positive' : 'negative'}">${number(qty)} ${materialById(material).unit}${icon(enough ? 'check' : 'alert')}</div></div>`
        }).join('') : ''}</div>
        <div class="button-row"><button class="btn btn-secondary" data-action="allocate" data-id="${project.id}" ${!stageDef || stage.status === 'in_progress' ? 'disabled' : ''}>${icon('box')} Обеспечить этап</button><button class="btn btn-primary" data-action="${project.started ? 'start-stage' : 'start-full'}" data-id="${project.id}" ${stage?.status === 'in_progress' || reason ? 'disabled' : ''}>${icon('play')} ${project.started ? 'Начать текущий этап' : 'Запустить всю стройку'}</button></div>
        ${!project.started ? `<p class="field-hint">«Вся стройка» требует материалы для всех этапов и запускает их автоматически.</p>` : ''}
      </section>
      <aside class="estimate-panel"><div class="eyebrow">Живая смета</div><h3>Экономика проекта</h3><dl class="cost-list"><div><dt>Материалы</dt><dd>${money(project.materialCost)}</dd></div><div><dt>Труд</dt><dd>${money(project.laborCost)}</dd></div><div><dt>Доставка</dt><dd>${money(project.logisticsCost)}</dd></div><div><dt>Техника</dt><dd>${money(project.equipmentCost)}</dd></div>${project.factoringFee ? `<div><dt>Факторинг</dt><dd>${money(project.factoringFee)}</dd></div>` : ''}<div class="cost-total"><dt>Прогноз прибыли</dt><dd class="${costs.profit >= 0 ? 'positive' : 'negative'}">${money(costs.profit)}</dd></div></dl><div class="margin-line"><span>Маржинальность</span>${badge(percent(costs.margin), costs.margin >= 0.2 ? 'success' : 'warning')}</div></aside>
    </div>
  </section>`
}

export function renderConstruction(ctx: ViewContext): string {
  const { state } = ctx
  const project = state.projects.find((item) => item.id === ctx.projectId) ?? state.projects[0]
  return `${pageHeading('Производство', 'Строительство', 'Этапы, ресурсы, сроки и фактическая экономика каждого объекта.', badge(`${state.projects.length} активных`, 'info'))}
    ${state.projects.length > 1 ? `<div class="segmented project-tabs">${state.projects.map((item) => `<button class="${item.id === project?.id ? 'active' : ''}" data-action="select-project" data-id="${item.id}">${buildingById(item.job.building).name}</button>`).join('')}</div>` : ''}
    ${project ? renderProject(ctx, project) : `<div class="card">${emptyState(icon('construction'), 'Пока нет активных объектов', 'Выберите подходящий заказ и вернитесь сюда для подготовки площадки.', `<button class="btn btn-primary" data-route="jobs">Открыть заказы ${icon('arrow')}</button>`)}</div>`}
    ${state.completed.length ? `<section class="section-block"><div class="section-title"><div><h2>Сданные объекты</h2><p>Фактические результаты без прогнозов</p></div></div><div class="completed-grid">${state.completed.slice(0, 4).map((item) => `<article class="card completed-card"><span class="building-mark">${buildingById(item.job.building).short}</span><div><h3>${buildingById(item.job.building).name}</h3><p>День ${item.completedDay} · ${item.totalHours} раб. ч</p></div><strong class="${item.profit >= 0 ? 'positive' : 'negative'}">${money(item.profit)}</strong><button class="text-btn" data-action="report" data-id="${item.id}">Отчёт ${icon('chevron')}</button></article>`).join('')}</div></section>` : ''}`
}
