import type { DomainResult, DomainValidationError } from '../types/result'
import { getBoardSize, listSectors, type Board } from './board'
import { getConfiguredBoardSize, getConfiguredProductionTokenTotal } from './board-configuration'
import { BOARD_ORIGIN, isBoardBoundaryCoordinate } from './board-shape'
import { getHexNeighbors, hexCoordinateKey, hexCoordinatesEqual } from './hex-coordinate'
import { isHighProductionNumber, isProductionNumber } from './production-number'
import {
  BASIC_PRODUCING_SECTOR_TYPES,
  isProducingSectorType,
  SECTOR_TYPES,
  type SectorType,
} from './sector'

function countSectorTypes(board: Board): Record<SectorType, number> {
  const counts = Object.fromEntries(SECTOR_TYPES.map((type) => [type, 0])) as Record<
    SectorType,
    number
  >
  for (const sector of listSectors(board)) {
    counts[sector.type] += 1
  }
  return counts
}

function isContiguous(board: Board): boolean {
  const sectors = listSectors(board)
  const first = sectors[0]
  if (first === undefined) {
    return true
  }

  const visited = new Set<string>([hexCoordinateKey(first.coordinate)])
  const queue = [first.coordinate]

  while (queue.length > 0) {
    const current = queue.pop()
    if (current === undefined) {
      break
    }
    for (const neighbour of getHexNeighbors(current)) {
      const key = hexCoordinateKey(neighbour)
      if (visited.has(key) || board.sectors[key] === undefined) {
        continue
      }
      visited.add(key)
      queue.push(neighbour)
    }
  }

  return visited.size === sectors.length
}

export function validateBoard(board: Board): DomainResult<Board> {
  const errors: DomainValidationError[] = []
  const sectors = listSectors(board)
  const { configuration } = board

  if (getBoardSize(board) !== getConfiguredBoardSize(configuration)) {
    errors.push({
      code: 'BOARD_SIZE_MISMATCH',
      message: 'Board does not contain the configured number of sectors.',
      field: 'sectors',
    })
  }

  for (const [key, sector] of Object.entries(board.sectors)) {
    if (hexCoordinateKey(sector.coordinate) !== key) {
      errors.push({
        code: 'KEY_COORDINATE_MISMATCH',
        message: `Sector stored under "${key}" does not carry that coordinate.`,
        field: 'sectors',
      })
    }
  }

  const coordinateKeys = new Set(sectors.map((sector) => hexCoordinateKey(sector.coordinate)))
  if (coordinateKeys.size !== sectors.length) {
    errors.push({
      code: 'DUPLICATE_COORDINATE',
      message: 'Two sectors share the same coordinate.',
      field: 'sectors',
    })
  }

  if (!isContiguous(board)) {
    errors.push({
      code: 'BOARD_NOT_CONTIGUOUS',
      message: 'Board sectors do not form a single connected region.',
      field: 'sectors',
    })
  }

  const counts = countSectorTypes(board)

  if (counts.centralStar !== 1) {
    errors.push({
      code: 'CENTRAL_STAR_COUNT',
      message: 'Board must contain exactly one central star.',
      field: 'sectors',
    })
  }

  const centralStar = sectors.find((sector) => sector.type === 'centralStar')
  if (centralStar !== undefined && !hexCoordinatesEqual(centralStar.coordinate, BOARD_ORIGIN)) {
    errors.push({
      code: 'CENTRAL_STAR_MISPLACED',
      message: 'The central star must sit at the origin.',
      field: 'sectors',
    })
  }
  if (centralStar !== undefined && centralStar.visibility !== 'visible') {
    errors.push({
      code: 'CENTRAL_STAR_HIDDEN',
      message: 'The central star must always be visible.',
      field: 'sectors',
    })
  }

  for (const type of SECTOR_TYPES) {
    const expected = configuration.sectorCounts[type]
    if (counts[type] !== expected) {
      errors.push({
        code: 'SECTOR_COUNT_MISMATCH',
        message: `Expected ${expected} ${type} sectors but found ${counts[type]}.`,
        field: 'sectors',
      })
    }
  }

  for (const type of SECTOR_TYPES) {
    if (isProducingSectorType(type) && counts[type] === 0) {
      errors.push({
        code: 'MISSING_RESOURCE_TYPE',
        message: `Board contains no ${type} sectors.`,
        field: 'sectors',
      })
    }
  }

  for (const basicType of BASIC_PRODUCING_SECTOR_TYPES) {
    if (counts.quantumRift >= counts[basicType]) {
      errors.push({
        code: 'QUANTUM_RIFT_NOT_RARE',
        message: `Quantum Rift must be rarer than ${basicType}.`,
        field: 'sectors',
      })
    }
  }

  let producingCount = 0
  for (const sector of sectors) {
    const producing = isProducingSectorType(sector.type)
    if (producing) {
      producingCount += 1
    }

    if (!producing && sector.productionNumber !== undefined) {
      errors.push({
        code: 'PRODUCTION_ON_NON_PRODUCING_SECTOR',
        message: `A ${sector.type} sector must not carry a production number.`,
        field: 'productionNumber',
      })
      continue
    }

    if (!producing) {
      continue
    }

    if (sector.productionNumber === undefined) {
      errors.push({
        code: 'MISSING_PRODUCTION_NUMBER',
        message: `Producing sector at ${hexCoordinateKey(sector.coordinate)} has no production number.`,
        field: 'productionNumber',
      })
    } else if (!isProductionNumber(sector.productionNumber)) {
      errors.push({
        code: 'INVALID_PRODUCTION_NUMBER',
        message: `${String(sector.productionNumber)} is not a valid production number.`,
        field: 'productionNumber',
      })
    }
  }

  if (producingCount !== getConfiguredProductionTokenTotal(configuration)) {
    errors.push({
      code: 'PRODUCTION_TOKEN_COUNT_MISMATCH',
      message: 'Production token count does not match the number of producing sectors.',
      field: 'productionNumber',
    })
  }

  for (const sector of sectors) {
    const value = sector.productionNumber
    if (value === undefined || !isHighProductionNumber(value)) {
      continue
    }
    for (const neighbour of getHexNeighbors(sector.coordinate)) {
      const other = board.sectors[hexCoordinateKey(neighbour)]
      const otherValue = other?.productionNumber
      if (otherValue !== undefined && isHighProductionNumber(otherValue)) {
        errors.push({
          code: 'ADJACENT_HIGH_PRODUCTION',
          message: `Adjacent high-production sectors at ${hexCoordinateKey(sector.coordinate)} and ${hexCoordinateKey(neighbour)}.`,
          field: 'productionNumber',
        })
        break
      }
    }
  }

  const hidden = sectors.filter((sector) => sector.visibility === 'hidden')
  if (hidden.length !== configuration.hiddenSectorCount) {
    errors.push({
      code: 'HIDDEN_SECTOR_COUNT_MISMATCH',
      message: `Expected ${configuration.hiddenSectorCount} hidden sectors but found ${hidden.length}.`,
      field: 'visibility',
    })
  }
  for (const sector of hidden) {
    if (!isBoardBoundaryCoordinate(sector.coordinate, configuration.radius)) {
      errors.push({
        code: 'HIDDEN_SECTOR_NOT_ON_BOUNDARY',
        message: `Hidden sector at ${hexCoordinateKey(sector.coordinate)} is not on the outer ring.`,
        field: 'visibility',
      })
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }
  return { success: true, value: board }
}
