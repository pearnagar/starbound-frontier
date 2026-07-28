import { describe, expect, it } from 'vitest'
import { asMatchId } from './match-id'
import { createMatchFromCompletedSetup } from './match-initialization'
import { allVisible, baseBoard, makePlayer, p1, p2, playFullSetup } from './test-fixtures'

const matchId = asMatchId('match-1')

function baseInput() {
  const board = allVisible(baseBoard())
  const { setup, grants } = playFullSetup(board)
  const players = {
    [p1]: makePlayer(p1, 0),
    [p2]: makePlayer(p2, 1),
  }
  return { board, setup, grants, players }
}

describe('createMatchFromCompletedSetup', () => {
  it('creates a valid match from completed setup', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 42,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.matchId).toBe(matchId)
    expect(result.value.status).toBe('inProgress')
    expect(result.value.turnNumber).toBe(1)
    expect(result.value.phase).toBe('startTurn')
    expect(result.value.activePlayerId).toBe(setup.playerOrder[0])
    expect(result.value.activePlayerIndex).toBe(0)
    expect(result.value.playerOrder).toEqual(setup.playerOrder)
  })

  it('rejects incomplete setup', () => {
    const { board, setup, players } = baseInput()
    const incomplete = { ...setup, complete: false }
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup: incomplete,
      randomSeed: 1,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('SETUP_NOT_COMPLETE')
  })

  it('rejects setup missing a player record', () => {
    const { board, setup, players } = baseInput()
    const rest: Record<string, (typeof players)[string]> = {}
    for (const [id, player] of Object.entries(players)) {
      if (id !== p2) {
        rest[id] = player
      }
    }
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players: rest,
      setup,
      randomSeed: 1,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('MISSING_PLAYER')
  })

  it('rejects setup that is inconsistent (wrong pair count)', () => {
    const { board, setup, players } = baseInput()
    const inconsistent = {
      ...setup,
      completedPairsByPlayer: { ...setup.completedPairsByPlayer, [p1]: 1 },
    }
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup: inconsistent,
      randomSeed: 1,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INCONSISTENT_SETUP')
  })

  it('rejects insufficient setup piece supply', () => {
    const { board, setup, players } = baseInput()
    const player1 = players[p1]
    if (player1 === undefined) throw new Error('expected player1 fixture')
    const depleted = {
      ...players,
      [p1]: { ...player1, pieceSupply: { ...player1.pieceSupply, outposts: 1 } },
    }
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players: depleted,
      setup,
      randomSeed: 1,
    })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_PIECE_SUPPLY')
  })

  it('preserves player order', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.playerOrder).toEqual(setup.playerOrder)
  })

  it('applies setup resource grants to the right players', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    for (const grant of grants) {
      const player = result.value.playersById[grant.playerId]
      expect(player).toBeDefined()
    }
    // Total resources granted across all players equals the sum of grants.
    const totalGranted = grants.reduce((sum, grant) => {
      return sum + Object.values(grant.resources).reduce((s, n) => s + n, 0)
    }, 0)
    const totalHeld = Object.values(result.value.playersById).reduce(
      (sum, player) => sum + Object.values(player.resources).reduce((s, n) => s + n, 0),
      0,
    )
    expect(totalHeld).toBe(totalGranted)
  })

  it('deducts 2 outposts and 2 trade routes from each player piece supply', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    for (const id of [p1, p2]) {
      const before = players[id]
      const after = result.value.playersById[id]
      expect(before).toBeDefined()
      expect(after).toBeDefined()
      if (before === undefined || after === undefined) continue
      expect(after.pieceSupply.outposts).toBe(before.pieceSupply.outposts - 2)
      expect(after.pieceSupply.tradeRoutes).toBe(before.pieceSupply.tradeRoutes - 2)
    }
  })

  it('preserves setup structures and routes', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.outposts).toEqual(setup.outposts)
    expect(result.value.routes).toEqual(setup.routes)
  })

  it('starts with the first player on turn 1', () => {
    const { board, setup, grants, players } = baseInput()
    const result = createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value.turnNumber).toBe(1)
    expect(result.value.activePlayerId).toBe(setup.playerOrder[0])
  })

  it('leaves all inputs unchanged', () => {
    const { board, setup, grants, players } = baseInput()
    const boardSnapshot = JSON.stringify(board)
    const setupSnapshot = JSON.stringify(setup)
    const playersSnapshot = JSON.stringify(players)

    createMatchFromCompletedSetup({
      matchId,
      board,
      players,
      setup,
      setupResourceGrants: grants,
      randomSeed: 1,
    })

    expect(JSON.stringify(board)).toBe(boardSnapshot)
    expect(JSON.stringify(setup)).toBe(setupSnapshot)
    expect(JSON.stringify(players)).toBe(playersSnapshot)
  })
})
