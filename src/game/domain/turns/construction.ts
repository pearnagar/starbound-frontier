import {
  createBoardTopology,
  getAdjacentBoardVertexIds,
  getSectorsAdjacentToVertex,
  isBoardEdge,
  isBoardVertex,
  type BoardTopology,
} from '../board/board-topology'
import { getEdgeVertices, type EdgeId } from '../board/edge'
import type { VertexId } from '../board/vertex'
import { createStructure, type Structure } from '../buildings/structure'
import { createTradeRoute, type TradeRoute } from '../routes/trade-route'
import type { PlayerId } from '../types/ids'
import type { PieceSupply } from '../types/piece-supply'
import {
  createEmptyResourceInventory,
  RESOURCE_TYPES,
  type ResourceInventory,
} from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import { canAffordCost, getBuildCost, type ConstructionAction } from './construction-config'
import type { Match } from './match'
import type { MatchEvent } from './match-events'
import { addToBank } from './resource-bank'

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

function appendEvent(match: Match, buildEvent: (sequence: number) => MatchEvent): Match {
  const sequence = match.eventSequence + 1
  const event = buildEvent(sequence)
  return { ...match, events: [...match.events, event], eventSequence: sequence }
}

/** Shared preconditions for every construction action. */
function checkConstructionAllowed(match: Match, playerId: PlayerId): DomainResult<null> {
  if (match.status !== 'inProgress') {
    return failure('MATCH_NOT_IN_PROGRESS', 'The match is not in progress.', 'status')
  }
  if (match.phase !== 'build') {
    return failure(
      'WRONG_PHASE',
      `Construction requires the "build" phase, but the match is in "${match.phase}".`,
      'phase',
    )
  }
  if (match.activePlayerId !== playerId) {
    return failure('WRONG_ACTIVE_PLAYER', 'It is not this player’s turn.', 'playerId')
  }
  if (match.crisisState !== undefined) {
    return failure(
      'CRISIS_UNRESOLVED',
      'Construction cannot occur while a crisis is unresolved.',
      'crisisState',
    )
  }
  return { success: true, value: null }
}

function getPlayerResources(match: Match, playerId: PlayerId): ResourceInventory {
  return match.playersById[playerId]?.resources ?? createEmptyResourceInventory()
}

export function canAffordBuild(resources: ResourceInventory, action: ConstructionAction): boolean {
  return canAffordCost(resources, getBuildCost(action))
}

/**
 * Deducts `action`'s cost from `playerId`'s resources and returns those
 * resources to the bank, emitting `ResourcesSpent`. Callers must have already
 * validated affordability — this is the atomic apply step, not the check.
 */
function spendForConstruction(match: Match, playerId: PlayerId, action: ConstructionAction): Match {
  const cost = getBuildCost(action)
  const player = match.playersById[playerId]
  if (player === undefined) {
    return match
  }
  const resources: Record<string, number> = { ...player.resources }
  for (const type of RESOURCE_TYPES) {
    resources[type] = player.resources[type] - cost[type]
  }
  const playersById = {
    ...match.playersById,
    [playerId]: { ...player, resources: resources as ResourceInventory },
  }
  const bank = addToBank(match.bank, cost)

  return appendEvent({ ...match, playersById, bank }, (sequence) => ({
    sequence,
    type: 'ResourcesSpent',
    playerId,
    action,
    spent: cost,
  }))
}

function applyPieceSupplyChange(match: Match, playerId: PlayerId, nextSupply: PieceSupply): Match {
  const player = match.playersById[playerId]
  if (player === undefined) {
    return match
  }
  const playersById = { ...match.playersById, [playerId]: { ...player, pieceSupply: nextSupply } }
  return appendEvent({ ...match, playersById }, (sequence) => ({
    sequence,
    type: 'PieceSupplyChanged',
    playerId,
    pieceSupply: nextSupply,
  }))
}

function topologyFor(match: Match): BoardTopology {
  return createBoardTopology(match.board)
}

// ---------------------------------------------------------------------------
// Trade routes
// ---------------------------------------------------------------------------

