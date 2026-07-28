import { getSupplyTradeRate } from '../rules/rules-config'
import type { PlayerId } from '../types/ids'
import type { Player } from '../types/player'
import {
  addResourceInventories,
  createResourceInventory,
  subtractResourceInventories,
  type ResourceType,
} from '../types/resources'
import type { DomainResult, DomainValidationError } from '../types/result'
import type { Match } from '../turns/match'
import { addToSupply, deductFromSupply, supplyHasAtLeast } from '../turns/resource-bank'

/**
 * Trading with the face-up Supply. The improved 2:1 rate belongs to the
 * goods-equivalent resource itself — no structure grants a better rate.
 *
 * Player-to-player trading is a separate milestone; the rule that only the
 * active player may finalize a deal is recorded in `docs/GAME_RULES.md` and
 * enforced when that system lands.
 */

function failure(code: string, message: string, field: string): DomainResult<never> {
  const error: DomainValidationError = { code, message, field }
  return { success: false, errors: [error] }
}

/** Cards of `given` needed to receive 1 card of another type. */
export function getTradeRateFor(resource: ResourceType): number {
  return getSupplyTradeRate(resource)
}

export function validateSupplyTrade(
  match: Match,
  playerId: PlayerId,
  given: ResourceType,
  received: ResourceType,
): DomainResult<null> {
  if (match.status !== 'inProgress') {
    return failure('MATCH_NOT_IN_PROGRESS', 'The match is not in progress.', 'status')
  }
  if (match.phase !== 'tradeAndBuild') {
    return failure('WRONG_PHASE', 'Trading is only allowed during Trade & Build.', 'phase')
  }
  if (match.activePlayerId !== playerId) {
    return failure(
      'WRONG_ACTIVE_PLAYER',
      'Only the active player may trade with the Supply.',
      'playerId',
    )
  }
  if (given === received) {
    return failure('INVALID_TRADE', 'The received resource must differ.', 'received')
  }

  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  const rate = getSupplyTradeRate(given)
  if (player.resources[given] < rate) {
    return failure(
      'INSUFFICIENT_RESOURCES',
      `That trade requires ${String(rate)} cards of the offered resource.`,
      'given',
    )
  }
  if (!supplyHasAtLeast(match.supply, received, 1)) {
    return failure('SUPPLY_EXHAUSTED', 'The Supply has none of that resource left.', 'received')
  }
  return { success: true, value: null }
}

/** Exchanges cards with the Supply at the rate for the offered resource. */
export function tradeWithSupply(
  match: Match,
  playerId: PlayerId,
  given: ResourceType,
  received: ResourceType,
): DomainResult<Match> {
  const validation = validateSupplyTrade(match, playerId, given, received)
  if (!validation.success) {
    return validation
  }
  const player = match.playersById[playerId]
  if (player === undefined) {
    return failure('UNKNOWN_PLAYER', 'No such player in this match.', 'playerId')
  }

  const rate = getSupplyTradeRate(given)
  const paid = createResourceInventory({ [given]: rate })
  const gained = createResourceInventory({ [received]: 1 })

  const updated: Player = {
    ...player,
    resources: addResourceInventories(subtractResourceInventories(player.resources, paid), gained),
  }

  return {
    success: true,
    value: {
      ...match,
      playersById: { ...match.playersById, [playerId]: updated },
      supply: deductFromSupply(addToSupply(match.supply, paid), gained),
    },
  }
}
