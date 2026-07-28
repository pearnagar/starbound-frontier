import type { SetupState } from '../setup/setup-state'
import type { Board } from '../board/board'
import { createStructure, type Structure } from '../buildings/structure'
import type { Player } from '../types/player'
import { RESOURCE_TYPES, type ResourceInventory } from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { createResourceBank, deductFromBank, type ResourceBank } from './resource-bank'
import type { Match } from './match'
import type { MatchId } from './match-id'

export type CreateMatchFromCompletedSetupInput = Readonly<{
  matchId: MatchId
  board: Board
  /** Players keyed by id, as they existed before setup grants are applied. */
  players: Readonly<Record<string, Player>>
  setup: SetupState
  /**
   * Optional per-player resource grants earned during setup (from
   * `placeSetupRoute`'s `SetupResourceGrant`), applied here as the match's own
   * starting-resource step. Multiple grants for the same player are summed.
   */
  setupResourceGrants?: readonly Readonly<{ playerId: string; resources: ResourceInventory }>[]
  /** Initial bank quantity per resource; see resource-bank.ts for the default. */
  initialBankQuantityPerResource?: number
  /** Seed for the match's seeded-random sequence (dice, etc.). Supplied by the caller. */
  randomSeed: number
}>

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

const OUTPOSTS_PLACED_DURING_SETUP = 2
const ROUTES_PLACED_DURING_SETUP = 2

export function createMatchFromCompletedSetup(
  input: CreateMatchFromCompletedSetupInput,
): DomainResult<Match> {
  const { matchId, board, players, setup } = input

  if (!setup.complete) {
    return failure('SETUP_NOT_COMPLETE', 'Setup has not finished.', 'setup')
  }

  if (setup.playerOrder.length < 2) {
    return failure('TOO_FEW_PLAYERS', 'A match needs at least two players.', 'setup')
  }
  if (new Set(setup.playerOrder).size !== setup.playerOrder.length) {
    return failure('INVALID_PLAYER_ORDER', 'Each player may appear only once.', 'setup')
  }

  for (const playerId of setup.playerOrder) {
    if (players[playerId] === undefined) {
      return failure('MISSING_PLAYER', `No player record found for "${playerId}".`, 'players')
    }
  }

  // Every seat must have placed exactly two outpost+route pairs.
  for (const playerId of setup.playerOrder) {
    const completedPairs = setup.completedPairsByPlayer[playerId] ?? 0
    if (completedPairs !== OUTPOSTS_PLACED_DURING_SETUP) {
      return failure(
        'INCONSISTENT_SETUP',
        `Player "${playerId}" did not complete exactly two setup pairs.`,
        'setup',
      )
    }
  }

  const outpostCountByPlayer = new Map<string, number>()
  for (const outpost of Object.values(setup.outposts)) {
    outpostCountByPlayer.set(outpost.ownerId, (outpostCountByPlayer.get(outpost.ownerId) ?? 0) + 1)
  }
  const routeCountByPlayer = new Map<string, number>()
  for (const route of Object.values(setup.routes)) {
    routeCountByPlayer.set(route.ownerId, (routeCountByPlayer.get(route.ownerId) ?? 0) + 1)
  }
  for (const playerId of setup.playerOrder) {
    if ((outpostCountByPlayer.get(playerId) ?? 0) !== OUTPOSTS_PLACED_DURING_SETUP) {
      return failure(
        'INCONSISTENT_SETUP',
        `Player "${playerId}" does not have exactly two placed outposts.`,
        'setup',
      )
    }
    if ((routeCountByPlayer.get(playerId) ?? 0) !== ROUTES_PLACED_DURING_SETUP) {
      return failure(
        'INCONSISTENT_SETUP',
        `Player "${playerId}" does not have exactly two placed routes.`,
        'setup',
      )
    }
  }

  // Apply setup resource grants and piece-supply deductions without mutating
  // the input `players` record.
  const grantsByPlayer = new Map<string, ResourceInventory>()
  for (const grant of input.setupResourceGrants ?? []) {
    const existing = grantsByPlayer.get(grant.playerId)
    if (existing === undefined) {
      grantsByPlayer.set(grant.playerId, grant.resources)
    } else {
      const merged: Record<string, number> = { ...existing }
      for (const type of RESOURCE_TYPES) {
        merged[type] = (merged[type] ?? 0) + grant.resources[type]
      }
      grantsByPlayer.set(grant.playerId, merged as ResourceInventory)
    }
  }

  const playersById: Record<string, Player> = {}
  for (const [playerId, player] of Object.entries(players)) {
    if (
      !Number.isInteger(player.pieceSupply.outposts) ||
      player.pieceSupply.outposts < OUTPOSTS_PLACED_DURING_SETUP ||
      !Number.isInteger(player.pieceSupply.tradeRoutes) ||
      player.pieceSupply.tradeRoutes < ROUTES_PLACED_DURING_SETUP
    ) {
      return failure(
        'INSUFFICIENT_PIECE_SUPPLY',
        `Player "${playerId}" does not have enough unplaced pieces for setup.`,
        'players',
      )
    }

    const grant = grantsByPlayer.get(playerId)
    const resources: Record<string, number> = { ...player.resources }
    if (grant !== undefined) {
      for (const type of RESOURCE_TYPES) {
        resources[type] = (resources[type] ?? 0) + grant[type]
      }
    }

    playersById[playerId] = {
      ...player,
      resources: resources as ResourceInventory,
      pieceSupply: {
        ...player.pieceSupply,
        outposts: player.pieceSupply.outposts - OUTPOSTS_PLACED_DURING_SETUP,
        tradeRoutes: player.pieceSupply.tradeRoutes - ROUTES_PLACED_DURING_SETUP,
      },
    }
  }

  let bank: ResourceBank = createResourceBank(input.initialBankQuantityPerResource)
  for (const resources of grantsByPlayer.values()) {
    if (!isValidGrant(resources)) {
      return failure(
        'INVALID_RESOURCE_QUANTITY',
        'A setup resource grant is invalid.',
        'setupResourceGrants',
      )
    }
    for (const type of RESOURCE_TYPES) {
      if (bank.quantities[type] < resources[type]) {
        return failure(
          'INSUFFICIENT_BANK_SUPPLY',
          `The bank does not have enough "${type}" to cover setup grants.`,
          'setupResourceGrants',
        )
      }
    }
    bank = deductFromBank(bank, resources)
  }

  const firstPlayerId = setup.playerOrder[0]
  if (firstPlayerId === undefined) {
    return failure('TOO_FEW_PLAYERS', 'A match needs at least two players.', 'setup')
  }

  const structures: Record<string, Structure> = {}
  for (const [vertexId, outpost] of Object.entries(setup.outposts)) {
    structures[vertexId] = createStructure('outpost', outpost.vertexId, outpost.ownerId)
  }

  return {
    success: true,
    value: {
      matchId,
      board,
      playersById,
      playerOrder: [...setup.playerOrder],
      activePlayerId: firstPlayerId,
      activePlayerIndex: 0,
      turnNumber: 1,
      phase: 'startTurn',
      randomState: input.randomSeed,
      structures,
      routes: { ...setup.routes },
      bank,
      // The Void Marauder starts on the central star (always at the board
      // origin) — see docs/DECISIONS.md.
      marauderCoordinate: { q: 0, r: 0 },
      events: [],
      eventSequence: 0,
      status: 'inProgress',
    },
  }
}

function isValidGrant(resources: ResourceInventory): boolean {
  return RESOURCE_TYPES.every((type) => Number.isInteger(resources[type]) && resources[type] >= 0)
}
