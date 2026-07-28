import {
  getIntersection,
  listIntersections,
  type IntersectionId,
  type SpaceBoard,
} from './space-board'

/**
 * Read-only queries over the intersection graph. Actual ship movement — speed,
 * blockades, encounters — is a later milestone; this layer only answers "what
 * is connected to what", which exploration and future flight both need.
 */

export function getAdjacentIntersectionIds(
  board: SpaceBoard,
  id: IntersectionId,
): readonly IntersectionId[] {
  return getIntersection(board, id)?.adjacentIntersectionIds ?? []
}

export function areIntersectionsAdjacent(
  board: SpaceBoard,
  from: IntersectionId,
  to: IntersectionId,
): boolean {
  return getAdjacentIntersectionIds(board, from).includes(to)
}

/**
 * Shortest number of intersection steps between two nodes, or `undefined` if
 * unreachable. Breadth-first over an unweighted graph, so the first time a node
 * is dequeued its distance is minimal.
 */
export function getIntersectionDistance(
  board: SpaceBoard,
  from: IntersectionId,
  to: IntersectionId,
): number | undefined {
  if (getIntersection(board, from) === undefined || getIntersection(board, to) === undefined) {
    return undefined
  }
  if (from === to) {
    return 0
  }

  const visited = new Set<string>([from])
  let frontier: IntersectionId[] = [from]
  let distance = 0

  while (frontier.length > 0) {
    distance += 1
    const next: IntersectionId[] = []
    for (const current of frontier) {
      for (const neighbour of getAdjacentIntersectionIds(board, current)) {
        if (visited.has(neighbour)) {
          continue
        }
        if (neighbour === to) {
          return distance
        }
        visited.add(neighbour)
        next.push(neighbour)
      }
    }
    frontier = next
  }

  return undefined
}

/** Every intersection reachable within `maxSteps`, excluding the origin. */
export function getIntersectionsWithinRange(
  board: SpaceBoard,
  from: IntersectionId,
  maxSteps: number,
): readonly IntersectionId[] {
  if (maxSteps <= 0 || getIntersection(board, from) === undefined) {
    return []
  }

  const visited = new Set<string>([from])
  const reached: IntersectionId[] = []
  let frontier: IntersectionId[] = [from]

  for (let step = 0; step < maxSteps; step += 1) {
    const next: IntersectionId[] = []
    for (const current of frontier) {
      for (const neighbour of getAdjacentIntersectionIds(board, current)) {
        if (visited.has(neighbour)) {
          continue
        }
        visited.add(neighbour)
        reached.push(neighbour)
        next.push(neighbour)
      }
    }
    if (next.length === 0) {
      break
    }
    frontier = next
  }

  return reached
}

/** Whether every intersection is reachable from `origin`. */
export function isGraphConnected(board: SpaceBoard, origin: IntersectionId): boolean {
  const total = listIntersections(board).length
  if (total === 0) {
    return true
  }
  if (getIntersection(board, origin) === undefined) {
    return false
  }
  return getIntersectionsWithinRange(board, origin, total).length === total - 1
}