/**
 * True when `vertexId` establishes connectivity for `playerId`: a
 * player-owned structure sits there, or a player-owned route touches it and
 * the corner is not occupied by an opponent's structure.
 */
function vertexEstablishesConnectivity(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): boolean {
  const structure = match.structures[vertexId]
  if (structure !== undefined) {
    return structure.ownerId === playerId
  }
  return Object.values(match.routes).some(
    (route) => route.ownerId === playerId && getEdgeVertices(route.edgeId).includes(vertexId),
  )
}

function checkTradeRoutePlaceable(
  match: Match,
  topology: BoardTopology,
  playerId: PlayerId,
  edgeId: EdgeId,
): DomainResult<null> {
  if (!isBoardEdge(topology, edgeId)) {
    return failure('EDGE_NOT_ON_BOARD', 'That edge is not part of the board.', 'edgeId')
  }
  if (match.routes[edgeId] !== undefined) {
    return failure('EDGE_OCCUPIED', 'That edge already holds a trade route.', 'edgeId')
  }
  const [a, b] = getEdgeVertices(edgeId)
  const connected =
    vertexEstablishesConnectivity(match, playerId, a) ||
    vertexEstablishesConnectivity(match, playerId, b)
  if (!connected) {
    return failure(
      'ROUTE_NOT_CONNECTED',
      'A trade route must connect to your existing network or a structure you own.',
      'edgeId',
    )
  }
  if (match.playersById[playerId]?.pieceSupply.tradeRoutes === 0) {
    return failure('NO_TRADE_ROUTES_REMAINING', 'No trade routes remain in supply.', 'pieceSupply')
  }
  if (!canAffordBuild(getPlayerResources(match, playerId), 'tradeRoute')) {
    return failure(
      'INSUFFICIENT_RESOURCES',
      'Not enough resources to build a trade route.',
      'resources',
    )
  }
  return { success: true, value: null }
}

export function validateTradeRouteBuild(
  match: Match,
  playerId: PlayerId,
  edgeId: EdgeId,
): DomainResult<null> {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return allowed
  }
  return checkTradeRoutePlaceable(match, topologyFor(match), playerId, edgeId)
}

export function getLegalTradeRouteEdges(match: Match, playerId: PlayerId): readonly EdgeId[] {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return []
  }
  const topology = topologyFor(match)
  return topology.edgeIds.filter(
    (edgeId) => checkTradeRoutePlaceable(match, topology, playerId, edgeId).success,
  )
}

export function buildTradeRoute(
  match: Match,
  playerId: PlayerId,
  edgeId: EdgeId,
): DomainResult<Match> {
  const validation = validateTradeRouteBuild(match, playerId, edgeId)
  if (!validation.success) {
    return validation
  }

  const spent = spendForConstruction(match, playerId, 'tradeRoute')
  const route: TradeRoute = createTradeRoute(edgeId, playerId)
  const withRoute = appendEvent(
    { ...spent, routes: { ...spent.routes, [edgeId]: route } },
    (sequence) => ({ sequence, type: 'TradeRouteBuilt', playerId, edgeId }),
  )

  const player = withRoute.playersById[playerId]
  if (player === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'playerId')
  }
  const nextSupply: PieceSupply = {
    ...player.pieceSupply,
    tradeRoutes: player.pieceSupply.tradeRoutes - 1,
  }

  return { success: true, value: applyPieceSupplyChange(withRoute, playerId, nextSupply) }
}

// ---------------------------------------------------------------------------
// Outposts
// ---------------------------------------------------------------------------

function touchesVisibleSector(topology: BoardTopology, vertexId: VertexId): boolean {
  return getSectorsAdjacentToVertex(topology, vertexId).some(
    (sector) => sector.visibility === 'visible',
  )
}

function touchesPlayerRoute(match: Match, playerId: PlayerId, vertexId: VertexId): boolean {
  return Object.values(match.routes).some(
    (route) => route.ownerId === playerId && getEdgeVertices(route.edgeId).includes(vertexId),
  )
}

