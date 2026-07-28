import { describe, expect, it } from 'vitest'
import { SETUP_RESERVE_DRAW_COUNT, STARTING_VICTORY_POINTS } from '../rules/rules-config'
import { createInitialPieceSupply } from '../types/piece-supply'
import { getTotalResourceCount } from '../types/resources'
import { listPlayerShips, listPlayerSiteStructures, listSiteStructures } from '../turns/match'
import { getReserveCount } from '../turns/resource-bank'
import {
  createTestMatch,
  createThreeSeatBoardConfiguration,
  makeTestPlayers,
  TEST_MATCH_ID,
} from '../turns/test-fixtures'
import { createBeginnerMatch, determineStartingPlayer } from './beginner-setup'

describe('beginner setup inventory', () => {
  const match = createTestMatch()

  it('gives every player exactly 2 Colonies and 1 Spaceport', () => {
    for (const playerId of match.playerOrder) {
      const structures = listPlayerSiteStructures(match, playerId)
      expect(structures.filter((structure) => structure.type === 'colony')).toHaveLength(2)
      expect(structures.filter((structure) => structure.type === 'spaceport')).toHaveLength(1)
    }
  })

  it('gives every player exactly 1 Colony Ship on their configured site', () => {
    const configuration = createThreeSeatBoardConfiguration()
    for (const placement of configuration.startingPlacements) {
      const playerId = match.playerOrder.find(
        (id) => match.playersById[id]?.seatIndex === placement.seatIndex,
      )
      expect(playerId).toBeDefined()
      const ships = listPlayerShips(match, playerId!)
      expect(ships).toHaveLength(1)
      expect(ships[0]?.type).toBe('colonyShip')
      expect(ships[0]?.intersectionId).toBe(placement.colonyShipIntersectionId)
    }
  })

  it('starts every player at 4 victory points', () => {
    for (const playerId of match.playerOrder) {
      expect(match.playersById[playerId]?.victoryPoints).toBe(STARTING_VICTORY_POINTS)
      expect(match.playersById[playerId]?.victoryPoints).toBe(4)
    }
  })

  it('deals every player 3 hidden cards from the Reserve pile', () => {
    for (const playerId of match.playerOrder) {
      const player = match.playersById[playerId]
      expect(getTotalResourceCount(player!.resources)).toBe(SETUP_RESERVE_DRAW_COUNT)
      expect(getTotalResourceCount(player!.resources)).toBe(3)
    }
  })

  it('draws those cards out of the Reserve pile', () => {
    // 5 resource types x 8 cards = 40, less 3 per player.
    expect(getReserveCount(match.reserve)).toBe(40 - 3 * match.playerOrder.length)
  })

  it('gives every player 1 Booster, 0 Cannons, 0 Freight Pods, and 1 Fame Medal piece', () => {
    for (const playerId of match.playerOrder) {
      const mothership = match.playersById[playerId]?.mothership
      expect(mothership).toEqual({
        boosters: 1,
        cannons: 0,
        freightPods: 0,
        fameMedalPieces: 1,
      })
    }
  })

  it('deducts deployed pieces from each personal supply', () => {
    const initial = createInitialPieceSupply()
    for (const playerId of match.playerOrder) {
      const supply = match.playersById[playerId]?.pieceSupply
      // 2 placed Colonies, 1 Colony under the Spaceport, 1 carried by the
      // Colony Ship; plus the Shipyard forming the Spaceport and the
      // Transport Ship carrying the Colony Ship.
      expect(supply?.colonies).toBe(initial.colonies - 4)
      expect(supply?.shipyards).toBe(initial.shipyards - 1)
      expect(supply?.transportShips).toBe(initial.transportShips - 1)
      expect(supply?.tradeStations).toBe(initial.tradeStations)
    }
  })

  it('starts in the Production phase of turn 1', () => {
    expect(match.phase).toBe('startTurn')
    expect(match.turnNumber).toBe(1)
    expect(match.status).toBe('inProgress')
  })

  it('produces no starting resources from adjacent planets', () => {
    // Every card a player holds came from the Reserve draw, never production.
    for (const playerId of match.playerOrder) {
      expect(getTotalResourceCount(match.playersById[playerId]!.resources)).toBe(3)
    }
  })

  it('places neutral blocking pieces for a 3-player game', () => {
    expect(match.neutralBlockedIntersectionIds).toHaveLength(1)
  })

  it('places every structure on the board exactly once', () => {
    const structures = listSiteStructures(match)
    expect(structures).toHaveLength(9)
    expect(new Set(structures.map((structure) => structure.intersectionId)).size).toBe(9)
  })
})

describe('starting player', () => {
  it('seats the highest roller first', () => {
    const match = createTestMatch()
    // player-0 rolled 11, the highest of the supplied rolls.
    expect(match.activePlayerId).toBe('player-0')
    expect(match.activePlayerIndex).toBe(0)
    expect(match.playerOrder).toEqual(['player-0', 'player-1', 'player-2'])
  })

  it('orders players by highest two-die roll when rolling', () => {
    const players = makeTestPlayers(4)
    const result = determineStartingPlayer(players, 4242)

    expect(result.orderedPlayerIds).toHaveLength(4)
    const rolls = result.orderedPlayerIds.map((id) => result.rolls[id] ?? 0)
    for (let index = 1; index < rolls.length; index += 1) {
      expect(rolls[index - 1]!).toBeGreaterThanOrEqual(rolls[index]!)
    }
  })

  it('produces two-dice totals between 2 and 12', () => {
    for (const total of Object.values(determineStartingPlayer(makeTestPlayers(4), 777).rolls)) {
      expect(total).toBeGreaterThanOrEqual(2)
      expect(total).toBeLessThanOrEqual(12)
    }
  })

  it('is deterministic for a given seed', () => {
    const players = makeTestPlayers(4)
    expect(determineStartingPlayer(players, 31337).orderedPlayerIds).toEqual(
      determineStartingPlayer(players, 31337).orderedPlayerIds,
    )
  })
})

describe('beginner setup validation', () => {
  it('rejects a player count below 3', () => {
    const result = createBeginnerMatch({
      matchId: TEST_MATCH_ID,
      configuration: createThreeSeatBoardConfiguration(),
      players: makeTestPlayers(2),
      seed: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('INVALID_PLAYER_COUNT')
    }
  })

  it('rejects a seat with no configured placement rather than inventing one', () => {
    const configuration = createThreeSeatBoardConfiguration()
    const result = createBeginnerMatch({
      matchId: TEST_MATCH_ID,
      configuration: {
        ...configuration,
        startingPlacements: configuration.startingPlacements.slice(0, 2),
      },
      players: makeTestPlayers(3),
      seed: 1,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('MISSING_STARTING_PLACEMENT')
    }
  })

  it('is fully deterministic for a given seed', () => {
    expect(createTestMatch(555)).toEqual(createTestMatch(555))
  })
})
