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
    : '<option>No active projects</option>'
}

function deliveriesNotice(ctx: ViewContext): string {
  if (!ctx.state.deliveries.length) return ''
  return `<div class="notice notice-info">${icon('truck')}<div><strong>In transit: ${ctx.state.deliveries.length} deliveries</strong><span>${ctx.state.deliveries.map((delivery) => `day ${delivery.arriveDay} · ${delivery.items.reduce((sum, item) => sum + item.qty, 0)} units`).join(' | ')}</span></div></div>`
}

function renderWarehouse(ctx: ViewContext): string {
  const { state } = ctx
  const totalUnits = MATERIALS.reduce((sum, material) => sum + inventoryQty(state, material.id), 0)
  const ratePercent = Math.round(warehouseStorageRate(state) * 100)
  const fee = warehouseStorageFee(state)
  const stockValue = warehouseCost(state)
  const restockButton = `<button class="btn btn-primary" data-action="restock-from-warehouse" ${!state.projects.length ? 'disabled' : ''}>${icon('box')} Restock missing</button>`
  return `<div class="market-toolbar card"><div class="segmented supplier-tabs">${supplierTabs(ctx)}</div><div class="delivery-note">${icon('box')}<div><strong>Occupied ${number(totalUnits)} units · rate ${ratePercent}% · fee ${money(fee)} / day</strong><span>Cap ${BALANCE.warehouseCap} units/material · overflow above the cap is sold at ${Math.round(BALANCE.warehouseSaleRate * 100)}% of cost</span></div></div></div>
    <section class="card quick-order"><div><div class="eyebrow">Restock from warehouse</div><h2>Move missing materials to a project</h2><p>Warehouse materials move into the project reserve without delivery: stages use the reserve first, then the warehouse. Moving frees warehouse space (storage fee drops) but does not change yard purchase totals.</p></div><div class="quick-order-actions"><select data-change="market-project">${projectOptions(ctx)}</select>${restockButton}</div></section>
    <div class="notice notice-info">${icon('box')}<div><strong>How the warehouse works</strong><span>Items bought without a project are stored here. On stage start, project reserve is consumed first, then warehouse. Unused reserve returns after delivery.</span></div></div>
    ${deliveriesNotice(ctx)}
    <section class="card table-card"><div class="table-scroll"><table class="data-table market-table"><thead><tr><th>Material</th><th>In warehouse</th><th>FIFO batches</th><th>Average price / unit</th><th>Stock value</th><th>Quantity</th><th></th></tr></thead><tbody>${MATERIALS.map((material) => {
      const batches = state.inventory[material.id]
      const qtyOnHand = inventoryQty(state, material.id)
      const total = batches.reduce((sum, batch) => sum + batch.qty * batch.unitCost, 0)
      const average = qtyOnHand > 0 ? Math.round(total / qtyOnHand) : 0
      const fifo = batches.length ? batches.map((batch) => `${number(batch.qty)} ${material.unit} · ${money(batch.unitCost)}`).join(', ') : '—'
      return `<tr><td data-label="Material"><div class="material-name"><span class="material-code">${material.short}</span><div><strong>${material.name}</strong><span>${material.unit}</span></div></div></td><td data-label="In warehouse"><strong>${number(qtyOnHand)}</strong><span class="muted">${material.unit}</span></td><td data-label="FIFO batches"><span class="muted">${fifo}</span></td><td data-label="Average price"><strong>${qtyOnHand > 0 ? money(average) : '—'}</strong></td><td data-label="Stock value"><strong>${money(total)}</strong></td><td data-label="Quantity"><input class="qty-input" type="number" min="1" max="${Math.max(1, qtyOnHand)}" value="10" inputmode="numeric" data-qty="${material.id}" aria-label="Quantity: ${material.name}" /></td><td><button class="btn btn-small btn-secondary" data-action="restock-material" data-id="${material.id}" ${!state.projects.length || qtyOnHand <= 0 ? 'disabled' : ''}>Restock</button></td></tr>`
    }).join('')}</tbody><tfoot><tr class="warehouse-summary"><td colspan="5">Warehouse value and storage fee</td><td><strong>${money(stockValue)}</strong></td><td><strong>${money(fee)} / day</strong></td></tr></tfoot></table></div></section>`
}

