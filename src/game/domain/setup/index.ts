export {
  createInitialSetupState,
  getActiveSetupPlayer,
  getCompletedSetupPairs,
  getOutpostAt,
  getRouteAt,
  getSetupPlacementOrder,
  isSetupComplete,
  listOutposts,
  listRoutes,
  SETUP_PAIRS_PER_PLAYER,
  type SetupExpectation,
  type SetupState,
} from './setup-state'

export {
  getLegalSetupOutpostVertices,
  getLegalSetupRouteEdges,
  getSetupResourceGrantForVertex,
  placeSetupOutpost,
  placeSetupRoute,
  validateSetupOutpostPlacement,
  validateSetupRoutePlacement,
  type SetupResourceGrant,
  type SetupRoutePlacement,
} from './setup-placement'
