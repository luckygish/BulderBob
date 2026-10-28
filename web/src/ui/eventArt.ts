import wife from '../../assets/wife.jpeg'
import traider from '../../assets/traider.png'
import worker from '../../assets/worker.png'
import inspect from '../../assets/inspect.png'
import clients from '../../assets/clients.png'
import happyman from '../../assets/happyman.png'

const MAP: Record<string, string> = {
  mortgage: wife,
  tax_audit: wife,
  theft: traider,
  salesman_poach: traider,
  loader_breakdown: traider,
  warehouse_rent: traider,
  migration: worker,
  wet_lumber: worker,
  bad_concrete: worker,
  power_outage: worker,
  inspector_visit: inspect,
  fire_inspection: inspect,
  neighbors_noise: clients,
  broken_window: clients,
  subbotnik: happyman,
  park_sponsorship: happyman,
}

export function eventPortrait(eventId: string): string {
  return MAP[eventId] ?? worker
}