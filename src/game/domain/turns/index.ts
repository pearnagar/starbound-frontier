export { asMatchId, type MatchId } from './match-id'

export { TURN_PHASES, isTurnPhase, type TurnPhase } from './turn-phase'

export {
  DEFAULT_INITIAL_BANK_QUANTITY,
  bankHasAtLeast,
  createResourceBank,
  deductFromBank,
  isValidResourceBank,
  type ResourceBank,
} from './resource-bank'

export type {
  DiceRolledEvent,
  MatchEvent,
  ProductionResolvedEvent,
  ResourceShortageEvent,
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
