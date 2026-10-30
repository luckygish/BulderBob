import { BALANCE } from '../../game/balance'
import { EQUIPMENT, PROVISIONS, buildingById, equipmentById } from '../../game/catalog'
import { badge, money, pageHeading } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderEquipment(ctx: ViewContext): string {
  const { state } = ctx
  const saleRate = state.research.dealer_network?.status === 'done' ? 0.85 : 0.7
  return `${pageHeading('Company assets', 'Equipment and provisions', 'Build a fleet for several projects: each unit is assigned separately.', badge(`${state.equipment.length} units`, 'info'))}
    <div class="notice notice-info">${icon('clock')}<div><strong>Rental hours are spent only on site</strong><span>Idle equipment does not lose paid hours. Owned and leased equipment requires 0.1% of its value in maintenance per day.</span></div></div>
    <section class="equipment-grid">${EQUIPMENT.map((item) => {
      const assets = state.equipment.filter((entry) => entry.id === item.id)
      const leaseTotal = Math.round(item.price * (1 + BALANCE.leaseInterest))
      return `<article class="card equipment-card"><div class="equipment-card-top"><div class="equipment-illustration">${icon(item.id === 'mixer' ? 'box' : item.id === 'crane' ? 'crane' : 'equipment')}</div>${assets.length ? badge(`In fleet · ${assets.length}`, 'success') : badge('Available', 'neutral')}</div><h2>${item.name}</h2><p>${item.description}</p><div class="equipment-price"><strong>${money(item.price)}</strong><span>${money(item.rentPerHour)} / work h</span></div>${assets.length ? `<div class="asset-list">${assets.map((asset, index) => {
        const project = state.projects.find((entry) => entry.id === asset.projectId)
        const status = asset.status === 'owned' ? 'Owned' : asset.status === 'leased' ? `Lease · remaining ${money(asset.leaseRemaining)}` : `Rental · ${asset.hoursRemaining} h`
        return `<div class="asset-status"><span>${icon(asset.projectId ? 'construction' : 'check')} #${index + 1} · ${status}</span><span>${project ? buildingById(project.job.building).name : 'Free'}</span>${asset.status === 'owned' ? `<button class="btn btn-small btn-ghost" data-action="sell-dialog" data-id="${asset.assetId}">Sell · ${money(Math.round(equipmentById(asset.id).price * saleRate))}</button>` : ''}</div>`
      }).join('')}</div>` : ''}<div class="equipment-actions"><button class="btn btn-primary" data-action="buy-equipment" data-id="${item.id}">Buy more</button><button class="btn btn-secondary" data-action="rent-dialog" data-id="${item.id}">Rent</button><button class="btn btn-ghost" data-action="lease-dialog" data-id="${item.id}">Lease</button></div><div class="equipment-fineprint">Lease: ${money(leaseTotal)} · 20% down · ${BALANCE.leaseDays} days</div></article>`
    }).join('')}</section>
    <section class="section-block"><div class="section-title"><div><h2>Site provisions</h2><p>Each active project occupies one set. After delivery the set is freed.</p></div>${badge(`${state.projects.length} projects`, 'info')}</div><div class="provision-grid">${PROVISIONS.map((item) => {
      const owned = state.provisions[item.id]
      const needed = state.projects.length
      const enough = owned >= needed
      return `<article class="card provision-card"><div class="provision-icon">${icon(item.id === 'generator' ? 'tech' : item.id === 'hand_tool' ? 'equipment' : 'box')}</div><div><h3>${item.name}</h3><p>${item.description}</p><strong>${money(item.price)}</strong></div><div class="provision-buy">${badge(`${owned} / ${needed} sets`, enough ? 'success' : 'warning')}<button class="btn btn-small btn-secondary" data-action="buy-provision" data-id="${item.id}">${icon('plus')} ${owned ? 'Buy more' : 'Buy'}</button></div></article>`
    }).join('')}</div></section>`
}