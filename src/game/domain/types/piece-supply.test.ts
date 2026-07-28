import { describe, expect, it } from 'vitest'
import {
  adjustPieceSupply,
  createInitialPieceSupply,
  hasPieces,
  isValidPieceSupply,
  PIECE_SUPPLY_KEYS,
} from './piece-supply'

describe('initial piece supply', () => {
  it('provides 9 Colonies, 7 Trade Stations, 3 Transport Ships, and 3 Shipyards', () => {
    expect(createInitialPieceSupply()).toEqual({
      colonies: 9,
      tradeStations: 7,
      transportShips: 3,
      shipyards: 3,
    })
  })

  it('no longer tracks trade routes, outposts, or a nexus', () => {
    expect(PIECE_SUPPLY_KEYS).toEqual(['colonies', 'tradeStations', 'transportShips', 'shipyards'])
    expect(PIECE_SUPPLY_KEYS).not.toContain('tradeRoutes')
    expect(PIECE_SUPPLY_KEYS).not.toContain('outposts')
    expect(PIECE_SUPPLY_KEYS).not.toContain('nexus')
  })

  it('returns an independent object each time', () => {
    const first = createInitialPieceSupply()
    const second = createInitialPieceSupply()
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })
})

describe('piece supply validation', () => {
  it('accepts non-negative integers', () => {
    expect(isValidPieceSupply(createInitialPieceSupply())).toBe(true)
  })

  it('rejects negative or fractional counts', () => {
    expect(isValidPieceSupply({ ...createInitialPieceSupply(), colonies: -1 })).toBe(false)
    expect(isValidPieceSupply({ ...createInitialPieceSupply(), shipyards: 1.5 })).toBe(false)
  })
})

describe('piece availability', () => {
  it('reports whether the required pieces remain', () => {
    const supply = createInitialPieceSupply()
    expect(hasPieces(supply, { transportShips: 3 })).toBe(true)
    expect(hasPieces(supply, { transportShips: 4 })).toBe(false)
    expect(hasPieces(supply, { transportShips: 1, colonies: 1 })).toBe(true)
  })

  it('treats omitted kinds as requiring none', () => {
    expect(hasPieces({ colonies: 0, tradeStations: 0, transportShips: 0, shipyards: 0 }, {})).toBe(
      true,
    )
  })
})

describe('piece supply adjustment', () => {
  it('applies signed deltas without mutating the input', () => {
    const supply = createInitialPieceSupply()
    const after = adjustPieceSupply(supply, { transportShips: -1, colonies: -1 })

    expect(after.transportShips).toBe(2)
    expect(after.colonies).toBe(8)
    expect(supply.transportShips).toBe(3)
  })

  it('returns pieces to supply on a positive delta', () => {
    const supply = adjustPieceSupply(createInitialPieceSupply(), { transportShips: -2 })
    expect(adjustPieceSupply(supply, { transportShips: 1 }).transportShips).toBe(2)
  })

  it('clamps at zero rather than going negative', () => {
    expect(adjustPieceSupply(createInitialPieceSupply(), { shipyards: -99 }).shipyards).toBe(0)
  })
})
