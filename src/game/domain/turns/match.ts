import type { Board } from '../board/board'
import type { Outpost } from '../buildings/outpost'
import type { TradeRoute } from '../routes/trade-route'
import type { PlayerId } from '../types/ids'
import type { Player } from '../types/player'
import type { MatchEvent } from './match-events'
import type { MatchId } from './match-id'
import type { ResourceBank } from './resource-bank'
import type { TurnPhase } from './turn-phase'

export type MatchStatus = 'inProgress' | 'complete'

export type DiceResult = Readonly<{
  die1: number
  die2: number
  total: number
}>

/**
 * Immutable, serializable match state. Every transition in this module
 * returns a new `Match` rather than mutating one in place.
 */
export type Match = Readonly<{
  matchId: MatchId
  board: Board
  playersById: Readonly<Record<string, Player>>
  playerOrder: readonly PlayerId[]
  activePlayerId: PlayerId
  activePlayerIndex: number
  turnNumber: number
  phase: TurnPhase
  /** Seed for the *next* seeded-random draw (e.g. dice). */
  randomState: number
  lastDiceResult?: DiceResult
  outposts: Readonly<Record<string, Outpost>>
  routes: Readonly<Record<string, TradeRoute>>
  bank: ResourceBank
  events: readonly MatchEvent[]
  /** Sequence number of the most recently emitted event (0 if none yet). */
  eventSequence: number
  status: MatchStatus
}>

export function getPlayer(match: Match, playerId: PlayerId): Player | undefined {
  return match.playersById[playerId]
}

export function getActivePlayer(match: Match): Player | undefined {
  return match.playersById[match.activePlayerId]
}

export function listMatchOutposts(match: Match): readonly Outpost[] {
  return Object.values(match.outposts)
}

export function listMatchRoutes(match: Match): readonly TradeRoute[] {
  return Object.values(match.routes)
}
