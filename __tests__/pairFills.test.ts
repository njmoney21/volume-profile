import { describe, it, expect } from 'vitest'
import { pairFillsIntoTrades, type RawFill } from '@/lib/tradovate/pairFills'

const NQ_POINT_VALUE = new Map([[1, 20]])

function fill(overrides: Partial<RawFill>): RawFill {
  return {
    id: 1,
    contractId: 1,
    timestamp: '2026-06-12T14:00:00.000Z',
    tradeDate: '2026-06-12',
    action: 'Buy',
    price: 21000,
    qty: 1,
    ...overrides,
  }
}

describe('pairFillsIntoTrades', () => {
  it('pairs a simple round trip into one draft trade', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      date: '2026-06-12',
      time_entered: '14:00:00',
      direction: 'long',
      position_size: 1,
      pnl: 200,
      result: 'win',
      level_type: null,
      level_price: null,
      prev_day_poc: null,
      prev_day_vah: null,
      prev_day_val: null,
      scenario: null,
      source: 'auto',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
  })

  it('handles a partial-fill exit (one entry, two exits)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 2, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
      fill({ id: 3, action: 'Sell', price: 21005, qty: 1, timestamp: '2026-06-12T14:20:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 300, // (21010-21000)*1*20 + (21005-21000)*1*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
    expect(fillAssignments.get(3)).toBe(0)
  })

  it('handles a scaled entry (two entries, one exit)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Buy', price: 21005, qty: 1, timestamp: '2026-06-12T14:05:00.000Z' }),
      fill({ id: 3, action: 'Sell', price: 21020, qty: 2, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 700, // (21020-21000)*1*20 + (21020-21005)*1*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
    expect(fillAssignments.get(3)).toBe(0)
  })

  it('handles a position reversal (exit closes long and opens short)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 2, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 3, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 400, // (21010-21000)*2*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
  })

  it('leaves a still-open position unassigned with no draft', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(0)
    expect(fillAssignments.get(1)).toBeNull()
  })

  it('handles a loss and a breakeven trade', () => {
    const lossFills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 20990, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]
    const { drafts: lossDrafts } = pairFillsIntoTrades(lossFills, NQ_POINT_VALUE)
    expect(lossDrafts[0]).toMatchObject({ pnl: -200, result: 'loss' })

    const beFills = [
      fill({ id: 1, action: 'Sell', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]
    const { drafts: beDrafts } = pairFillsIntoTrades(beFills, NQ_POINT_VALUE)
    expect(beDrafts[0]).toMatchObject({ direction: 'short', pnl: 0, result: 'breakeven' })
  })

  it('skips fills on contracts with no known point value', () => {
    const fills = [
      fill({ id: 1, contractId: 99, action: 'Buy', price: 4500, qty: 1 }),
      fill({ id: 2, contractId: 99, action: 'Sell', price: 4510, qty: 1 }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(0)
    expect(fillAssignments.has(1)).toBe(false)
    expect(fillAssignments.has(2)).toBe(false)
  })
})
