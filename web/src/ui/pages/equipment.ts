import { BALANCE } from '../../game/balance'
import { EQUIPMENT, PROVISIONS, buildingById, equipmentById } from '../../game/catalog'
import { badge, money, pageHeading } from '../components'
import { icon } from '../icons'
import type { ViewContext } from '../types'

export function renderEquipment(ctx: ViewContext): string {
  const { state } = ctx
  const saleRate = state.research.dealer_network?.status === 'done' ? 0.8 : 0.7
  return `${pageHeading('Активы компании', 'Техника и обеспечение', 'Формируйте парк под несколько объектов: каждая единица назначается отдельно.', badge(`${state.equipment.length} ед. техники`, 'info'))}
    <div class="notice notice-info">${icon('clock')}<div><strong>Аренда расходуется только на объекте</strong><span>Простаивающая техника не теряет оплаченные часы. Своя и лизинговая техника требует обслуживания 0.1% стоимости в день.</span></div></div>
    <section class="equipment-grid">${EQUIPMENT.map((item) => {
      const assets = state.equipment.filter((entry) => entry.id === item.id)
      const leaseTotal = Math.round(item.price * (1 + BALANCE.leaseInterest))
      return `<article class="card equipment-card"><div class="equipment-card-top"><div class="equipment-illustration">${icon(item.id === 'mixer' ? 'box' : item.id === 'crane' ? 'crane' : 'equipment')}</div>${assets.length ? badge(`В парке · ${assets.length}`, 'success') : badge('Доступна', 'neutral')}</div><h2>${item.name}</h2><p>${item.description}</p><div class="equipment-price"><strong>${money(item.price)}</strong><span>${money(item.rentPerHour)} / раб. ч</span></div>${assets.length ? `<div class="asset-list">${assets.map((asset, index) => {
        const project = state.projects.find((entry) => entry.id === asset.projectId)
        const status = asset.status === 'owned' ? 'Собственная' : asset.status === 'leased' ? `Лизинг · остаток ${money(asset.leaseRemaining)}` : `Аренда · ${asset.hoursRemaining} ч`
        return `<div class="asset-status"><span>${icon(asset.projectId ? 'construction' : 'check')} №${index + 1} · ${status}</span><span>${project ? buildingById(project.job.building).name : 'Свободна'}</span>${asset.status === 'owned' ? `<button class="btn btn-small btn-ghost" data-action="sell-dialog" data-id="${asset.assetId}">Продать · ${money(Math.round(equipmentById(asset.id).price * saleRate))}</button>` : ''}</div>`
      }).join('')}</div>` : ''}<div class="equipment-actions"><button class="btn btn-primary" data-action="buy-equipment" data-id="${item.id}">Купить ещё</button><button class="btn btn-secondary" data-action="rent-dialog" data-id="${item.id}">Аренда</button><button class="btn btn-ghost" data-action="lease-dialog" data-id="${item.id}">Лизинг</button></div><div class="equipment-fineprint">Лизинг: ${money(leaseTotal)} · взнос 20% · ${BALANCE.leaseDays} дней</div></article>`
    }).join('')}</section>
    <section class="section-block"><div class="section-title"><div><h2>Обеспечение площадки</h2><p>Каждый активный объект занимает один комплект. После сдачи комплект освобождается.</p></div>${badge(`${state.projects.length} объектов`, 'info')}</div><div class="provision-grid">${PROVISIONS.map((item) => {
      const owned = state.provisions[item.id]
      const needed = state.projects.length
      const enough = owned >= needed
      return `<article class="card provision-card"><div class="provision-icon">${icon(item.id === 'generator' ? 'tech' : item.id === 'hand_tool' ? 'equipment' : 'box')}</div><div><h3>${item.name}</h3><p>${item.description}</p><strong>${money(item.price)}</strong></div><div class="provision-buy">${badge(`${owned} / ${needed} компл.`, enough ? 'success' : 'warning')}<button class="btn btn-small btn-secondary" data-action="buy-provision" data-id="${item.id}">${icon('plus')} ${owned ? 'Докупить' : 'Купить'}</button></div></article>`
    }).join('')}</div></section>`
}
