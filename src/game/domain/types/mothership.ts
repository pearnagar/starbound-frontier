import { getMothershipUpgradeLimit, type MothershipUpgradeKind } from '../rules/rules-config'

/**
 * Per-player Mothership state. Upgrade counts and Fame Medal pieces only —
 * the physical speed-ball mechanism and encounters are deliberately absent
 * (see `docs/IMPLEMENTATION_PLAN.md`).
 */
export type MothershipState = Readonly<{
  boosters: number
  cannons: number
  freightPods: number
  /** Loose Fame Medal pieces; two pieces score 1 victory point. */
  fameMedalPieces: number
}>

export function createInitialMothershipState(): MothershipState {
  return { boosters: 1, cannons: 0, freightPods: 0, fameMedalPieces: 1 }
}

export function isValidMothershipState(state: MothershipState): boolean {
  const counts = [state.boosters, state.cannons, state.freightPods, state.fameMedalPieces]
  if (!counts.every((value) => Number.isInteger(value) && value >= 0)) {
    return false
  }
  return (
    state.boosters <= getMothershipUpgradeLimit('booster') &&
    state.cannons <= getMothershipUpgradeLimit('cannon') &&
    state.freightPods <= getMothershipUpgradeLimit('freightPod')
  )
}

const UPGRADE_FIELD: Readonly<Record<MothershipUpgradeKind, keyof MothershipState>> = {
  booster: 'boosters',
  cannon: 'cannons',
  freightPod: 'freightPods',
}

export function getUpgradeCount(state: MothershipState, kind: MothershipUpgradeKind): number {
  return state[UPGRADE_FIELD[kind]]
}

/** Whether another upgrade of this kind may still be attached. */
export function canAddUpgrade(state: MothershipState, kind: MothershipUpgradeKind): boolean {
  return getUpgradeCount(state, kind) < getMothershipUpgradeLimit(kind)
}

export function addUpgrade(state: MothershipState, kind: MothershipUpgradeKind): MothershipState {
  if (!canAddUpgrade(state, kind)) {
    return state
  }
  const field = UPGRADE_FIELD[kind]
  return { ...state, [field]: state[field] + 1 }
}
