import { createSeededRandom, deriveAttemptSeed } from '../random/seeded-random'
import type { DomainResult, DomainValidationError } from '../types/result'
import type { Board } from './board'
import { createStandardBoardConfiguration, type BoardConfiguration } from './board-configuration'
import { BOARD_ORIGIN, createBoardCoordinates, getBoardBoundaryCoordinates } from './board-shape'
import { validateBoard } from './board-validation'
import { getHexNeighbors, hexCoordinateKey, hexCoordinatesEqual } from './hex-coordinate'
import {
  isHighProductionNumber,
  PRODUCTION_NUMBERS,
  type ProductionNumber,
} from './production-number'
import { isProducingSectorType, SECTOR_TYPES, type Sector, type SectorType } from './sector'

/** Every non-central sector type, expanded to one entry per sector. */
function buildSectorTypePool(configuration: BoardConfiguration): readonly SectorType[] {
  const pool: SectorType[] = []
  for (const type of SECTOR_TYPES) {
    if (type === 'centralStar') {
      continue
    }
    for (let index = 0; index < configuration.sectorCounts[type]; index += 1) {
      pool.push(type)
    }
  }
  return pool
}

/** Every production token, expanded to one entry per token. */
function buildProductionTokens(configuration: BoardConfiguration): readonly ProductionNumber[] {
  const tokens: ProductionNumber[] = []
  for (const value of PRODUCTION_NUMBERS) {
    for (let index = 0; index < configuration.productionTokenCounts[value]; index += 1) {
      tokens.push(value)
    }
  }
  return tokens
}

/**
 * Builds one candidate board. Returns `undefined` when this attempt cannot be
 * completed (for example no spread-out placement for the high-value tokens was
 * found), which asks the caller to retry with the next attempt seed.
 */
function generateAttempt(
  seed: number,
  attempt: number,
  configuration: BoardConfiguration,
): Board | undefined {
  const random = createSeededRandom(deriveAttemptSeed(seed, attempt))
  const coordinates = createBoardCoordinates(configuration.radius)
  const outerCoordinates = coordinates.filter(
    (coordinate) => !hexCoordinatesEqual(coordinate, BOARD_ORIGIN),
  )

  const typePool = random.shuffle(buildSectorTypePool(configuration))
  if (typePool.length !== outerCoordinates.length) {
    return undefined
  }

  const typeByKey = new Map<string, SectorType>([[hexCoordinateKey(BOARD_ORIGIN), 'centralStar']])
  const pendingTypes = [...typePool]
  for (const coordinate of outerCoordinates) {
    const type = pendingTypes.pop()
    if (type === undefined) {
      return undefined
    }
    typeByKey.set(hexCoordinateKey(coordinate), type)
  }

  const producingCoordinates = coordinates.filter((coordinate) => {
    const type = typeByKey.get(hexCoordinateKey(coordinate))
    return type !== undefined && isProducingSectorType(type)
  })

  const tokens = buildProductionTokens(configuration)
  if (tokens.length !== producingCoordinates.length) {
    return undefined
  }

  // Place the high-value tokens on a mutually non-adjacent subset first, so
  // the 6/8 adjacency rule holds by construction instead of by luck. The
  // remaining tokens can never violate it.
  const highTokens = tokens.filter(isHighProductionNumber)
  const otherTokens = tokens.filter((token) => !isHighProductionNumber(token))

  const highKeys = new Set<string>()
  const highCoordinates: string[] = []
  for (const coordinate of random.shuffle(producingCoordinates)) {
    if (highCoordinates.length === highTokens.length) {
      break
    }
    const touchesHigh = getHexNeighbors(coordinate).some((neighbour) =>
      highKeys.has(hexCoordinateKey(neighbour)),
    )
    if (touchesHigh) {
      continue
    }
    const key = hexCoordinateKey(coordinate)
    highKeys.add(key)
    highCoordinates.push(key)
  }
  if (highCoordinates.length !== highTokens.length) {
    return undefined
  }

  const numberByKey = new Map<string, ProductionNumber>()
  const pendingHigh = random.shuffle(highTokens)
  for (const key of highCoordinates) {
    const token = pendingHigh.pop()
    if (token === undefined) {
      return undefined
    }
    numberByKey.set(key, token)
  }

  const pendingOther = random.shuffle(otherTokens)
  for (const coordinate of producingCoordinates) {
    const key = hexCoordinateKey(coordinate)
    if (highKeys.has(key)) {
      continue
    }
    const token = pendingOther.pop()
    if (token === undefined) {
      return undefined
    }
    numberByKey.set(key, token)
  }

  const boundary = getBoardBoundaryCoordinates(configuration.radius)
  if (boundary.length < configuration.hiddenSectorCount) {
    return undefined
  }
  const hiddenKeys = new Set(
    random.shuffle(boundary).slice(0, configuration.hiddenSectorCount).map(hexCoordinateKey),
  )

  const sectors: Record<string, Sector> = {}
  for (const coordinate of coordinates) {
    const key = hexCoordinateKey(coordinate)
    const type = typeByKey.get(key)
    if (type === undefined) {
      return undefined
    }
    const productionNumber = numberByKey.get(key)
    sectors[key] = {
      coordinate,
      type,
      visibility: hiddenKeys.has(key) ? 'hidden' : 'visible',
      // Omit the key entirely rather than storing `undefined`
      // (exactOptionalPropertyTypes).
      ...(productionNumber === undefined ? {} : { productionNumber }),
    }
  }

  return { seed, attempt, configuration, sectors }
}

/**
 * Generates a valid board for `seed`, retrying deterministically until one
 * passes validation or the configured attempt limit is reached. Validation is
 * never relaxed between attempts.
 */
export function generateBoard(
  seed: number,
  configuration: BoardConfiguration = createStandardBoardConfiguration(),
): DomainResult<Board> {
  if (!Number.isInteger(seed)) {
    return {
      success: false,
      errors: [{ code: 'INVALID_SEED', message: 'Board seed must be an integer.', field: 'seed' }],
    }
  }
  if (
    !Number.isInteger(configuration.maxGenerationAttempts) ||
    configuration.maxGenerationAttempts < 1
  ) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_ATTEMPT_LIMIT',
          message: 'maxGenerationAttempts must be a positive integer.',
          field: 'maxGenerationAttempts',
        },
      ],
    }
  }

  let lastErrors: readonly DomainValidationError[] = []

  for (let attempt = 1; attempt <= configuration.maxGenerationAttempts; attempt += 1) {
    const candidate = generateAttempt(seed, attempt, configuration)
    if (candidate === undefined) {
      lastErrors = [
        {
          code: 'ATTEMPT_INCOMPLETE',
          message: `Attempt ${attempt} could not lay out the configured content.`,
          field: 'configuration',
        },
      ]
      continue
    }
    const validation = validateBoard(candidate)
    if (validation.success) {
      return { success: true, value: candidate }
    }
    lastErrors = validation.errors
  }

  return {
    success: false,
    errors: [
      {
        code: 'BOARD_GENERATION_FAILED',
        message: `No valid board after ${configuration.maxGenerationAttempts} attempts.`,
        field: 'seed',
      },
      ...lastErrors,
    ],
  }
}
