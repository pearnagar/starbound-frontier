import { describe, expect, it } from 'vitest'
import type { Board } from './board'
import { createStandardBoardConfiguration } from './board-configuration'
import { generateBoard } from './board-generation'
import { validateBoard } from './board-validation'
import { getHexNeighbors, hexCoordinateKey, type HexCoordinate } from './hex-coordinate'
import type { ProductionNumber } from './production-number'
import type { Sector, SectorVisibility } from './sector'

const configuration = createStandardBoardConfiguration()

function validBoard(seed = 4): Board {
  const result = generateBoard(seed)
  if (!result.success) {
    throw new Error('expected a valid board fixture')
  }
  return result.value
}

function errorCodes(board: Board): readonly string[] {
  const result = validateBoard(board)
  return result.success ? [] : result.errors.map((error) => error.code)
}

/** Rewrites one sector, keyed by its own coordinate. */
function withSector(board: Board, coordinate: HexCoordinate, changes: Partial<Sector>): Board {
  const key = hexCoordinateKey(coordinate)
  const existing = board.sectors[key]
  if (existing === undefined) {
    throw new Error(`no sector at ${key}`)
  }
  return { ...board, sectors: { ...board.sectors, [key]: { ...existing, ...changes } } }
}

function findCoordinate(board: Board, predicate: (sector: Sector) => boolean): HexCoordinate {
  const match = Object.values(board.sectors).find(predicate)
  if (match === undefined) {
    throw new Error('no sector matched the predicate')
  }
  return match.coordinate
}

