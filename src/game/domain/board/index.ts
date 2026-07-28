export {
  areHexesAdjacent,
  createHexCoordinate,
  getHexDistance,
  getHexNeighbor,
  getHexNeighbors,
  getOppositeHexDirection,
  HEX_DIRECTIONS,
  hexCoordinateKey,
  hexCoordinatesEqual,
  isHexDirection,
  isValidHexCoordinate,
  tryGetHexNeighbor,
  type HexCoordinate,
  type HexDirection,
  type HexNeighbors,
} from './hex-coordinate'

export {
  addLatticePoints,
  CORNER_OFFSETS,
  hexCentreLatticePoint,
  latticePointKey,
  latticePointsEqual,
  parseLatticePointKey,
  subtractLatticePoints,
  type LatticePoint,
} from './lattice'

export {
  areVerticesConnected,
  getHexVertices,
  getVertexPoint,
  latticePointToVertexId,
  vertexIdKey,
  type HexVertices,
  type VertexId,
} from './vertex'

export {
  createEdgeId,
  doEdgesShareVertex,
  edgeHasVertex,
  edgeIdKey,
  getEdgeVertices,
  getHexEdges,
  type EdgeId,
  type HexEdges,
} from './edge'

export {
  BOARD_ORIGIN,
  createBoardCoordinates,
  createStandardBoardCoordinates,
  getBoardBoundaryCoordinates,
  getHexBoardSize,
  isBoardBoundaryCoordinate,
  STANDARD_BOARD_RADIUS,
} from './board-shape'

export {
  BASIC_PRODUCING_SECTOR_TYPES,
  isCentralStarSector,
  isProducingSectorType,
  isSectorHidden,
  PRODUCING_SECTOR_TYPES,
  SECTOR_TYPES,
  type ProducingSectorType,
  type Sector,
  type SectorType,
  type SectorVisibility,
} from './sector'

export {
  getProductionProbabilityWeight,
  HIGH_PRODUCTION_NUMBERS,
  isHighProductionNumber,
  isProductionNumber,
  PRODUCTION_NUMBERS,
  type ProductionNumber,
} from './production-number'

export {
  createStandardBoardConfiguration,
  getConfiguredBoardSize,
  getConfiguredProductionTokenTotal,
  getConfiguredSectorTotal,
  type BoardConfiguration,
} from './board-configuration'

export { getBoardSize, getSector, listSectors, type Board } from './board'

export { generateBoard } from './board-generation'

export { validateBoard } from './board-validation'
