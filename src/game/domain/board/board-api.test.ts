import { describe, expect, it } from 'vitest'
import { getBoardSize, getSector, listSectors } from './board'
import {
  createStandardBoardConfiguration,
  getConfiguredBoardSize,
  getConfiguredProductionTokenTotal,
  getConfiguredSectorTotal,
} from './board-configuration'
import { generateBoard } from './board-generation'
import { BOARD_ORIGIN } from './board-shape'
import {
  getProductionProbabilityWeight,
  isHighProductionNumber,
  isProductionNumber,
  PRODUCTION_NUMBERS,
} from './production-number'
import { isCentralStarSector, isProducingSectorType, isSectorHidden, SECTOR_TYPES } from './sector'

const configuration = createStandardBoardConfiguration()

describe('standard configuration', () => {
  it('describes a 37-sector board whose type counts add up', () => {
    expect(getConfiguredBoardSize(configuration)).toBe(37)
    expect(getConfiguredSectorTotal(configuration)).toBe(37)
  })

  it('has one production token per producing sector', () => {
    const producingSectors = SECTOR_TYPES.filter(isProducingSectorType).reduce(
      (total, type) => total + configuration.sectorCounts[type],
      0,
    )
    expect(getConfiguredProductionTokenTotal(configuration)).toBe(producingSectors)
    expect(producingSectors).toBe(27)
  })

  it('is a fresh object on each call', () => {
    expect(createStandardBoardConfiguration()).not.toBe(configuration)
    expect(createStandardBoardConfiguration()).toEqual(configuration)
  })
})

describe('production number metadata', () => {
  it('excludes 7 and lists ten values', () => {
    expect(PRODUCTION_NUMBERS).toHaveLength(10)
    expect(PRODUCTION_NUMBERS).not.toContain(7)
  })

  it('weights values by their two-dice likelihood', () => {
    expect(getProductionProbabilityWeight(2)).toBe(1)
    expect(getProductionProbabilityWeight(6)).toBe(5)
    expect(getProductionProbabilityWeight(8)).toBe(5)
    expect(getProductionProbabilityWeight(12)).toBe(1)
  })

  it('peaks at the high-production values', () => {
    const weights = PRODUCTION_NUMBERS.map(getProductionProbabilityWeight)
    const peak = Math.max(...weights)
    for (const value of PRODUCTION_NUMBERS) {
      const isPeak = getProductionProbabilityWeight(value) === peak
      expect(isHighProductionNumber(value)).toBe(isPeak)
    }
  })

  it('recognises only valid values', () => {
    expect(isProductionNumber(6)).toBe(true)
    expect(isProductionNumber(7)).toBe(false)
    expect(isProductionNumber(13)).toBe(false)
  })
})

describe('board accessors', () => {
  const result = generateBoard(4)
  if (!result.success) {
    throw new Error('expected a valid board fixture')
  }
  const board = result.value

  it('reports its size', () => {
    expect(getBoardSize(board)).toBe(37)
    expect(listSectors(board)).toHaveLength(37)
  })

  it('looks a sector up by coordinate', () => {
    const sector = getSector(board, BOARD_ORIGIN)
    expect(sector).toBeDefined()
    expect(sector === undefined ? undefined : isCentralStarSector(sector)).toBe(true)
  })

  it('returns undefined off the board', () => {
    expect(getSector(board, { q: 99, r: -99 })).toBeUndefined()
  })

  it('identifies hidden sectors', () => {
    const hidden = listSectors(board).filter(isSectorHidden)
    expect(hidden).toHaveLength(configuration.hiddenSectorCount)
    for (const sector of hidden) {
      expect(isCentralStarSector(sector)).toBe(false)
    }
  })
})
