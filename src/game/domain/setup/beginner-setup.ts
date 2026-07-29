import {
  getNeutralBlockedIntersections,
  getStartingPlacement,
  validateBoardConfiguration,
  type BoardConfiguration,
} from '../board/board-configuration'
import { createDefaultBoardConfiguration } from '../board/default-board'
import { asShipId, createShip, type Ship } from '../buildings/ship'
import { createColony, createSpaceport, type SiteStructure } from '../buildings/structure'
import { createSeededRandom } from '../random/seeded-random'
import { SETUP_RESERVE_DRAW_COUNT, STARTING_VICTORY_POINTS } from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import { adjustPieceSupply } from '../types/piece-supply'
import type { Player } from '../types/player'
import { addResourceInventories } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import type { Match } from '../turns/match'
import type { MatchId } from '../turns/match-id'
import { createReservePile, createResourceSupply, drawFromReserve } from '../turns/resource-bank'

/**
 * Beginner setup. Every player starts fully deployed — there is no snake-order
 * placement round, and no starting resources are produced from adjacent
 * planets. Starting positions come entirely from board configuration.
 */

export type CreateBeginnerMatchInput = Readonly<{
  matchId: MatchId
  /**
   * Layout to play on. Omit it to use `createDefaultBoardConfiguration()`.
   * A configuration that *is* supplied is never replaced: if it fails
   * validation the call fails, rather than silently falling back.
   */
  configuration?: BoardConfiguration
  /** Players in seat order. Each seat must have a configured placement. */
  players: readonly Player[]
  /** Seed for the Reserve shuffle, setup draws, and later dice. */
  seed: number
  /** Optional per-player opening dice totals; highest goes first. */
  startingRolls?: Readonly<Record<string, number>>
}>

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

/**
 * Rolls two dice per player and returns the seat order starting with the
 * highest roller. Ties are broken by seat index, which keeps the result
 * deterministic without re-rolling.
 */
export function determineStartingPlayer(
  players: readonly Player[],
  randomState: number,
): {
  orderedPlayerIds: readonly PlayerId[]
  rolls: Readonly<Record<string, number>>
  nextRandomState: number
} {
  const random = createSeededRandom(randomState)
  const rolls: Record<string, number> = {}
  for (const player of players) {
    rolls[player.id] = random.nextInt(6) + 1 + (random.nextInt(6) + 1)
  }
  const ordered = [...players].sort((left, right) => {
    const difference = (rolls[right.id] ?? 0) - (rolls[left.id] ?? 0)
    return difference !== 0 ? difference : left.seatIndex - right.seatIndex
  })
  return {
    orderedPlayerIds: ordered.map((player) => player.id),
    rolls,
    nextRandomState: random.nextUint32(),
  }
}

/** Seat order beginning with the highest supplied roll, ties by seat index. */
function orderFromSuppliedRolls(
  players: readonly Player[],
  rolls: Readonly<Record<string, number>>,
): readonly PlayerId[] {
  return [...players]
    .sort((left, right) => {
      const difference = (rolls[right.id] ?? 0) - (rolls[left.id] ?? 0)
      return difference !== 0 ? difference : left.seatIndex - right.seatIndex
    })
    .map((player) => player.id)
}

/**
 * Builds a ready-to-play match. Each player receives 2 Colonies, 1 Spaceport,
 * 1 Colony Ship, 4 victory points, 3 hidden Reserve cards, 1 Fame Medal piece,
 * and 1 Booster. Pieces used on the board are deducted from the personal
 * supply, including the Shipyard consumed by the starting Spaceport.
 */
