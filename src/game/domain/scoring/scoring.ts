import {
  FAME_MEDAL_PIECES_PER_POINT,
  VICTORY_POINT_TARGET,
  VICTORY_POINT_VALUES,
} from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import { listPlayerSiteStructures, type Match } from '../turns/match'

/**
 * Victory-point breakdown for one player. Structures score from the board;
 * Friendship Markers and cleared-hazard tokens are counted from awarded
 * tokens, which later milestones will populate (see
 * `docs/IMPLEMENTATION_PLAN.md`). Trade Stations never score directly.
 */
export type VictoryPointBreakdown = Readonly<{
  colonies: number
  spaceports: number
  friendshipMarkers: number
  defeatedPirateBases: number
  terraformedIcePlanets: number
  fameMedals: number
  total: number
}>

/**
 * Awards a player currently holds that are not derivable from board
 * structures. Supplied by the caller until the milestones that grant them
 * exist, so scoring never invents them.
 */
export type PlayerAwards = Readonly<{
  friendshipMarkerCount: number
  defeatedPirateBaseCount: number
  terraformedIcePlanetCount: number
}>

export const NO_AWARDS: PlayerAwards = {
  friendshipMarkerCount: 0,
  defeatedPirateBaseCount: 0,
  terraformedIcePlanetCount: 0,
}

/**
 * Computes a player's victory points. A Spaceport scores 2 in total and is
 * never counted as a Colony as well, because the upgraded site is stored as a
 * single Spaceport structure.
 */
export function getVictoryPointBreakdown(
  match: Match,
  playerId: PlayerId,
  awards: PlayerAwards = NO_AWARDS,
): VictoryPointBreakdown {
  const structures = listPlayerSiteStructures(match, playerId)
  const colonyCount = structures.filter((structure) => structure.type === 'colony').length
  const spaceportCount = structures.filter((structure) => structure.type === 'spaceport').length

  const player = match.playersById[playerId]
  const fameMedalPieces = player?.mothership.fameMedalPieces ?? 0

  const colonies = colonyCount * VICTORY_POINT_VALUES.colony
  const spaceports = spaceportCount * VICTORY_POINT_VALUES.spaceport
  const friendshipMarkers = awards.friendshipMarkerCount * VICTORY_POINT_VALUES.friendshipMarker
  const defeatedPirateBases =
    awards.defeatedPirateBaseCount * VICTORY_POINT_VALUES.defeatedPirateBase
  const terraformedIcePlanets =
    awards.terraformedIcePlanetCount * VICTORY_POINT_VALUES.terraformedIcePlanet
  const fameMedals =
    Math.floor(fameMedalPieces / FAME_MEDAL_PIECES_PER_POINT) * VICTORY_POINT_VALUES.fameMedalPair

  return {
    colonies,
    spaceports,
    friendshipMarkers,
    defeatedPirateBases,
    terraformedIcePlanets,
    fameMedals,
    total:
      colonies +
      spaceports +
      friendshipMarkers +
      defeatedPirateBases +
      terraformedIcePlanets +
      fameMedals,
  }
}

export function getVictoryPoints(
  match: Match,
  playerId: PlayerId,
  awards: PlayerAwards = NO_AWARDS,
): number {
  return getVictoryPointBreakdown(match, playerId, awards).total
}

/** Whether a total reaches the winning threshold. */
export function hasReachedVictoryTarget(victoryPoints: number): boolean {
  return victoryPoints >= VICTORY_POINT_TARGET
}

/**
 * The winner, if the active player has reached the target. The game ends only
 * on the holder's own turn, so no other player can win here.
 */
export function getWinner(match: Match): PlayerId | undefined {
  const active = match.playersById[match.activePlayerId]
  if (active === undefined) {
    return undefined
  }
  return hasReachedVictoryTarget(active.victoryPoints) ? active.id : undefined
}
