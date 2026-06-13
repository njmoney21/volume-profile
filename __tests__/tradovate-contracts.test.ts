import { describe, it, expect } from 'vitest'
import { getPointValue } from '@/lib/tradovate/contracts'

describe('getPointValue', () => {
  it('returns $20/point for NQ contracts', () => {
    expect(getPointValue('NQZ5')).toBe(20)
    expect(getPointValue('NQM6')).toBe(20)
  })

  it('returns $2/point for MNQ contracts', () => {
    expect(getPointValue('MNQZ5')).toBe(2)
  })

  it('returns null for unknown symbols', () => {
    expect(getPointValue('ESZ5')).toBeNull()
    expect(getPointValue('')).toBeNull()
  })
})
