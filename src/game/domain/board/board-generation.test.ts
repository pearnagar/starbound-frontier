import { describe, expect, it, vi } from 'vitest'
import { listSectors, type Board } from './board'
import {
  createStandardBoardConfiguration,
  getConfiguredProductionTokenTotal,
} from './board-configuration'
import { generateBoard } from './board-generation'
import { BOARD_ORIGIN, isBoardBoundaryCoordinate } from './board-shape'
import { getHexNeighbors, hexCoordinateKey, hexCoordinatesEqual } from './hex-coordinate'
import { isHighProductionNumber, isProductionNumber, PRODUCTION_NUMBERS } from './production-number'
import { isProducingSectorType, SECTOR_TYPES, type SectorType } from './sector'

const configuration = createStandardBoardConfiguration()

function generateOrThrow(seed: number): Board {
  const result = generateBoard(seed)
  if (!result.success) {
    throw new Error(`generation failed for seed ${seed}: ${result.errors[0]?.code ?? 'unknown'}`)
  }
  return result.value
}

function countTypes(board: Board): Record<SectorType, number> {
  const counts = Object.fromEntries(SECTOR_TYPES.map((type) => [type, 0])) as Record<
    SectorType,
    number
  >
  for (const sector of listSectors(board)) {
    counts[sector.type] += 1
  }
  return counts
}

const SEEDS = [0, 1, 7, 42, 1337, -5, 2026]

describe('generateBoard', () => {
  it('succeeds for a range of seeds', () => {
    for (const seed of SEEDS) {
      expect(generateBoard(seed).success).toBe(true)
    }
  })

  it('rejects a non-integer seed', () => {
    const result = generateBoard(1.5)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_SEED')).toBe(true)
  })

  it('rejects a non-positive attempt limit', () => {
    const result = generateBoard(1, { ...configuration, maxGenerationAttempts: 0 })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.some((error) => error.code === 'INVALID_ATTEMPT_LIMIT')).toBe(true)
  })

  it('records the seed and a positive attempt number', () => {
    const board = generateOrThrow(42)
    expect(board.seed).toBe(42)
    expect(board.attempt).toBeGreaterThanOrEqual(1)
    expect(board.attempt).toBeLessThanOrEqual(configuration.maxGenerationAttempts)
  })
})

describe('sector distribution', () => {
  it('produces the configured total sector count', () => {
    for (const seed of SEEDS) {
      expect(listSectors(generateOrThrow(seed))).toHaveLength(37)
    }
  })

  it('matches the configured count for every sector type', () => {
    for (const seed of SEEDS) {
      const counts = countTypes(generateOrThrow(seed))
      for (const type of SECTOR_TYPES) {
        expect(counts[type]).toBe(configuration.sectorCounts[type])
      }
    }
  })

  it('places exactly one central star, at the origin and visible', () => {
    for (const seed of SEEDS) {
      const board = generateOrThrow(seed)
      const stars = listSectors(board).filter((sector) => sector.type === 'centralStar')
      expect(stars).toHaveLength(1)
      const [star] = stars
      if (star === undefined) return
      expect(hexCoordinatesEqual(star.coordinate, BOARD_ORIGIN)).toBe(true)
      expect(star.visibility).toBe('visible')
      expect(star.productionNumber).toBeUndefined()
    }
  })

  it('represents every producing resource type', () => {
    const counts = countTypes(generateOrThrow(1))
    for (const type of SECTOR_TYPES) {
      if (isProducingSectorType(type)) {
        expect(counts[type]).toBeGreaterThan(0)
      }
    }
  })

  it('keeps Quantum Rift rarer than each basic resource', () => {
    const counts = countTypes(generateOrThrow(1))
    expect(counts.quantumRift).toBeLessThan(counts.alloyAsteroidField)
    expect(counts.quantumRift).toBeLessThan(counts.plasmaNebula)
    expect(counts.quantumRift).toBeLessThan(counts.cryoniteWorld)
    expect(counts.quantumRift).toBeLessThan(counts.biofiberPlanet)
  })
})

