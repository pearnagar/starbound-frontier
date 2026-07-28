export type { Brand } from './brand'

export {
  asCaptainId,
  asFactionColorId,
  asPlayerId,
  type CaptainId,
  type FactionColorId,
  type PlayerId,
} from './ids'

export {
  AI_DIFFICULTIES,
  isAiPlayerConfiguration,
  isValidPlayerControlConfiguration,
  PLAYER_CONTROL_TYPES,
  type AiDifficulty,
  type AiPlayerConfiguration,
  type HumanPlayerConfiguration,
  type PlayerControlConfiguration,
  type PlayerControlType,
} from './player-configuration'

export { createInitialPieceSupply, isValidPieceSupply, type PieceSupply } from './piece-supply'

export {
  createEmptyResourceInventory,
  getTotalResourceCount,
  isValidResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
  type ResourceType,
} from './resources'

export type { DomainResult, DomainValidationError } from './result'

export { createPlayer, type CreatePlayerInput, type Player } from './player'