function checkOutpostPlaceable(
  match: Match,
  topology: BoardTopology,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  if (!isBoardVertex(topology, vertexId)) {
    return failure('VERTEX_NOT_ON_BOARD', 'That corner is not part of the board.', 'vertexId')
  }
  if (match.structures[vertexId] !== undefined) {
    return failure('VERTEX_OCCUPIED', 'That corner already holds a structure.', 'vertexId')
  }
  const blocked = getAdjacentBoardVertexIds(topology, vertexId).some(
    (neighbour) => match.structures[neighbour] !== undefined,
  )
  if (blocked) {
    return failure(
      'ADJACENT_STRUCTURE_BLOCKED',
      'A structure already sits on a directly connected corner.',
      'vertexId',
    )
  }
  if (!touchesVisibleSector(topology, vertexId)) {
    return failure(
      'HIDDEN_ONLY_VERTEX',
      'An outpost must touch at least one visible sector.',
      'vertexId',
    )
  }
  if (!touchesPlayerRoute(match, playerId, vertexId)) {
    return failure(
      'OUTPOST_NOT_CONNECTED',
      'An outpost must connect to one of your existing trade routes.',
      'vertexId',
    )
  }
  if (match.playersById[playerId]?.pieceSupply.outposts === 0) {
    return failure('NO_OUTPOSTS_REMAINING', 'No outposts remain in supply.', 'pieceSupply')
  }
  if (!canAffordBuild(getPlayerResources(match, playerId), 'outpost')) {
    return failure(
      'INSUFFICIENT_RESOURCES',
      'Not enough resources to build an outpost.',
      'resources',
    )
  }
  return { success: true, value: null }
}

export function validateOutpostBuild(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return allowed
  }
  return checkOutpostPlaceable(match, topologyFor(match), playerId, vertexId)
}

export function getLegalOutpostVertices(match: Match, playerId: PlayerId): readonly VertexId[] {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return []
  }
  const topology = topologyFor(match)
  return topology.vertexIds.filter(
    (vertexId) => checkOutpostPlaceable(match, topology, playerId, vertexId).success,
  )
}

export function buildOutpost(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<Match> {
  const validation = validateOutpostBuild(match, playerId, vertexId)
  if (!validation.success) {
    return validation
  }

  const spent = spendForConstruction(match, playerId, 'outpost')
  const structure: Structure = createStructure('outpost', vertexId, playerId)
  const withStructure = appendEvent(
    { ...spent, structures: { ...spent.structures, [vertexId]: structure } },
    (sequence) => ({ sequence, type: 'OutpostBuilt', playerId, vertexId }),
  )

  const player = withStructure.playersById[playerId]
  if (player === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'playerId')
  }
  const nextSupply: PieceSupply = {
    ...player.pieceSupply,
    outposts: player.pieceSupply.outposts - 1,
  }

  return { success: true, value: applyPieceSupplyChange(withStructure, playerId, nextSupply) }
}

// ---------------------------------------------------------------------------
// Colony upgrade
// ---------------------------------------------------------------------------

function checkColonyUpgrade(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const structure = match.structures[vertexId]
  if (structure === undefined) {
    return failure('UPGRADE_TARGET_MISSING', 'No structure exists at that corner.', 'vertexId')
  }
  if (structure.type !== 'outpost') {
    return failure(
      'WRONG_STRUCTURE_TYPE',
      'Only an Outpost can be upgraded to a Colony.',
      'vertexId',
    )
  }
  if (structure.ownerId !== playerId) {
    return failure('NOT_YOUR_STRUCTURE', 'You do not own the Outpost at that corner.', 'vertexId')
  }
  if (match.playersById[playerId]?.pieceSupply.colonies === 0) {
    return failure('NO_COLONIES_REMAINING', 'No Colony pieces remain in supply.', 'pieceSupply')
  }
  if (!canAffordBuild(getPlayerResources(match, playerId), 'colony')) {
    return failure(
      'INSUFFICIENT_RESOURCES',
      'Not enough resources to upgrade to a Colony.',
      'resources',
    )
  }
  return { success: true, value: null }
}

