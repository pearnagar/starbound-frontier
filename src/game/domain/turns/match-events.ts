import type { ProductionNumber } from '../board/production-number'
import type { HexCoordinate } from '../board/hex-coordinate'
import type { PlayerId } from '../types/ids'
import type { ResourceInventory, ResourceType } from '../types/resources'

/**
 * Minimal serializable domain events. Every event carries a deterministic
 * `sequence` (assigned by the match, starting at 1) and no timestamps —
 * ordering is the only temporal information the domain records.
 */

export type TurnStartedEvent = Readonly<{
  sequence: number
  type: 'TurnStarted'
  playerId: PlayerId
  turnNumber: number
}>

export type DiceRolledEvent = Readonly<{
  sequence: number
  type: 'DiceRolled'
  playerId: PlayerId
  die1: number
  die2: number
  total: number
}>

export type SectorProducedEvent = Readonly<{
  sequence: number
  type: 'SectorProduced'
  coordinate: HexCoordinate
  resource: ResourceType
  productionNumber: ProductionNumber
  outpostCount: number
}>

export type ResourcesGrantedEvent = Readonly<{
  sequence: number
  type: 'ResourcesGranted'
  playerId: PlayerId
  resources: ResourceInventory
}>

export type ResourceShortageEvent = Readonly<{
  sequence: number
  type: 'ResourceShortage'
  resource: ResourceType
  demanded: number
  available: number
}>

export type ProductionResolvedEvent = Readonly<{
  sequence: number
  type: 'ProductionResolved'
  total: number
}>

export type TurnEndedEvent = Readonly<{
  sequence: number
  type: 'TurnEnded'
  playerId: PlayerId
  turnNumber: number
}>

export type MatchEvent =
  | TurnStartedEvent
  | DiceRolledEvent
  | SectorProducedEvent
  | ResourcesGrantedEvent
  | ResourceShortageEvent
  | ProductionResolvedEvent
  | TurnEndedEvent

/** Builds the next event and the sequence number that follows it. */
export function nextEventSequence(currentSequence: number): number {
  return currentSequence + 1
}
