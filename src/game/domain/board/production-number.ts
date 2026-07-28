/** Valid production values. 7 is deliberately excluded. */
export const PRODUCTION_NUMBERS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const

export type ProductionNumber = (typeof PRODUCTION_NUMBERS)[number]

/**
 * Values whose two-dice probability is highest. Two of these must not end up
 * on adjacent sectors, or that corner of the board dominates production.
 */
export const HIGH_PRODUCTION_NUMBERS = [6, 8] as const

/** Ways to roll each value with two six-sided dice, out of 36. */
const PRODUCTION_PROBABILITY_WEIGHTS: Record<ProductionNumber, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
}

export function isProductionNumber(value: number): value is ProductionNumber {
  return (PRODUCTION_NUMBERS as readonly number[]).includes(value)
}

export function isHighProductionNumber(value: ProductionNumber): boolean {
  return (HIGH_PRODUCTION_NUMBERS as readonly number[]).includes(value)
}

/** Relative likelihood of this value being rolled, for later UI display. */
export function getProductionProbabilityWeight(value: ProductionNumber): number {
  return PRODUCTION_PROBABILITY_WEIGHTS[value]
}