export function validateColonyUpgrade(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return allowed
  }
  return checkColonyUpgrade(match, playerId, vertexId)
}

export function upgradeToColony(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<Match> {
  const validation = validateColonyUpgrade(match, playerId, vertexId)
  if (!validation.success) {
    return validation
  }

  const spent = spendForConstruction(match, playerId, 'colony')
  const structure: Structure = createStructure('colony', vertexId, playerId)
  const withStructure = appendEvent(
    { ...spent, structures: { ...spent.structures, [vertexId]: structure } },
    (sequence) => ({ sequence, type: 'ColonyUpgraded', playerId, vertexId }),
  )

  const player = withStructure.playersById[playerId]
  if (player === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'playerId')
  }
  const nextSupply: PieceSupply = {
    ...player.pieceSupply,
    colonies: player.pieceSupply.colonies - 1,
    outposts: player.pieceSupply.outposts + 1,
  }

  return { success: true, value: applyPieceSupplyChange(withStructure, playerId, nextSupply) }
}

// ---------------------------------------------------------------------------
// Nexus upgrade
// ---------------------------------------------------------------------------

function checkNexusUpgrade(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const structure = match.structures[vertexId]
  if (structure === undefined) {
    return failure('UPGRADE_TARGET_MISSING', 'No structure exists at that corner.', 'vertexId')
  }
  if (structure.type !== 'colony') {
    return failure('WRONG_STRUCTURE_TYPE', 'Only a Colony can be upgraded to a Nexus.', 'vertexId')
  }
  if (structure.ownerId !== playerId) {
    return failure('NOT_YOUR_STRUCTURE', 'You do not own the Colony at that corner.', 'vertexId')
  }
  if (match.playersById[playerId]?.pieceSupply.nexus === 0) {
    return failure('NO_NEXUS_REMAINING', 'No Nexus pieces remain in supply.', 'pieceSupply')
  }
  if (!canAffordBuild(getPlayerResources(match, playerId), 'nexus')) {
    return failure(
      'INSUFFICIENT_RESOURCES',
      'Not enough resources to upgrade to a Nexus.',
      'resources',
    )
  }
  return { success: true, value: null }
}

export function validateNexusUpgrade(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<null> {
  const allowed = checkConstructionAllowed(match, playerId)
  if (!allowed.success) {
    return allowed
  }
  return checkNexusUpgrade(match, playerId, vertexId)
}

export function upgradeToNexus(
  match: Match,
  playerId: PlayerId,
  vertexId: VertexId,
): DomainResult<Match> {
  const validation = validateNexusUpgrade(match, playerId, vertexId)
  if (!validation.success) {
    return validation
  }

  const spent = spendForConstruction(match, playerId, 'nexus')
  const structure: Structure = createStructure('nexus', vertexId, playerId)
  const withStructure = appendEvent(
    { ...spent, structures: { ...spent.structures, [vertexId]: structure } },
    (sequence) => ({ sequence, type: 'NexusUpgraded', playerId, vertexId }),
  )

  const player = withStructure.playersById[playerId]
  if (player === undefined) {
    return failure('PLAYER_NOT_FOUND', 'No player found for this id.', 'playerId')
  }
  const nextSupply: PieceSupply = {
    ...player.pieceSupply,
    nexus: player.pieceSupply.nexus - 1,
    colonies: player.pieceSupply.colonies + 1,
  }

  return { success: true, value: applyPieceSupplyChange(withStructure, playerId, nextSupply) }
}

// ---------------------------------------------------------------------------
// Bank-trade rate
// ---------------------------------------------------------------------------

/**
 * A player's future bank-trade rate: 3:1 once they own at least one Nexus,
 * otherwise the standard 4:1. Derived from placed structures rather than
 * stored, so it can never drift out of sync with the board — bank-trading
 * execution itself belongs to a later milestone.
 */
export function getPlayerBankTradeRate(match: Match, playerId: PlayerId): number {
  const ownsNexus = Object.values(match.structures).some(
    (structure) => structure.ownerId === playerId && structure.type === 'nexus',
  )
  return ownsNexus ? 3 : 4
}
