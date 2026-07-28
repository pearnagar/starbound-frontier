import { describe, expect, it } from 'vitest'
import { createInitialPieceSupply, isValidPieceSupply, type PieceSupply } from './piece-supply'

describe('createInitialPieceSupply', () => {
  it('matches the specified starting counts', () => {
    expect(createInitialPieceSupply()).toEqual({
      tradeRoutes: 15,
      outposts: 5,
      colonies: 4,
      nexus: 2,
    })
  })

  it('returns an independent object on each call', () => {
    const a = createInitialPieceSupply()
    const b = createInitialPieceSupply()
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })
})

describe('isValidPieceSupply', () => {
  it('accepts the initial supply', () => {
    expect(isValidPieceSupply(createInitialPieceSupply())).toBe(true)
  })

  it('rejects a negative quantity', () => {
    const supply: PieceSupply = { tradeRoutes: -1, outposts: 5, colonies: 4, nexus: 2 }
    expect(isValidPieceSupply(supply)).toBe(false)
  })

  it('rejects a fractional quantity', () => {
    const supply: PieceSupply = { tradeRoutes: 15, outposts: 5.5, colonies: 4, nexus: 2 }
    expect(isValidPieceSupply(supply)).toBe(false)
  })
})
