export { asMatchId, type MatchId } from './match-id'

export { NORMAL_TURN_PHASE_ORDER, TURN_PHASES, isTurnPhase, type TurnPhase } from './turn-phase'

export {
  addToSupply,
  createReservePile,
  createResourceSupply,
  deductFromSupply,
  drawFromReserve,
  DEFAULT_INITIAL_SUPPLY_QUANTITY,
  getReserveCount,
  isReserveEmpty,
  isValidResourceSupply,
  supplyHasAtLeast,
  type ReserveDrawResult,
  type ReservePile,
  type ResourceSupply,
} from './resource-bank'

export type {
  ColonyEstablishedEvent,
  DiceRolledEvent,
  MatchEvent,
  MatchWonEvent,
  MothershipUpgradedEvent,
  PieceSupplyChangedEvent,
  PlanetProducedEvent,
  PlanetarySystemExploredEvent,
  ProductionResolvedEvent,
  ReserveCardsDrawnEvent,
  ResourceShortageEvent,
  ResourceStolenEvent,
  ResourcesDiscardedEvent,
  ResourcesGrantedEvent,
  ResourcesSpentEvent,
  SevenResolvedEvent,
  SevenRolledEvent,
  ShipBuiltEvent,
  SpaceportBuiltEvent,
  TradeStationEstablishedEvent,
  TurnEndedEvent,
  TurnStartedEvent,
  VictoryPointsChangedEvent,
} from './match-events'

export {
  getActivePlayer,
  getPlayer,
  getShip,
  getShipAt,
  getStructureAt,
  isIntersectionOccupied,
  listAllStructures,
  listOpponentsFromLeft,
  listPlayerShips,
  listPlayerSiteStructures,
  listPlayerStructures,
  listPlayerTradeStations,
  listShips,
  listSiteStructures,
  listTradeStations,
  type DiceResult,
  type Match,
  type MatchStatus,
} from './match'

export { rollTwoDice } from './dice'

export {
  getPlayerGrant,
  getProductionDemand,
  getShortResources,
  type ProductionDemand,
} from './production'

export {
  advanceToFlightPhase,
  beginTurn,
  endTurn,
  resolveProduction,
  rollDice,
} from './turn-transitions'

export {
  computeRequiredDiscardCount,
  computeRequiredDiscardForInventory,
  type SevenDiscardRequirement,
  type SevenDiscardingState,
  type SevenDrawingState,
  type SevenSelectingTargetState,
  type SevenState,
} from './seven-state'

export {
  completeSeven,
  getEligibleStealTargets,
  getPendingDiscardPlayers,
  getRequiredDiscardCount,
  isSevenComplete,
  resolveOpponentReserveDraws,
  skipSteal,
  startSeven,
  stealResource,
  submitSevenDiscard,
} from './seven-transitions'

export {
  buildMothershipUpgrade,
  buildShip,
  buildSpaceport,
  canAffordBuild,
  getAvailableSpaceportSites,
  getUpgradeableColonies,
  validateMothershipUpgrade,
  validateShipBuild,
  validateSpaceportBuild,
} from './construction'
