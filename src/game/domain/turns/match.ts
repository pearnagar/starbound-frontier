import type { BoardConfiguration } from '../board/board-configuration'
import type { IntersectionId, SpaceBoard } from '../board/space-board'
import type { Ship, ShipId } from '../buildings/ship'
import type { SiteStructure, Structure, TradeStationStructure } from '../buildings/structure'
import { isSiteStructure, isTradeStation } from '../buildings/structure'
import type { PlayerId } from '../types/ids'
import type { Player } from '../types/player'
import type { MatchEvent } from './match-events'
import type { MatchId } from './match-id'
import type { ReservePile, ResourceSupply } from './resource-bank'
import type { SevenState } from './seven-state'
import type { TurnPhase } from './turn-phase'

export type MatchStatus = 'inProgress' | 'complete'

export type DiceResult = Readonly<{
  die1: number
  die2: number
  total: number
}>

/**
 * Immutable, serializable match state. Every transition in this module returns
 * a new `Match` rather than mutating one in place.
 */
export type Match = Readonly<{
  matchId: MatchId
  board: SpaceBoard
  /** Layout the match was started from, retained for placement lookups. */
  boardConfiguration: BoardConfiguration
  playersById: Readonly<Record<string, Player>>
  playerOrder: readonly PlayerId[]
  activePlayerId: PlayerId
  activePlayerIndex: number
  turnNumber: number
  phase: TurnPhase
  /** Seed for the *next* seeded-random draw. */
  randomState: number
  lastDiceResult?: DiceResult
  /** Colonies and Spaceports, keyed by intersection id. */
  structures: Readonly<Record<string, SiteStructure>>
  /** Trade Stations, keyed by dock id. */
  tradeStations: Readonly<Record<string, TradeStationStructure>>
  /** Ships currently on the board, keyed by ship id. */
  ships: Readonly<Record<string, Ship>>
  /** Face-up Supply players trade with and spend into. */
  supply: ResourceSupply
  /** Face-down Reserve pile; contents are hidden information. */
  reserve: ReservePile
  /** Intersections held by neutral blocking pieces in a 3-player game. */
  neutralBlockedIntersectionIds: readonly IntersectionId[]
  /** Present only while `phase === 'sevenPending'` and work remains. */
  sevenState?: SevenState
  /** Monotonic counter for minting ship ids without a clock or RNG. */
  nextShipNumber: number
  events: readonly MatchEvent[]
  /** Sequence number of the most recently emitted event (0 if none yet). */
  eventSequence: number
  status: MatchStatus
  /** Set once a player reaches the target on their own turn. */
  winnerId?: PlayerId
}>

export function getPlayer(match: Match, playerId: PlayerId): Player | undefined {
  return match.playersById[playerId]
}

export function getActivePlayer(match: Match): Player | undefined {
  return match.playersById[match.activePlayerId]
}

/** Colonies and Spaceports in board order. */
export function listSiteStructures(match: Match): readonly SiteStructure[] {
  return Object.values(match.structures)
}

export function listTradeStations(match: Match): readonly TradeStationStructure[] {
  return Object.values(match.tradeStations)
}

/** Every structure of any kind. */
export function listAllStructures(match: Match): readonly Structure[] {
  return [...listSiteStructures(match), ...listTradeStations(match)]
}

export function listShips(match: Match): readonly Ship[] {
  return Object.values(match.ships)
}

export function getShip(match: Match, shipId: ShipId): Ship | undefined {
  return match.ships[shipId]
}

export function getStructureAt(
  match: Match,
  intersectionId: IntersectionId,
): SiteStructure | undefined {
  return match.structures[intersectionId]
}

export function getShipAt(match: Match, intersectionId: IntersectionId): Ship | undefined {
  return listShips(match).find((ship) => ship.intersectionId === intersectionId)
}

/** Structures owned by a player, of any kind. */
export function listPlayerStructures(match: Match, playerId: PlayerId): readonly Structure[] {
  return listAllStructures(match).filter((structure) => structure.ownerId === playerId)
}

export function listPlayerSiteStructures(
  match: Match,
  playerId: PlayerId,
): readonly SiteStructure[] {
  return listAllStructures(match)
    .filter(isSiteStructure)
    .filter((structure) => structure.ownerId === playerId)
}

export function listPlayerTradeStations(
  match: Match,
  playerId: PlayerId,
): readonly TradeStationStructure[] {
  return listAllStructures(match)
    .filter(isTradeStation)
    .filter((structure) => structure.ownerId === playerId)
}

export function listPlayerShips(match: Match, playerId: PlayerId): readonly Ship[] {
  return listShips(match).filter((ship) => ship.ownerId === playerId)
}

/**
 * Whether an intersection already holds a structure, a ship, or a neutral
 * blocking piece. After movement each intersection may hold only one piece.
 */
export function isIntersectionOccupied(match: Match, intersectionId: IntersectionId): boolean {
  return (
    match.structures[intersectionId] !== undefined ||
    getShipAt(match, intersectionId) !== undefined ||
    match.neutralBlockedIntersectionIds.includes(intersectionId)
  )
}

/** Players in seat order after the active player, wrapping — "starting to the left". */
export function listOpponentsFromLeft(match: Match): readonly PlayerId[] {
  const { playerOrder, activePlayerIndex } = match
  const result: PlayerId[] = []
  for (let offset = 1; offset < playerOrder.length; offset += 1) {
    const id = playerOrder[(activePlayerIndex + offset) % playerOrder.length]
    if (id !== undefined) {
      result.push(id)
    }
  }
  return result
}