export function createBeginnerMatch(input: CreateBeginnerMatchInput): DomainResult<Match> {
  const { players } = input
  // A supplied configuration is used as-is and validated below; only an omitted
  // one falls back to the default. An invalid custom board is never replaced.
  const configuration = input.configuration ?? createDefaultBoardConfiguration()

  if (players.length < 3 || players.length > 4) {
    return failure('INVALID_PLAYER_COUNT', 'A match requires 3 or 4 players.', 'players')
  }

  const configurationResult = validateBoardConfiguration(configuration)
  if (!configurationResult.success) {
    return configurationResult
  }

  const seatIndexes = new Set(players.map((player) => player.seatIndex))
  if (seatIndexes.size !== players.length) {
    return failure('DUPLICATE_SEAT_INDEX', 'Every player needs a distinct seat index.', 'players')
  }

  for (const player of players) {
    if (getStartingPlacement(configuration, player.seatIndex) === undefined) {
      return failure(
        'MISSING_STARTING_PLACEMENT',
        `Board configuration has no placement for seat ${String(player.seatIndex)}.`,
        'configuration',
      )
    }
  }

  // Reserve pile first, so setup draws and later dice all advance one chain.
  const reserveResult = createReservePile(input.seed)
  let randomState = reserveResult.nextRandomState
  let reserve = reserveResult.pile

  const structures: Record<string, SiteStructure> = {}
  const ships: Record<string, Ship> = {}
  const playersById: Record<string, Player> = {}
  let shipNumber = 1

  for (const player of players) {
    const placement = getStartingPlacement(configuration, player.seatIndex)
    if (placement === undefined) {
      return failure(
        'MISSING_STARTING_PLACEMENT',
        `Board configuration has no placement for seat ${String(player.seatIndex)}.`,
        'configuration',
      )
    }

    for (const intersectionId of placement.colonyIntersectionIds) {
      if (structures[intersectionId] !== undefined) {
        return failure(
          'DUPLICATE_STARTING_PLACEMENT',
          `Two seats start on intersection "${intersectionId}".`,
          'configuration',
        )
      }
      structures[intersectionId] = createColony(intersectionId, player.id)
    }

    const spaceportId = placement.spaceportIntersectionId
    if (structures[spaceportId] !== undefined) {
      return failure(
        'DUPLICATE_STARTING_PLACEMENT',
        `Two seats start on intersection "${spaceportId}".`,
        'configuration',
      )
    }
    structures[spaceportId] = createSpaceport(spaceportId, player.id)

    const shipId = asShipId(`${input.matchId}-ship-${String(shipNumber)}`)
    shipNumber += 1
    ships[shipId] = createShip(
      shipId,
      'colonyShip',
      player.id,
      placement.colonyShipIntersectionId,
      false,
    )

    const draw = drawFromReserve(reserve, SETUP_RESERVE_DRAW_COUNT, randomState)
    reserve = draw.pile
    randomState = draw.nextRandomState

    // Board deployment: 2 Colonies placed, 1 Colony under the Spaceport, the
    // Shipyard that forms it, and the Transport Ship carrying the Colony Ship
    // (whose Colony piece is also committed).
    playersById[player.id] = {
      ...player,
      resources: addResourceInventories(player.resources, draw.inventory),
      pieceSupply: adjustPieceSupply(player.pieceSupply, {
        colonies: -4,
        shipyards: -1,
        transportShips: -1,
      }),
      victoryPoints: STARTING_VICTORY_POINTS,
    }
  }

  const startingRolls = input.startingRolls
  let playerOrder: readonly PlayerId[]
  if (startingRolls === undefined) {
    const determined = determineStartingPlayer(players, randomState)
    playerOrder = determined.orderedPlayerIds
    randomState = determined.nextRandomState
  } else {
    playerOrder = orderFromSuppliedRolls(players, startingRolls)
  }

  const firstPlayerId = playerOrder[0]
  if (firstPlayerId === undefined) {
    return failure('INVALID_PLAYER_ORDER', 'No starting player could be determined.', 'players')
  }

  return {
    success: true,
    value: {
      matchId: input.matchId,
      board: configuration.board,
      boardConfiguration: configuration,
      playersById,
      playerOrder,
      activePlayerId: firstPlayerId,
      activePlayerIndex: 0,
      turnNumber: 1,
      phase: 'startTurn',
      randomState,
      structures,
      tradeStations: {},
      ships,
      supply: createResourceSupply(),
      reserve,
      neutralBlockedIntersectionIds: getNeutralBlockedIntersections(configuration, players.length),
      nextShipNumber: shipNumber,
      events: [],
      eventSequence: 0,
      status: 'inProgress',
    },
  }
}
