import { describe, it, expect } from 'vitest'
import { calculatePnl, formatPnl, formatTime, formatDate } from '@/lib/utils'

describe('calculatePnl', () => {
  it('calculates long profit: +10 points = +$200 per contract', () => {
    expect(calculatePnl('long', 21000, 21010, 1)).toBe(200)
  })

  it('calculates long loss: -10 points = -$200', () => {
    expect(calculatePnl('long', 21010, 21000, 1)).toBe(-200)
  })

  it('calculates short profit: sell 21010, buy back 21000 = +$200', () => {
    expect(calculatePnl('short', 21010, 21000, 1)).toBe(200)
  })

  it('calculates short loss: sell 21000, buy back 21010 = -$200', () => {
    expect(calculatePnl('short', 21000, 21010, 1)).toBe(-200)
  })

  it('scales with multiple contracts: long +5 pts × 2 contracts = $200', () => {
    expect(calculatePnl('long', 21000, 21005, 2)).toBe(200)
  })

  it('handles tick precision: 0.25 points = $5', () => {
    expect(calculatePnl('long', 21000, 21000.25, 1)).toBe(5)
  })
})

describe('formatPnl', () => {
  it('formats positive with + prefix', () => {
    expect(formatPnl(200)).toBe('+$200.00')
  })

  it('formats negative with - prefix', () => {
    expect(formatPnl(-200)).toBe('-$200.00')
  })

  it('formats zero without sign', () => {
    expect(formatPnl(0)).toBe('$0.00')
  })
})

describe('formatTime', () => {
  it('trims seconds from time string', () => {
    expect(formatTime('09:30:00')).toBe('09:30')
  })
})

describe('formatDate', () => {
  it('formats ISO date to readable string', () => {
    expect(formatDate('2026-06-09')).toBe('Jun 9, 2026')
  })
})
