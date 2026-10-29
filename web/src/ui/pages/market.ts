import { BALANCE } from '../../game/balance'
import { MATERIALS, SUPPLIERS, buildingById } from '../../game/catalog'
import { frontPrice, inventoryQty, stockQty, warehouseCost, warehouseStorageFee, warehouseStorageRate } from '../../game/engine'
import { badge, money, number, pageHeading } from '../components'
import { icon } from '../icons'
import type { SupplierId } from '../../game/types'
import type { MarketTab, ViewContext } from '../types'

function projectOptions(ctx: ViewContext): string {
  return ctx.state.projects.length
    ? ctx.state.projects.map((project) => `<option value="${project.id}" ${ctx.projectId === project.id ? 'selected' : ''}>${buildingById(project.job.building).name}</option>`).join('')
    : '<option>Нет активных объектов</option>'
}

function deliveriesNotice(ctx: ViewContext): string {
  if (!ctx.state.deliveries.length) return ''
  return `<div class="notice notice-info">${icon('truck')}<div><strong>В пути: ${ctx.state.deliveries.length} поставок</strong><span>${ctx.state.deliveries.map((delivery) => `день ${delivery.arriveDay} · ${delivery.items.reduce((sum, item) => sum + item.qty, 0)} ед.`).join(' | ')}</span></div></div>`
}

function renderWarehouse(ctx: ViewContext): string {
  const { state } = ctx
  const totalUnits = MATERIALS.reduce((sum, material) => sum + inventoryQty(state, material.id), 0)
  const ratePercent = Math.round(warehouseStorageRate(state) * 100)
  const fee = warehouseStorageFee(state)
  const stockValue = warehouseCost(state)
  const restockButton = `<button class="btn btn-primary" data-action="restock-from-warehouse" ${!state.projects.length ? 'disabled' : ''}>${icon('box')} Пополнить недостающее</button>`
  return `<div class="market-toolbar card"><div class="segmented supplier-tabs">${supplierTabs(ctx)}</div><div class="delivery-note">${icon('box')}<div><strong>Занято ${number(totalUnits)} ед. · тариф ${ratePercent}% · плата ${money(fee)} за сутки</strong><span>Потолок ${BALANCE.warehouseCap} ед./материал · излишек сверх лимита продаётся за ${Math.round(BALANCE.warehouseSaleRate * 100)}% себестоимости</span></div></div></div>
    <section class="card quick-order"><div><div class="eyebrow">Пополнение со склада</div><h2>Перенести недостающее для объекта</h2><p>Материалы со склада уходят в резерв объекта без доставки: этапы расходуют резерв, затем склад. Перенос освобождает складское место (плата за хранение снижается), но не меняет сумму закупки на базе.</p></div><div class="quick-order-actions"><select data-change="market-project">${projectOptions(ctx)}</select>${restockButton}</div></section>
    <div class="notice notice-info">${icon('box')}<div><strong>Как работает склад</strong><span>Купленное без объекта хранится здесь. При запуске этапов расходуется резерв объекта, затем склад. Неиспользованный резерв возвращается после сдачи.</span></div></div>
    ${deliveriesNotice(ctx)}
    <section class="card table-card"><div class="table-scroll"><table class="data-table market-table"><thead><tr><th>Материал</th><th>На складе</th><th>Партии FIFO</th><th>Средняя цена / ед.</th><th>Стоимость запаса</th><th>Количество</th><th></th></tr></thead><tbody>${MATERIALS.map((material) => {
      const batches = state.inventory[material.id]
      const qtyOnHand = inventoryQty(state, material.id)
      const total = batches.reduce((sum, batch) => sum + batch.qty * batch.unitCost, 0)
      const average = qtyOnHand > 0 ? Math.round(total / qtyOnHand) : 0
      const fifo = batches.length ? batches.map((batch) => `${number(batch.qty)} ${material.unit} · ${money(batch.unitCost)}`).join(', ') : '—'
      return `<tr><td data-label="Материал"><div class="material-name"><span class="material-code">${material.short}</span><div><strong>${material.name}</strong><span>${material.unit}</span></div></div></td><td data-label="На складе"><strong>${number(qtyOnHand)}</strong><span class="muted">${material.unit}</span></td><td data-label="Партии FIFO"><span class="muted">${fifo}</span></td><td data-label="Средняя цена"><strong>${qtyOnHand > 0 ? money(average) : '—'}</strong></td><td data-label="Стоимость запаса"><strong>${money(total)}</strong></td><td data-label="Количество"><input class="qty-input" type="number" min="1" max="${Math.max(1, qtyOnHand)}" value="10" inputmode="numeric" data-qty="${material.id}" aria-label="Количество: ${material.name}" /></td><td><button class="btn btn-small btn-secondary" data-action="restock-material" data-id="${material.id}" ${!state.projects.length || qtyOnHand <= 0 ? 'disabled' : ''}>Пополнить</button></td></tr>`
    }).join('')}</tbody><tfoot><tr class="warehouse-summary"><td colspan="5">Стоимость склада и плата за хранение</td><td><strong>${money(stockValue)}</strong></td><td><strong>${money(fee)} / день</strong></td></tr></tfoot></table></div></section>`
}

