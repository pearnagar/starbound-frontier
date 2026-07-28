import type { Brand } from './brand'

export type PlayerId = Brand<string, 'PlayerId'>
export type CaptainId = Brand<string, 'CaptainId'>
export type FactionColorId = Brand<string, 'FactionColorId'>

// IDs are always supplied by the caller (see createPlayer) — these are plain
// nominal-typing brand casts, not validating constructors.
export function asPlayerId(value: string): PlayerId {
  return value as PlayerId
}

export function asCaptainId(value: string): CaptainId {
  return value as CaptainId
}

export function asFactionColorId(value: string): FactionColorId {
  return value as FactionColorId
}