describe('validateBoard', () => {
  it('accepts a freshly generated board', () => {
    for (const seed of [0, 1, 42, 2026]) {
      const result = validateBoard(validBoard(seed))
      expect(result.success).toBe(true)
    }
  })

  it('rejects a duplicate coordinate', () => {
    const board = validBoard()
    const origin = board.sectors['0,0']
    const other = board.sectors['1,0']
    if (origin === undefined || other === undefined) throw new Error('missing fixture sectors')
    const broken: Board = {
      ...board,
      sectors: { ...board.sectors, '1,0': { ...other, coordinate: origin.coordinate } },
    }
    const codes = errorCodes(broken)
    expect(codes).toContain('DUPLICATE_COORDINATE')
    expect(codes).toContain('KEY_COORDINATE_MISMATCH')
  })

  it('rejects a missing central star', () => {
    const board = validBoard()
    const broken = withSector(board, { q: 0, r: 0 }, { type: 'emptySpace' })
    const codes = errorCodes(broken)
    expect(codes).toContain('CENTRAL_STAR_COUNT')
    expect(codes).toContain('SECTOR_COUNT_MISMATCH')
  })

  it('rejects a misplaced central star', () => {
    const board = validBoard()
    const outer = findCoordinate(board, (sector) => sector.type === 'emptySpace')
    const moved = withSector(withSector(board, { q: 0, r: 0 }, { type: 'emptySpace' }), outer, {
      type: 'centralStar',
    })
    // Drop the production number that outer sector may have carried.
    const key = hexCoordinateKey(outer)
    const relocated = moved.sectors[key]
    if (relocated === undefined) throw new Error('missing relocated sector')
    const broken: Board = {
      ...moved,
      sectors: {
        ...moved.sectors,
        [key]: { coordinate: relocated.coordinate, type: 'centralStar', visibility: 'visible' },
      },
    }
    expect(errorCodes(broken)).toContain('CENTRAL_STAR_MISPLACED')
  })

  it('rejects a hidden central star', () => {
    const board = validBoard()
    const broken = withSector(board, { q: 0, r: 0 }, { visibility: 'hidden' })
    expect(errorCodes(broken)).toContain('CENTRAL_STAR_HIDDEN')
  })

  it('rejects an invalid production number', () => {
    const board = validBoard()
    const producing = findCoordinate(board, (sector) => sector.productionNumber !== undefined)
    const broken = withSector(board, producing, { productionNumber: 7 as ProductionNumber })
    expect(errorCodes(broken)).toContain('INVALID_PRODUCTION_NUMBER')
  })

  it('rejects a production number on empty space', () => {
    const board = validBoard()
    const empty = findCoordinate(board, (sector) => sector.type === 'emptySpace')
    const broken = withSector(board, empty, { productionNumber: 5 })
    expect(errorCodes(broken)).toContain('PRODUCTION_ON_NON_PRODUCING_SECTOR')
  })

  it('rejects a producing sector with no production number', () => {
    const board = validBoard()
    const producing = findCoordinate(board, (sector) => sector.productionNumber !== undefined)
    const key = hexCoordinateKey(producing)
    const existing = board.sectors[key]
    if (existing === undefined) throw new Error('missing sector')
    const broken: Board = {
      ...board,
      sectors: {
        ...board.sectors,
        [key]: {
          coordinate: existing.coordinate,
          type: existing.type,
          visibility: existing.visibility,
        },
      },
    }
    expect(errorCodes(broken)).toContain('MISSING_PRODUCTION_NUMBER')
  })

  it('rejects adjacent high-production sectors', () => {
    const board = validBoard()

    // Find any two neighbouring producing sectors, then force them to 6 and 8.
    const pairs: (readonly [Sector, Sector])[] = []
    for (const sector of Object.values(board.sectors)) {
      if (sector.productionNumber === undefined) continue
      for (const neighbour of getHexNeighbors(sector.coordinate)) {
        const other = board.sectors[hexCoordinateKey(neighbour)]
        if (other === undefined || other.productionNumber === undefined) continue
        pairs.push([sector, other])
      }
    }

    const pair = pairs[0]
    expect(pair).toBeDefined()
    if (pair === undefined) return
    const [first, second] = pair

    const broken = withSector(
      withSector(board, first.coordinate, { productionNumber: 6 }),
      second.coordinate,
      { productionNumber: 8 },
    )
    expect(errorCodes(broken)).toContain('ADJACENT_HIGH_PRODUCTION')
  })

  it('rejects a hidden inner sector', () => {
    const board = validBoard()
    const inner = findCoordinate(
      board,
      (sector) => sector.coordinate.q === 1 && sector.coordinate.r === 0,
    )
    const broken = withSector(board, inner, { visibility: 'hidden' as SectorVisibility })
    const codes = errorCodes(broken)
    expect(codes).toContain('HIDDEN_SECTOR_NOT_ON_BOUNDARY')
    expect(codes).toContain('HIDDEN_SECTOR_COUNT_MISMATCH')
  })

  it('rejects a wrong hidden-sector count', () => {
    const board = validBoard()
    const hidden = findCoordinate(board, (sector) => sector.visibility === 'hidden')
    const broken = withSector(board, hidden, { visibility: 'visible' })
    expect(errorCodes(broken)).toContain('HIDDEN_SECTOR_COUNT_MISMATCH')
  })

  it('rejects a disconnected board', () => {
    const board = validBoard()
    const detached: HexCoordinate = { q: 10, r: 10 }
    const extra: Sector = { coordinate: detached, type: 'emptySpace', visibility: 'visible' }
    const broken: Board = {
      ...board,
      sectors: { ...board.sectors, [hexCoordinateKey(detached)]: extra },
    }
    const codes = errorCodes(broken)
    expect(codes).toContain('BOARD_NOT_CONTIGUOUS')
    expect(codes).toContain('BOARD_SIZE_MISMATCH')
  })

  it('rejects a board whose size disagrees with its configuration', () => {
    const board = validBoard()
    const sectors = { ...board.sectors }
    delete sectors['3,0']
    expect(errorCodes({ ...board, sectors })).toContain('BOARD_SIZE_MISMATCH')
  })

  it('rejects a Quantum Rift count that is not rare', () => {
    const board = validBoard()
    // Rift starts at 3 and alloy at 6; converting two alloys makes rift 5 vs alloy 4.
    const alloyCoordinates = Object.values(board.sectors)
      .filter((sector) => sector.type === 'alloyAsteroidField')
      .slice(0, 2)
      .map((sector) => sector.coordinate)
    expect(alloyCoordinates).toHaveLength(2)

    const rifted = alloyCoordinates.reduce<Board>(
      (current, coordinate) => withSector(current, coordinate, { type: 'quantumRift' }),
      board,
    )
    expect(errorCodes(rifted)).toContain('QUANTUM_RIFT_NOT_RARE')
  })
})

describe('retry behaviour', () => {
  it('follows the same retry sequence for the same seed', () => {
    const first = generateBoard(1337)
    const second = generateBoard(1337)
    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
    if (!first.success || !second.success) return
    expect(first.value.attempt).toBe(second.value.attempt)
    expect(JSON.stringify(first.value)).toBe(JSON.stringify(second.value))
  })

  it('returns a structured failure when no attempt can satisfy the configuration', () => {
    // More hidden sectors than the outer ring can hold: every attempt fails.
    const impossible = { ...configuration, hiddenSectorCount: 99, maxGenerationAttempts: 3 }
    const result = generateBoard(1, impossible)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors[0]?.code).toBe('BOARD_GENERATION_FAILED')
    expect(result.errors[0]?.message).toContain('3 attempts')
  })

  it('reports the underlying validation failure alongside the generation failure', () => {
    const mismatched = {
      ...configuration,
      sectorCounts: { ...configuration.sectorCounts, emptySpace: 99 },
      maxGenerationAttempts: 2,
    }
    const result = generateBoard(1, mismatched)
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.errors.map((error) => error.code)).toContain('BOARD_GENERATION_FAILED')
    expect(result.errors.length).toBeGreaterThan(1)
  })
})
