import wife from '../../assets/wife.jpeg'
import traider from '../../assets/traider.png'
import worker from '../../assets/worker.png'
import inspect from '../../assets/inspect.png'
import clients from '../../assets/clients.png'
import happyman from '../../assets/happyman.png'
import { EVENT_ART } from './eventArtMap'

const IMAGES: Record<string, string> = {
  wife,
  traider,
  worker,
  inspect,
  clients,
  happyman,
}

const MAP: Record<string, string> = Object.fromEntries(
  Object.entries(EVENT_ART).map(([id, key]) => [id, IMAGES[key]]),
)

export function eventPortrait(eventId: string): string {
  return MAP[eventId] ?? worker
}