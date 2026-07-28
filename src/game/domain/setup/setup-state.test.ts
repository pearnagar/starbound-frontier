import { describe, expect, it } from 'vitest'
import { asPlayerId } from '../types/ids'
import {
  createInitialSetupState,
  getActiveSetupPlayer,
  getCompletedSetupPairs,
  getSetupPlacementOrder,
  isSetupComplete,
  SETUP_PAIRS_PER_PLAYER,
} from './setup-state'

const p1 = asPlayerId('p1')
const p2 = asPlayerId('p2')
const p3 = asPlayerId('p3')
const p4 = asPlayerId('p4')

describe('getSetupPlacementOrder', () => {
  it('snakes for two players', () => {
    expect(getSetupPlacementOrder([p1, p2])).toEqual([p1, p2, p2, p1])
  })

  it('snakes for three players', () => {
    expect(getSetupPlacementOrder([p1, p2, p3])).toEqual([p1, p2, p3, p3, p2, p1])
  })

  it('snakes for four players', () => {
    expect(getSetupPlacementOrder([p1, p2, p3, p4])).toEqual([p1, p2, p3, p4, p4, p3, p2, p1])
  })

  it.each([[[p1, p2]], [[p1, p2, p3]], [[p1, p2, p3, p4]]])(
    'gives every player exactly two setup turns',
    (players) => {
      const order = getSetupPlacementOrder(players)
      expect(order).toHaveLength(players.length * SETUP_PAIRS_PER_PLAYER)
      for (const player of players) {
        expect(order.filter((entry) => entry === player)).toHaveLength(SETUP_PAIRS_PER_PLAYER)
      }
    },
  )

  it('does not mutate the seat order', () => {
    const seats = [p1, p2, p3]
    getSetupPlacementOrder(seats)
    expect(seats).toEqual([p1, p2, p3])
  })
})

describe('createInitialSetupState', () => {
  it('starts on the first player expecting an outpost', () => {
    const result = createInitialSetupState([p1, p2, p3])
    expect(result.success).toBe(true)
    if (!result.success) return
    const state = result.value
    expect(getActiveSetupPlayer(state)).toBe(p1)
    expect(state.expects).toBe('outpost')
    expect(state.stepIndex).toBe(0)
    expect(state.pendingOutpostVertexId).toBeUndefined()
    expect(isSetupComplete(state)).toBe(false)
  })

  it('starts every player on zero completed pairs and an empty board', () => {
    const result = createInitialSetupState([p1, p2])
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(getCompletedSetupPairs(result.value, p1)).toBe(0)
    expect(getCompletedSetupPairs(result.value, p2)).toBe(0)
    expect(result.value.outposts).toEqual({})
    expect(result.value.routes).toEqual({})
  })

  it('rejects fewer than two players', () => {
    const result = createInitialSetupState([p1])
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('TOO_FEW_PLAYERS')
  })

  it('rejects a duplicated player', () => {
    const result = createInitialSetupState([p1, p2, p1])
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('DUPLICATE_PLAYER')
  })
})
