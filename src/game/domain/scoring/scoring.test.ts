import { describe, expect, it } from 'vitest'
import { asIntersectionId } from '../board/space-board'
import { createColony, createSpaceport, getStructureVictoryPoints } from '../buildings/structure'
import { VICTORY_POINT_TARGET } from '../rules/rules-config'
import type { Match } from '../turns/match'
import { createTestMatch } from '../turns/test-fixtures'
import {
  getVictoryPointBreakdown,
  getVictoryPoints,
  getWinner,
  hasReachedVictoryTarget,
} from './scoring'

describe('structure victory points', () => {
  it('scores a Colony at 1 and a Spaceport at 2 in total', () => {
    expect(getStructureVictoryPoints('colony')).toBe(1)
    expect(getStructureVictoryPoints('spaceport')).toBe(2)
  })

  it('scores a Trade Station at 0 directly', () => {
    expect(getStructureVictoryPoints('tradeStation')).toBe(0)
  })
})

describe('victory point breakdown', () => {
  it('counts the starting position as 4 points', () => {
    const match = createTestMatch()
    const breakdown = getVictoryPointBreakdown(match, match.activePlayerId)
    // 2 Colonies + 1 Spaceport worth 2.
    expect(breakdown.colonies).toBe(2)
    expect(breakdown.spaceports).toBe(2)
    expect(breakdown.total).toBe(4)
  })

  it('never counts a Spaceport as a Colony as well', () => {
    const match = createTestMatch()
    const single: Match = {
      ...match,
      structures: {
        [asIntersectionId('i-colony-a')]: createSpaceport(
          asIntersectionId('i-colony-a'),
          match.activePlayerId,
        ),
      },
    }
    const breakdown = getVictoryPointBreakdown(single, single.activePlayerId)
    expect(breakdown.colonies).toBe(0)
    expect(breakdown.spaceports).toBe(2)
    expect(breakdown.total).toBe(2)
  })

  it('scores a Friendship Marker at 2 and cleared hazards at 1 each', () => {
    const match = createTestMatch()
    const breakdown = getVictoryPointBreakdown(match, match.activePlayerId, {
      friendshipMarkerCount: 1,
      defeatedPirateBaseCount: 1,
      terraformedIcePlanetCount: 1,
    })
    expect(breakdown.friendshipMarkers).toBe(2)
    expect(breakdown.defeatedPirateBases).toBe(1)
    expect(breakdown.terraformedIcePlanets).toBe(1)
    expect(breakdown.total).toBe(4 + 2 + 1 + 1)
  })

  it('scores 1 point per complete pair of Fame Medal pieces', () => {
    const match = createTestMatch()
    const activeId = match.activePlayerId
    function withPieces(count: number): Match {
      return {
        ...match,
        playersById: {
          ...match.playersById,
          [activeId]: {
            ...match.playersById[activeId]!,
            mothership: { ...match.playersById[activeId]!.mothership, fameMedalPieces: count },
          },
        },
      }
    }
    // Players start with 1 loose piece, worth nothing on its own.
    expect(getVictoryPointBreakdown(withPieces(1), activeId).fameMedals).toBe(0)
    expect(getVictoryPointBreakdown(withPieces(2), activeId).fameMedals).toBe(1)
    expect(getVictoryPointBreakdown(withPieces(3), activeId).fameMedals).toBe(1)
    expect(getVictoryPointBreakdown(withPieces(4), activeId).fameMedals).toBe(2)
  })

  it('scores only the requested player’s structures', () => {
    const match = createTestMatch()
    const other = match.playerOrder[1]!
    expect(getVictoryPoints(match, other)).toBe(4)

    const lonely: Match = {
      ...match,
      structures: {
        [asIntersectionId('i-colony-a')]: createColony(
          asIntersectionId('i-colony-a'),
          match.activePlayerId,
        ),
      },
    }
    expect(getVictoryPoints(lonely, other)).toBe(0)
  })
})

describe('victory threshold', () => {
  it('requires 15 points', () => {
    expect(VICTORY_POINT_TARGET).toBe(15)
    expect(hasReachedVictoryTarget(14)).toBe(false)
    expect(hasReachedVictoryTarget(15)).toBe(true)
    expect(hasReachedVictoryTarget(16)).toBe(true)
  })

  it('does not use the old 8, 10, or 14 point targets', () => {
    expect(hasReachedVictoryTarget(8)).toBe(false)
    expect(hasReachedVictoryTarget(10)).toBe(false)
    expect(hasReachedVictoryTarget(14)).toBe(false)
  })

  it('declares a winner only when the active player has reached the target', () => {
    const match = createTestMatch()
    expect(getWinner(match)).toBeUndefined()

    const activeId = match.activePlayerId
    const winning: Match = {
      ...match,
      playersById: {
        ...match.playersById,
        [activeId]: { ...match.playersById[activeId]!, victoryPoints: 15 },
      },
    }
    expect(getWinner(winning)).toBe(activeId)
  })

  it('does not declare an opponent the winner on someone else’s turn', () => {
    const match = createTestMatch()
    const other = match.playerOrder[1]!
    const opponentAhead: Match = {
      ...match,
      playersById: {
        ...match.playersById,
        [other]: { ...match.playersById[other]!, victoryPoints: 20 },
      },
    }
    expect(getWinner(opponentAhead)).toBeUndefined()
  })
})