function renderSupplier(ctx: ViewContext): string {
  const { state } = ctx
  const supplier = ctx.supplier
  const def = SUPPLIERS[supplier]
  return `<div class="market-toolbar card"><div class="segmented supplier-tabs">${supplierTabs(ctx)}</div><div class="delivery-note">${icon('truck')}<div><strong>${supplier === 'north' ? 'Доставка сегодня' : 'Доставка завтра'}</strong><span>Логистика ${Math.round(def.feeRate * 100)}% от закупки</span></div></div></div>
    <section class="card quick-order"><div><div class="eyebrow">Быстрая закупка</div><h2>Собрать недостающее для объекта</h2><p>Одна проверка остатков, денег и доставки для всех оставшихся этапов.</p></div><div class="quick-order-actions"><select data-change="market-project">${projectOptions(ctx)}</select><button class="btn btn-primary" data-action="buy-missing" ${!state.projects.length ? 'disabled' : ''}>${icon('box')} Закупить недостающее</button></div></section>
    ${deliveriesNotice(ctx)}
    <section class="card table-card"><div class="table-scroll"><table class="data-table market-table"><thead><tr><th>Материал</th><th>Цена / ед.</th><th>Остаток базы</th><th>На складе</th><th>Количество</th><th>Итого с доставкой</th><th></th></tr></thead><tbody>${MATERIALS.map((material) => {
      const stock = stockQty(state, material.id, supplier)
      const price = frontPrice(state, material.id, supplier)
      const previous = state.priceHistory[material.id].at(-2) ?? material.basePrice
      const trend = price > previous ? 'up' : price < previous ? 'down' : 'flat'
      return `<tr><td data-label="Материал"><div class="material-name"><span class="material-code">${material.short}</span><div><strong>${material.name}</strong><span>${material.unit}</span></div></div></td><td data-label="Цена"><strong>${money(price)}</strong><span class="price-trend ${trend}">${trend === 'up' ? '↑ рост' : trend === 'down' ? '↓ снижение' : '— стабильно'}</span></td><td data-label="Остаток"><strong>${number(stock)}</strong><div class="stock-bar"><span style="width:${Math.min(100, stock / material.stockMax * 100)}%"></span></div></td><td data-label="Склад"><strong>${number(inventoryQty(state, material.id))}</strong><span class="muted">${material.unit}</span></td><td data-label="Количество"><input class="qty-input" type="number" min="1" max="${stock}" value="10" inputmode="numeric" data-qty="${material.id}" aria-label="Количество: ${material.name}" /></td><td data-label="Итого"><strong data-quote="${material.id}">—</strong></td><td><button class="btn btn-small btn-secondary" data-action="buy-material" data-id="${material.id}" ${stock <= 0 ? 'disabled' : ''}>Купить</button></td></tr>`
    }).join('')}</tbody></table></div></section>
    <div class="market-legend"><span>${badge('FIFO', 'info')} Сначала продаются старые лоты, поэтому итог может отличаться от цены первой партии.</span><span>Масштабные закупки сразу поднимают цены на остатке.</span><span>Пересчёт поставок каждые 3 дня</span></div>`
}

function supplierTabs(ctx: ViewContext): string {
  const active = ctx.marketTab
  const tabs = (Object.keys(SUPPLIERS) as SupplierId[]).map((id) => `<button class="${active === id ? 'active' : ''}" data-action="supplier" data-id="${id}"><strong>${SUPPLIERS[id].name}</strong><span>${SUPPLIERS[id].description}</span></button>`).join('')
  const warehouseTab: MarketTab = 'warehouse'
  return `${tabs}<button class="${active === warehouseTab ? 'active' : ''}" data-action="supplier" data-id="warehouse"><strong>Мой склад</strong><span>Ёмкость ${BALANCE.warehouseCap} ед./товар · плата 0/${Math.round(BALANCE.storageFeeRateMaxQty * 100)}/${Math.round(BALANCE.storageFeeRateOver * 100)}%</span></button>`
}

export function renderMarket(ctx: ViewContext): string {
  return `${pageHeading('Закупки и логистика', 'Рынок материалов', 'Цены меняются от спроса. Старые партии постепенно уцениваются.', `<button class="btn btn-secondary" data-route="construction">${icon('box')} Склад проекта</button>`)}
    ${ctx.marketTab === 'warehouse' ? renderWarehouse(ctx) : renderSupplier(ctx)}`
}