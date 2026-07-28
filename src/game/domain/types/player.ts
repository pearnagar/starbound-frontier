import type { CaptainId, FactionColorId, PlayerId } from './ids'
import {
  isValidPlayerControlConfiguration,
  type PlayerControlConfiguration,
} from './player-configuration'
import { createInitialPieceSupply, type PieceSupply } from './piece-supply'
import { createEmptyResourceInventory, type ResourceInventory } from './resources'
import type { DomainResult, DomainValidationError } from './result'

export interface Player {
  readonly id: PlayerId
  readonly name: string
  /** Authoritative — this player's seat/turn order (0-based). */
  readonly seatIndex: number
  readonly captainId: CaptainId
  readonly factionColorId: FactionColorId
  readonly control: PlayerControlConfiguration
  /** Authoritative domain state — current resource holdings. */
  readonly resources: ResourceInventory
  /** Authoritative domain state — pieces not yet placed on the board. */
  readonly pieceSupply: PieceSupply
  /** Authoritative domain state — milestone identifiers already earned. */
  readonly earnedMilestoneIds: readonly string[]
  /** Authoritative counter — completed player-to-player trades. */
  readonly tradeCount: number
  /** Authoritative counter — sectors this player has explored. */
  readonly exploredSectorCount: number
  /**
   * Cached victory-point total — NOT authoritative. Must be recomputed by the
   * scoring system introduced in a later milestone (see "Scoring and
   * victory" in docs/IMPLEMENTATION_PLAN.md). Starts at 0.
   */
  readonly cachedVictoryPoints: number
}

export interface CreatePlayerInput {
  readonly id: PlayerId
  readonly name: string
  readonly seatIndex: number
  readonly captainId: CaptainId
  readonly factionColorId: FactionColorId
  readonly control: PlayerControlConfiguration
}

export function createPlayer(input: CreatePlayerInput): DomainResult<Player> {
  const errors: DomainValidationError[] = []

  const trimmedName = input.name.trim()
  if (trimmedName.length === 0) {
    errors.push({
      code: 'INVALID_NAME',
      message: 'Player display name must not be empty.',
      field: 'name',
    })
  }

  if (!Number.isInteger(input.seatIndex) || input.seatIndex < 0) {
    errors.push({
      code: 'INVALID_SEAT_INDEX',
      message: 'Seat index must be a non-negative integer.',
      field: 'seatIndex',
    })
  }

  if (!isValidPlayerControlConfiguration(input.control)) {
    errors.push({
      code: 'INVALID_CONTROL_CONFIGURATION',
      message: 'Player control configuration is invalid.',
      field: 'control',
    })
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return {
    success: true,
    value: {
      id: input.id,
      name: trimmedName,
      seatIndex: input.seatIndex,
      captainId: input.captainId,
      factionColorId: input.factionColorId,
      control: input.control,
      resources: createEmptyResourceInventory(),
      pieceSupply: createInitialPieceSupply(),
      earnedMilestoneIds: [],
      tradeCount: 0,
      exploredSectorCount: 0,
      cachedVictoryPoints: 0,
    },
  }
}
