import {
  createResourceInventory,
  GOODS_RESOURCE_TYPE,
  type ResourceInventory,
  type ResourceType,
} from '../types/resources'

/**
 * Single typed home for every tunable rule constant. Validators, transitions,
 * and future UI read from here rather than repeating literals, so a rule change
 * touches exactly one file.
 */

/** Victory points required to win, checked only on the holder's own turn. */
export const VICTORY_POINT_TARGET = 15

/** Starting position on the victory-point track (2 Colonies + 1 Spaceport). */
export const STARTING_VICTORY_POINTS = 4

/** Hand size above which a roll of 7 forces a discard. */
export const DISCARD_THRESHOLD = 7

/** Cards of each resource type placed into a freshly built Reserve pile. */
export const RESERVE_CARDS_PER_RESOURCE = 8

/** Cards each player draws from the Reserve pile during beginner setup. */
export const SETUP_RESERVE_DRAW_COUNT = 3

// --- Build actions -------------------------------------------------------

export const BUILD_ACTIONS = [
  'spaceport',
  'colonyShip',
  'tradeShip',
  'cannon',
  'freightPod',
  'booster',
] as const

export type BuildAction = (typeof BUILD_ACTIONS)[number]

const BUILD_COSTS: Readonly<Record<BuildAction, ResourceInventory>> = {
  // Spaceport upgrades an existing Colony: 3 carbon + 2 food.
  spaceport: createResourceInventory({ cryonite: 3, biofiber: 2 }),
  // Colony Ship: 1 ore + 1 fuel + 1 carbon + 1 food.
  colonyShip: createResourceInventory({ alloy: 1, plasma: 1, cryonite: 1, biofiber: 1 }),
  // Trade Ship: 1 ore + 1 fuel + 2 goods.
  tradeShip: createResourceInventory({ alloy: 1, plasma: 1, quantumCore: 2 }),
  // Mothership upgrades.
  cannon: createResourceInventory({ cryonite: 2 }),
  freightPod: createResourceInventory({ alloy: 2 }),
  booster: createResourceInventory({ plasma: 2 }),
}

export function getBuildCost(action: BuildAction): ResourceInventory {
  return BUILD_COSTS[action]
}

// --- Mothership upgrade limits -------------------------------------------

export const MOTHERSHIP_UPGRADE_KINDS = ['cannon', 'freightPod', 'booster'] as const

export type MothershipUpgradeKind = (typeof MOTHERSHIP_UPGRADE_KINDS)[number]

const MOTHERSHIP_UPGRADE_LIMITS: Readonly<Record<MothershipUpgradeKind, number>> = {
  cannon: 6,
  freightPod: 5,
  booster: 6,
}

export function getMothershipUpgradeLimit(kind: MothershipUpgradeKind): number {
  return MOTHERSHIP_UPGRADE_LIMITS[kind]
}

// --- Victory point values ------------------------------------------------

/**
 * Victory points awarded per scoring source. A Spaceport is worth 2 in total,
 * inclusive of the Colony it upgrades — scoring counts a Spaceport once at 2,
 * never a Colony plus a Spaceport for the same site.
 */
export const VICTORY_POINT_VALUES = {
  colony: 1,
  spaceport: 2,
  friendshipMarker: 2,
  defeatedPirateBase: 1,
  terraformedIcePlanet: 1,
  /** A complete pair of Fame Medal pieces scores 1. */
  fameMedalPair: 1,
} as const

/** Fame Medal pieces required to form one scoring medal. */
export const FAME_MEDAL_PIECES_PER_POINT = 2

// --- Supply trade rates --------------------------------------------------

/** Identical cards returned to the Supply for 1 card of choice. */
export const STANDARD_SUPPLY_TRADE_RATE = 3

/** The goods-equivalent resource trades at a better rate. */
export const GOODS_SUPPLY_TRADE_RATE = 2

/**
 * Cards of `resource` that must be returned to the Supply to receive 1 other
 * resource. The improved rate comes from the resource itself, never from an
 * owned structure.
 */
export function getSupplyTradeRate(resource: ResourceType): number {
  return resource === GOODS_RESOURCE_TYPE ? GOODS_SUPPLY_TRADE_RATE : STANDARD_SUPPLY_TRADE_RATE
}

// --- Reserve pile entitlement -------------------------------------------

/**
 * Cards the active player draws from the Reserve pile after an ordinary
 * production roll, by current victory points. Ranges are inclusive; 10+ draws
 * nothing.
 */
const RESERVE_DRAW_TIERS: readonly Readonly<{
  minVictoryPoints: number
  maxVictoryPoints: number
  cards: number
}>[] = [
  { minVictoryPoints: 4, maxVictoryPoints: 7, cards: 2 },
  { minVictoryPoints: 8, maxVictoryPoints: 9, cards: 1 },
]

export function getReserveDrawEntitlement(victoryPoints: number): number {
  for (const tier of RESERVE_DRAW_TIERS) {
    if (victoryPoints >= tier.minVictoryPoints && victoryPoints <= tier.maxVictoryPoints) {
      return tier.cards
    }
  }
  // Below the starting total no tier applies, and 10+ earns nothing.
  return victoryPoints < 4 ? 2 : 0
}
