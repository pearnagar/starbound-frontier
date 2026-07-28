export { asMatchId, type MatchId } from './match-id'

export { TURN_PHASES, isTurnPhase, type TurnPhase } from './turn-phase'

export {
  DEFAULT_INITIAL_BANK_QUANTITY,
  addToBank,
  bankHasAtLeast,
  createResourceBank,
  deductFromBank,
  isValidResourceBank,
  type ResourceBank,
} from './resource-bank'

export type {
  CrisisCompletedEvent,
  CrisisStartedEvent,
  DiceRolledEvent,
  MarauderMovedEvent,
  MatchEvent,
  ProductionBlockedByMarauderEvent,
  ProductionResolvedEvent,
  ResourceShortageEvent,
  ResourceStolenEvent,
  ResourcesDiscardedEvent,
  ResourcesGrantedEvent,
  SectorProducedEvent,
  TurnEndedEvent,
  TurnStartedEvent,
} from './match-events'

export {
  getActivePlayer,
  getPlayer,
  listMatchOutposts,
  listMatchRoutes,
  type DiceResult,
  type Match,
  type MatchStatus,
} from './match'

export {
  createMatchFromCompletedSetup,
  type CreateMatchFromCompletedSetupInput,
} from './match-initialization'

export { rollTwoDice } from './dice'

export {
  getPlayerGrant,
  getProductionDemand,
  getShortResources,
  type ProductionDemand,
} from './production'

export {
  advanceToBuildPhase,
  advanceToTradePhase,
  beginTurn,
  endTurn,
  resolveProduction,
  rollDice,
} from './turn-transitions'

export {
  computeRequiredDiscardCount,
  type CrisisDiscardRequirement,
  type CrisisDiscardingState,
  type CrisisMovingMarauderState,
  type CrisisSelectingStealTargetState,
  type CrisisState,
  type CrisisStealingState,
} from './crisis-state'

export {
  completeCrisis,
  getEligibleStealTargets,
  getLegalMarauderDestinations,
  getPendingDiscardPlayers,
  getRequiredDiscardCount,
  isCrisisComplete,
  moveMarauder,
  startCrisis,
  stealCrisisResource,
  submitCrisisDiscard,
} from './crisis-transitions'
