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

export {
  adjustPieceSupply,
  createInitialPieceSupply,
  hasPieces,
  isValidPieceSupply,
  PIECE_SUPPLY_KEYS,
  type PieceKind,
  type PieceSupply,
} from './piece-supply'

export {
  addUpgrade,
  canAddUpgrade,
  createInitialMothershipState,
  getUpgradeCount,
  isValidMothershipState,
  type MothershipState,
} from './mothership'

export {
  addResourceInventories,
  createEmptyResourceInventory,
  createResourceInventory,
  getResourceRole,
  getResourceTypeForRole,
  getTotalResourceCount,
  GOODS_RESOURCE_TYPE,
  hasAtLeastResources,
  isValidResourceInventory,
  RESOURCE_ROLES,
  RESOURCE_TYPES,
  subtractResourceInventories,
  type ResourceInventory,
  type ResourceRole,
  type ResourceType,
} from './resources'

export type { DomainResult, DomainValidationError } from './result'

export { createPlayer, type CreatePlayerInput, type Player } from './player'
