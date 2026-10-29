import { MATERIALS, SUPPLIERS, buildingById } from '../../game/catalog'
import { frontPrice, inventoryQty, stockQty } from '../../game/engine'
import { badge, money, number, pageHeading } from '../components'
import { icon } from '../icons'
import type { SupplierId } from '../../game/types'
import type { ViewContext } from '../types'

export function renderMarket(ctx: ViewContext): string {
  const { state } = ctx
  const supplier = ctx.supplier
  const def = SUPPLIERS[supplier]
  return `${pageHeading('Закупки и логистика', 'Рынок материалов', 'Цены меняются от спроса. Старые партии постепенно уцениваются.', `<button class="btn btn-secondary" data-route="construction">${icon('box')} Склад проекта</button>`)}
    <div class="market-toolbar card"><div class="segmented supplier-tabs">${(Object.keys(SUPPLIERS) as SupplierId[]).map((id) => `<button class="${supplier === id ? 'active' : ''}" data-action="supplier" data-id="${id}"><strong>${SUPPLIERS[id].name}</strong><span>${SUPPLIERS[id].description}</span></button>`).join('')}</div><div class="delivery-note">${icon('truck')}<div><strong>${supplier === 'north' ? 'Доставка сегодня' : 'Доставка завтра'}</strong><span>Логистика ${Math.round(def.feeRate * 100)}% от закупки</span></div></div></div>
    <section class="card quick-order"><div><div class="eyebrow">Быстрая закупка</div><h2>Собрать недостающее для объекта</h2><p>Одна проверка остатков, денег и доставки для всех оставшихся этапов.</p></div><div class="quick-order-actions"><select data-change="market-project">${state.projects.length ? state.projects.map((project) => `<option value="${project.id}" ${ctx.projectId === project.id ? 'selected' : ''}>${buildingById(project.job.building).name}</option>`).join('') : '<option>Нет активных объектов</option>'}</select><button class="btn btn-primary" data-action="buy-missing" ${!state.projects.length ? 'disabled' : ''}>${icon('box')} Закупить недостающее</button></div></section>
    ${state.deliveries.length ? `<div class="notice notice-info">${icon('truck')}<div><strong>В пути: ${state.deliveries.length} поставок</strong><span>${state.deliveries.map((delivery) => `день ${delivery.arriveDay} · ${delivery.items.reduce((sum, item) => sum + item.qty, 0)} ед.`).join(' | ')}</span></div></div>` : ''}
    <section class="card table-card"><div class="table-scroll"><table class="data-table market-table"><thead><tr><th>Материал</th><th>Цена / ед.</th><th>Остаток базы</th><th>На складе</th><th>Количество</th><th>Итого с доставкой</th><th></th></tr></thead><tbody>${MATERIALS.map((material) => {
      const stock = stockQty(state, material.id, supplier)
      const price = frontPrice(state, material.id, supplier)
      const previous = state.priceHistory[material.id].at(-2) ?? material.basePrice
      const trend = price > previous ? 'up' : price < previous ? 'down' : 'flat'
      return `<tr><td data-label="Материал"><div class="material-name"><span class="material-code">${material.short}</span><div><strong>${material.name}</strong><span>${material.unit}</span></div></div></td><td data-label="Цена"><strong>${money(price)}</strong><span class="price-trend ${trend}">${trend === 'up' ? '↑ рост' : trend === 'down' ? '↓ снижение' : '— стабильно'}</span></td><td data-label="Остаток"><strong>${number(stock)}</strong><div class="stock-bar"><span style="width:${Math.min(100, stock / material.stockMax * 100)}%"></span></div></td><td data-label="Склад"><strong>${number(inventoryQty(state, material.id))}</strong><span class="muted">${material.unit}</span></td><td data-label="Количество"><input class="qty-input" type="number" min="1" max="${stock}" value="10" inputmode="numeric" data-qty="${material.id}" aria-label="Количество: ${material.name}" /></td><td data-label="Итого"><strong data-quote="${material.id}">—</strong></td><td><button class="btn btn-small btn-secondary" data-action="buy-material" data-id="${material.id}" ${stock <= 0 ? 'disabled' : ''}>Купить</button></td></tr>`
    }).join('')}</tbody></table></div></section>
    <div class="market-legend"><span>${badge('FIFO', 'info')} Сначала продаются старые лоты, поэтому итог может отличаться от цены первой партии.</span><span>Масштабные закупки сразу поднимают цены на остатке.</span><span>Пересчёт поставок каждые 3 дня</span></div>`
}