function renderSupplier(ctx: ViewContext): string {
  const { state } = ctx
  const supplier = ctx.supplier
  const def = SUPPLIERS[supplier]
  return `<div class="market-toolbar card"><div class="segmented supplier-tabs">${supplierTabs(ctx)}</div><div class="delivery-note">${icon('truck')}<div><strong>${supplier === 'north' ? 'Delivery today' : 'Delivery tomorrow'}</strong><span>Logistics ${Math.round(def.feeRate * 100)}% of purchase</span></div></div></div>
    <section class="card quick-order"><div><div class="eyebrow">Quick purchase</div><h2>Collect what is missing for a project</h2><p>One check of stock, money and delivery for all remaining stages.</p></div><div class="quick-order-actions"><select data-change="market-project">${projectOptions(ctx)}</select><button class="btn btn-primary" data-action="buy-missing" ${!state.projects.length ? 'disabled' : ''}>${icon('box')} Buy missing</button></div></section>
    ${deliveriesNotice(ctx)}
    <section class="card table-card"><div class="table-scroll"><table class="data-table market-table"><thead><tr><th>Material</th><th>Price / unit</th><th>Yard stock</th><th>In warehouse</th><th>Quantity</th><th>Total with delivery</th><th></th></tr></thead><tbody>${MATERIALS.map((material) => {
      const stock = stockQty(state, material.id, supplier)
      const price = frontPrice(state, material.id, supplier)
      const previous = state.priceHistory[material.id].at(-2) ?? material.basePrice
      const trend = price > previous ? 'up' : price < previous ? 'down' : 'flat'
      return `<tr><td data-label="Material"><div class="material-name"><span class="material-code">${material.short}</span><div><strong>${material.name}</strong><span>${material.unit}</span></div></div></td><td data-label="Price"><strong>${money(price)}</strong><span class="price-trend ${trend}">${trend === 'up' ? '↑ rising' : trend === 'down' ? '↓ falling' : '— stable'}</span></td><td data-label="Yard stock"><strong>${number(stock)}</strong><div class="stock-bar"><span style="width:${Math.min(100, stock / material.stockMax * 100)}%"></span></div></td><td data-label="Warehouse"><strong>${number(inventoryQty(state, material.id))}</strong><span class="muted">${material.unit}</span></td><td data-label="Quantity"><input class="qty-input" type="number" min="1" max="${stock}" value="10" inputmode="numeric" data-qty="${material.id}" aria-label="Quantity: ${material.name}" /></td><td data-label="Total"><strong data-quote="${material.id}">—</strong></td><td><button class="btn btn-small btn-secondary" data-action="buy-material" data-id="${material.id}" ${stock <= 0 ? 'disabled' : ''}>Buy</button></td></tr>`
    }).join('')}</tbody></table></div></section>
    <div class="market-legend"><span>${badge('FIFO', 'info')} Old lots are sold first, so the total may differ from the first batch price.</span><span>Large purchases immediately raise prices on remaining stock.</span><span>Supplies recalculated every 3 days</span></div>`
}

function supplierTabs(ctx: ViewContext): string {
  const active = ctx.marketTab
  const tabs = (Object.keys(SUPPLIERS) as SupplierId[]).map((id) => `<button class="${active === id ? 'active' : ''}" data-action="supplier" data-id="${id}"><strong>${SUPPLIERS[id].name}</strong><span>${SUPPLIERS[id].description}</span></button>`).join('')
  const warehouseTab: MarketTab = 'warehouse'
  return `${tabs}<button class="${active === warehouseTab ? 'active' : ''}" data-action="supplier" data-id="warehouse"><strong>My warehouse</strong><span>Capacity ${BALANCE.warehouseCap} units/item · fee 0/${Math.round(BALANCE.storageFeeRateMaxQty * 100)}/${Math.round(BALANCE.storageFeeRateOver * 100)}%</span></button>`
}

export function renderMarket(ctx: ViewContext): string {
  return `${pageHeading('Purchasing and logistics', 'Materials market', 'Prices change with demand. Old batches are gradually discounted.', `<button class="btn btn-secondary" data-route="construction">${icon('box')} Project warehouse</button>`)}
    ${ctx.marketTab === 'warehouse' ? renderWarehouse(ctx) : renderSupplier(ctx)}`
}