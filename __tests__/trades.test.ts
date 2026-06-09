import { describe, it, expect } from 'vitest'
import { filterTrades, sumPnl, winRate, avgWin, avgLoss, avgRR, prepareTradeData } from '@/lib/trades'
import type { Trade } from '@/types'

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: '1',
  date: '2026-06-09',
  time_entered: '10:00:00',
  direction: 'long',
  entry_price: 21000,
  exit_price: 21010,
  contracts: 1,
  level_type: 'POC',
  level_price: 21000,
  prev_day_poc: 21000,
  prev_day_vah: 21050,
  prev_day_val: 20950,
  scenario: 'retest_continue',
  pnl: 200,
  notes: null,
  source: 'manual',
  created_at: '2026-06-09T10:00:00Z',
  ...overrides,
})

describe('filterTrades', () => {
  const trades = [
    makeTrade({ id: '1', date: '2026-06-09', direction: 'long', level_type: 'POC', scenario: 'retest_continue' }),
    makeTrade({ id: '2', date: '2026-06-08', direction: 'short', level_type: 'VAH', scenario: 'break_retest_reverse' }),
    makeTrade({ id: '3', date: '2026-06-07', direction: 'long', level_type: 'VAL', scenario: 'retest_continue' }),
  ]

  it('returns all trades when no filters applied', () => {
    expect(filterTrades(trades, {})).toHaveLength(3)
  })

  it('filters by direction', () => {
    const result = filterTrades(trades, { direction: 'long' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.direction === 'long')).toBe(true)
  })

  it('filters by level_type', () => {
    const result = filterTrades(trades, { level_type: 'POC' })
    expect(result).toHaveLength(1)
    expect(result[0].level_type).toBe('POC')
  })

  it('filters by scenario', () => {
    const result = filterTrades(trades, { scenario: 'retest_continue' })
    expect(result).toHaveLength(2)
  })

  it('filters by date_from (inclusive)', () => {
    const result = filterTrades(trades, { date_from: '2026-06-08' })
    expect(result).toHaveLength(2)
  })

  it('filters by date_to (inclusive)', () => {
    const result = filterTrades(trades, { date_to: '2026-06-08' })
    expect(result).toHaveLength(2)
  })

  it('combines multiple filters', () => {
    const result = filterTrades(trades, { direction: 'long', level_type: 'POC' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('sumPnl', () => {
  it('sums P&L correctly', () => {
    const trades = [makeTrade({ pnl: 200 }), makeTrade({ pnl: -100 }), makeTrade({ pnl: 50 })]
    expect(sumPnl(trades)).toBe(150)
  })

  it('returns 0 for empty array', () => {
    expect(sumPnl([])).toBe(0)
  })
})

describe('winRate', () => {
  it('calculates correctly: 2 of 4 wins = 50%', () => {
    const trades = [
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: -100 }),
    ]
    expect(winRate(trades)).toBe(50)
  })

  it('returns 0 for empty array', () => {
    expect(winRate([])).toBe(0)
  })

  it('returns 100 when all trades are winners', () => {
    expect(winRate([makeTrade({ pnl: 100 }), makeTrade({ pnl: 200 })])).toBe(100)
  })
})

describe('avgWin', () => {
  it('averages only winning trades', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: 100 }), makeTrade({ pnl: -200 })]
    expect(avgWin(trades)).toBe(200)
  })

  it('returns 0 when no winners', () => {
    expect(avgWin([makeTrade({ pnl: -100 })])).toBe(0)
  })
})

describe('avgLoss', () => {
  it('averages only losing trades (negative value)', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: -100 }), makeTrade({ pnl: -200 })]
    expect(avgLoss(trades)).toBe(-150)
  })

  it('returns 0 when no losers', () => {
    expect(avgLoss([makeTrade({ pnl: 100 })])).toBe(0)
  })
})

describe('avgRR', () => {
  it('calculates risk/reward ratio', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: -100 })]
    expect(avgRR(trades)).toBe(3)
  })

  it('returns 0 when no losers', () => {
    expect(avgRR([makeTrade({ pnl: 100 })])).toBe(0)
  })
})

describe('prepareTradeData', () => {
  it('calculates pnl and sets source to manual', () => {
    const result = prepareTradeData({
      date: '2026-06-09',
      time_entered: '10:00',
      direction: 'long',
      entry_price: 21000,
      exit_price: 21010,
      contracts: 1,
      level_type: 'POC',
      level_price: 21000,
      prev_day_poc: 21000,
      prev_day_vah: 21050,
      prev_day_val: 20950,
      scenario: 'retest_continue',
    })
    expect(result.pnl).toBe(200)
    expect(result.source).toBe('manual')
    expect(result.notes).toBeNull()
  })
})
