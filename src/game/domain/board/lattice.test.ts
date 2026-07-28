import { describe, expect, it } from 'vitest'
import {
  addLatticePoints,
  hexCentreLatticePoint,
  latticePointKey,
  latticePointsEqual,
  parseLatticePointKey,
  subtractLatticePoints,
} from './lattice'
import { areVerticesConnected, getVertexPoint, type VertexId } from './vertex'

describe('lattice arithmetic', () => {
  it('places hex centres at three times their cube coordinate', () => {
    expect(hexCentreLatticePoint({ q: 0, r: 0 })).toEqual({ x: 0, y: 0, z: 0 })
    expect(hexCentreLatticePoint({ q: 1, r: -2 })).toEqual({ x: 3, y: 3, z: -6 })
  })

  it('adds and subtracts componentwise', () => {
    const a = { x: 1, y: 1, z: -2 }
    const b = { x: 2, y: -1, z: -1 }
    expect(addLatticePoints(a, b)).toEqual({ x: 3, y: 0, z: -3 })
    expect(subtractLatticePoints(a, a)).toEqual({ x: 0, y: 0, z: 0 })
    expect(latticePointsEqual(a, { x: 1, y: 1, z: -2 })).toBe(true)
    expect(latticePointsEqual(a, b)).toBe(false)
  })
})

describe('parseLatticePointKey', () => {
  it('round-trips a serialized point', () => {
    const point = { x: 4, y: -5, z: 1 }
    expect(parseLatticePointKey(latticePointKey(point))).toEqual(point)
  })

  it.each([
    ['too few components', '1,2'],
    ['too many components', '1,2,-3,4'],
    ['a non-numeric component', 'a,2,-2'],
    ['a fractional component', '1.5,2,-3.5'],
    ['an empty string', ''],
  ])('rejects %s', (_label, key) => {
    expect(parseLatticePointKey(key)).toBeUndefined()
  })
})

describe('malformed vertex ids', () => {
  it('rejects a key whose components do not sum to zero', () => {
    expect(getVertexPoint('1,1,1' as VertexId)).toBeUndefined()
  })

  it('rejects an unparseable key', () => {
    expect(getVertexPoint('not-a-point' as VertexId)).toBeUndefined()
  })

  it('never reports malformed corners as connected', () => {
    expect(areVerticesConnected('1,1,1' as VertexId, '2,-1,-1' as VertexId)).toBe(false)
    expect(areVerticesConnected('2,-1,-1' as VertexId, 'nonsense' as VertexId)).toBe(false)
  })
})
