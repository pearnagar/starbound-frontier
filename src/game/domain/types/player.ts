import { STARTING_VICTORY_POINTS } from '../rules/rules-config'
import type { CaptainId, FactionColorId, PlayerId } from './ids'
import { createInitialMothershipState, type MothershipState } from './mothership'
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
  /** Authoritative domain state — current resource holdings (hidden from others). */
  readonly resources: ResourceInventory
  /** Authoritative domain state — pieces not yet placed on the board. */
  readonly pieceSupply: PieceSupply
  /** Authoritative domain state — upgrades and Fame Medal pieces. */
  readonly mothership: MothershipState
  /**
   * Position on the victory-point track. Players begin at 4 for their two
   * starting Colonies and one Spaceport. Scoring recomputes this from board
   * state and tokens (see `domain/scoring`); it is stored because the physical
   * track is itself authoritative for Friendship Marker transfers.
   */
  readonly victoryPoints: number
  /** Authoritative counter — completed player-to-player trades. */
  readonly tradeCount: number
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
      mothership: createInitialMothershipState(),
      victoryPoints: STARTING_VICTORY_POINTS,
      tradeCount: 0,
    },
  }
}
