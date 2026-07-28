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
