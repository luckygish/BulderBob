import type { GameState } from './types'

export function random(state: GameState): number {
  state.rngSeed = (Math.imul(state.rngSeed, 1_664_525) + 1_013_904_223) >>> 0
  return state.rngSeed / 4_294_967_296
}

export function randomInt(state: GameState, min: number, max: number): number {
  return Math.floor(random(state) * (max - min + 1)) + min
}

export function pick<T>(state: GameState, values: readonly T[]): T {
  return values[Math.floor(random(state) * values.length)]
}

export function nextId(state: GameState, prefix: string): string {
  state.nextId += 1
  return `${prefix}_${state.nextId}`
}