describe('production numbers', () => {
  it('gives every producing sector exactly one valid number and no others any', () => {
    for (const seed of SEEDS) {
      for (const sector of listSectors(generateOrThrow(seed))) {
        if (isProducingSectorType(sector.type)) {
          expect(sector.productionNumber).toBeDefined()
          if (sector.productionNumber === undefined) continue
          expect(isProductionNumber(sector.productionNumber)).toBe(true)
        } else {
          expect(sector.productionNumber).toBeUndefined()
        }
      }
    }
  })

  it('never assigns 7', () => {
    expect(PRODUCTION_NUMBERS).not.toContain(7)
    for (const seed of SEEDS) {
      for (const sector of listSectors(generateOrThrow(seed))) {
        expect(sector.productionNumber).not.toBe(7)
      }
    }
  })

  it('matches token count to producing-sector count', () => {
    const board = generateOrThrow(1)
    const producing = listSectors(board).filter((sector) => isProducingSectorType(sector.type))
    expect(producing).toHaveLength(getConfiguredProductionTokenTotal(configuration))
  })

  it('uses exactly the configured token multiset', () => {
    const board = generateOrThrow(1)
    const counts = new Map<number, number>()
    for (const sector of listSectors(board)) {
      if (sector.productionNumber === undefined) continue
      counts.set(sector.productionNumber, (counts.get(sector.productionNumber) ?? 0) + 1)
    }
    for (const value of PRODUCTION_NUMBERS) {
      expect(counts.get(value) ?? 0).toBe(configuration.productionTokenCounts[value])
    }
  })

  it('never places two high-production sectors next to each other', () => {
    for (const seed of SEEDS) {
      const board = generateOrThrow(seed)
      for (const sector of listSectors(board)) {
        const value = sector.productionNumber
        if (value === undefined || !isHighProductionNumber(value)) continue
        for (const neighbour of getHexNeighbors(sector.coordinate)) {
          const other = board.sectors[hexCoordinateKey(neighbour)]
          const otherValue = other?.productionNumber
          if (otherValue === undefined) continue
          expect(isHighProductionNumber(otherValue)).toBe(false)
        }
      }
    }
  })

  it('weights 6 and 8 above 2 and 12', () => {
    expect(configuration.productionTokenCounts[6]).toBeGreaterThan(
      configuration.productionTokenCounts[2],
    )
    expect(configuration.productionTokenCounts[8]).toBeGreaterThan(
      configuration.productionTokenCounts[12],
    )
  })
})

describe('hidden sectors', () => {
  it('hides exactly the configured number', () => {
    for (const seed of SEEDS) {
      const hidden = listSectors(generateOrThrow(seed)).filter(
        (sector) => sector.visibility === 'hidden',
      )
      expect(hidden).toHaveLength(configuration.hiddenSectorCount)
    }
  })

  it('hides only outer-ring sectors', () => {
    for (const seed of SEEDS) {
      for (const sector of listSectors(generateOrThrow(seed))) {
        if (sector.visibility !== 'hidden') continue
        expect(isBoardBoundaryCoordinate(sector.coordinate, configuration.radius)).toBe(true)
      }
    }
  })

  it('leaves plenty of visible sectors for later placement', () => {
    const visible = listSectors(generateOrThrow(1)).filter(
      (sector) => sector.visibility === 'visible',
    )
    expect(visible.length).toBe(37 - configuration.hiddenSectorCount)
  })

  it('keeps content on hidden sectors', () => {
    const hidden = listSectors(generateOrThrow(1)).filter(
      (sector) => sector.visibility === 'hidden',
    )
    for (const sector of hidden) {
      expect(SECTOR_TYPES).toContain(sector.type)
      if (isProducingSectorType(sector.type)) {
        expect(sector.productionNumber).toBeDefined()
      }
    }
  })
})

describe('determinism', () => {
  it('produces identical board state for the same seed', () => {
    const first = generateOrThrow(2026)
    const second = generateOrThrow(2026)
    expect(first).toEqual(second)
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it('produces the same attempt number for the same seed', () => {
    expect(generateOrThrow(1337).attempt).toBe(generateOrThrow(1337).attempt)
  })

  it('produces meaningfully different arrangements for different seeds', () => {
    const a = generateOrThrow(1)
    const b = generateOrThrow(2)
    const differing = Object.keys(a.sectors).filter(
      (key) => a.sectors[key]?.type !== b.sectors[key]?.type,
    )
    expect(differing.length).toBeGreaterThan(5)
  })

  it('never calls Math.random', () => {
    const spy = vi.spyOn(Math, 'random')
    generateBoard(99)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
