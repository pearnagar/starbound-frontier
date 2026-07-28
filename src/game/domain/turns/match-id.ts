import type { Brand } from '../types/brand'

/** Externally supplied identifier for a match. The domain never generates one. */
export type MatchId = Brand<string, 'MatchId'>

// Plain nominal-typing brand cast, not a validating constructor — matches the
// existing PlayerId/CaptainId/FactionColorId convention.
export function asMatchId(value: string): MatchId {
  return value as MatchId
}
