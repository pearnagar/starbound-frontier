import type {
  DockId,
  IntersectionId,
  OutpostId,
  PlanetId,
  PlanetProductionNumber,
  SystemId,
} from '../board/space-board'
import type { ShipId, ShipType } from '../buildings/ship'
import type { BuildAction } from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import type { PieceSupply } from '../types/piece-supply'
import type { ResourceInventory, ResourceType } from '../types/resources'

/**
 * Minimal serializable domain events. Every event carries a deterministic
 * `sequence` (assigned by the match, starting at 1) and no timestamps —
 * ordering is the only temporal information the domain records.
 *
 * Hidden information never appears here: Reserve draws record a count, and a
 * theft records the players but not the stolen resource.
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

export type PlanetProducedEvent = Readonly<{
  sequence: number
  type: 'PlanetProduced'
  planetId: PlanetId
  resource: ResourceType
  productionNumber: PlanetProductionNumber
  structureCount: number
  unitCount: number
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

/** Cards drawn from the face-down Reserve pile; contents stay hidden. */
export type ReserveCardsDrawnEvent = Readonly<{
  sequence: number
  type: 'ReserveCardsDrawn'
  playerId: PlayerId
  count: number
}>

export type TurnEndedEvent = Readonly<{
  sequence: number
  type: 'TurnEnded'
  playerId: PlayerId
  turnNumber: number
}>

export type SevenRolledEvent = Readonly<{
  sequence: number
  type: 'SevenRolled'
  playerId: PlayerId
  discardRequirements: readonly Readonly<{ playerId: PlayerId; requiredCount: number }>[]
}>

export type ResourcesDiscardedEvent = Readonly<{
  sequence: number
  type: 'ResourcesDiscarded'
  playerId: PlayerId
  discarded: ResourceInventory
}>

export type ResourceStolenEvent = Readonly<{
  sequence: number
  type: 'ResourceStolen'
  thiefId: PlayerId
  targetId: PlayerId
  /** The stolen resource is intentionally omitted from the public event. */
}>

export type SevenResolvedEvent = Readonly<{
  sequence: number
  type: 'SevenResolved'
  playerId: PlayerId
}>

export type SpaceportBuiltEvent = Readonly<{
  sequence: number
  type: 'SpaceportBuilt'
  playerId: PlayerId
  intersectionId: IntersectionId
}>

export type ShipBuiltEvent = Readonly<{
  sequence: number
  type: 'ShipBuilt'
  playerId: PlayerId
  shipId: ShipId
  shipType: ShipType
  intersectionId: IntersectionId
}>

export type ColonyEstablishedEvent = Readonly<{
  sequence: number
  type: 'ColonyEstablished'
  playerId: PlayerId
  intersectionId: IntersectionId
}>

export type TradeStationEstablishedEvent = Readonly<{
  sequence: number
  type: 'TradeStationEstablished'
  playerId: PlayerId
  outpostId: OutpostId
  dockId: DockId
}>

export type MothershipUpgradedEvent = Readonly<{
  sequence: number
  type: 'MothershipUpgraded'
  playerId: PlayerId
  upgrade: 'cannon' | 'freightPod' | 'booster'
  total: number
}>

export type PlanetarySystemExploredEvent = Readonly<{
  sequence: number
  type: 'PlanetarySystemExplored'
  playerId: PlayerId
  systemId: SystemId
  revealedPlanetIds: readonly PlanetId[]
}>

export type ResourcesSpentEvent = Readonly<{
  sequence: number
  type: 'ResourcesSpent'
  playerId: PlayerId
  action: BuildAction
  spent: ResourceInventory
}>

export type PieceSupplyChangedEvent = Readonly<{
  sequence: number
  type: 'PieceSupplyChanged'
  playerId: PlayerId
  pieceSupply: PieceSupply
}>

export type VictoryPointsChangedEvent = Readonly<{
  sequence: number
  type: 'VictoryPointsChanged'
  playerId: PlayerId
  victoryPoints: number
}>

export type MatchWonEvent = Readonly<{
  sequence: number
  type: 'MatchWon'
  playerId: PlayerId
  victoryPoints: number
}>

export type MatchEvent =
  | TurnStartedEvent
  | DiceRolledEvent
  | PlanetProducedEvent
  | ResourcesGrantedEvent
  | ResourceShortageEvent
  | ProductionResolvedEvent
  | ReserveCardsDrawnEvent
  | TurnEndedEvent
  | SevenRolledEvent
  | ResourcesDiscardedEvent
  | ResourceStolenEvent
  | SevenResolvedEvent
  | SpaceportBuiltEvent
  | ShipBuiltEvent
  | ColonyEstablishedEvent
  | TradeStationEstablishedEvent
  | MothershipUpgradedEvent
  | PlanetarySystemExploredEvent
  | ResourcesSpentEvent
  | PieceSupplyChangedEvent
  | VictoryPointsChangedEvent
  | MatchWonEvent

/** Builds the next event sequence number. */
export function nextEventSequence(currentSequence: number): number {
  return currentSequence + 1
}
