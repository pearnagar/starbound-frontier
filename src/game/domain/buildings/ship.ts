import type { IntersectionId } from '../board/space-board'
import type { Brand } from '../types/brand'
import type { PlayerId } from '../types/ids'

/**
 * Mobile pieces. Each is a Transport Ship combined with the piece it will
 * eventually leave behind: a Colony Ship carries a Colony, a Trade Ship
 * carries a Trade Station. Establishing either returns the Transport Ship to
 * supply and leaves the carried piece on the board.
 */
export const SHIP_TYPES = ['colonyShip', 'tradeShip'] as const

export type ShipType = (typeof SHIP_TYPES)[number]

export type ShipId = Brand<string, 'ShipId'>

export function asShipId(value: string): ShipId {
  return value as ShipId
}

export type Ship = Readonly<{
  id: ShipId
  type: ShipType
  ownerId: PlayerId
  /** Where the ship currently sits in the flight graph. */
  intersectionId: IntersectionId
  /**
   * True for a ship built this turn. Both ship types may move during the
   * Flight Phase of the turn they were built, so this is informational rather
   * than a restriction — movement itself is a later milestone.
   */
  builtThisTurn: boolean
}>

export function createShip(
  id: ShipId,
  type: ShipType,
  ownerId: PlayerId,
  intersectionId: IntersectionId,
  builtThisTurn = true,
): Ship {
  return { id, type, ownerId, intersectionId, builtThisTurn }
}

/** The piece kind a ship leaves behind when it establishes. */
export function getCarriedPieceKind(type: ShipType): 'colonies' | 'tradeStations' {
  return type === 'colonyShip' ? 'colonies' : 'tradeStations'
}
