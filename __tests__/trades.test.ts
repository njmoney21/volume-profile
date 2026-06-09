import { describe, it, expect } from 'vitest'
import {
  filterTrades,
  sumPnl,
  winRate,
  avgWin,
  avgLoss,
  avgRR,
  prepareTradeData,
  statsByLevelType,
  statsByScenario,
  statsByDirection,
  statsByTimeOfDay,
  cumulativePnl,
} from '@/lib/trades'
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

describe('statsByLevelType', () => {
  it('returns 3 rows in order POC, VAH, VAL with correct stats', () => {
    const trades = [
      makeTrade({ id: '1', level_type: 'POC', pnl: 200 }),
      makeTrade({ id: '2', level_type: 'POC', pnl: -100 }),
      makeTrade({ id: '3', level_type: 'VAH', pnl: 300 }),
    ]
    const result = statsByLevelType(trades)
    expect(result).toHaveLength(3)
    expect(result.map(r => r.label)).toEqual(['POC', 'VAH', 'VAL'])

    expect(result[0]).toEqual({ label: 'POC', count: 2, winRate: 50, pnl: 100 })
    expect(result[1]).toEqual({ label: 'VAH', count: 1, winRate: 100, pnl: 300 })
    expect(result[2]).toEqual({ label: 'VAL', count: 0, winRate: 0, pnl: 0 })
  })
})

describe('statsByScenario', () => {
  it('returns 2 rows in order with correct labels', () => {
    const trades = [
      makeTrade({ id: '1', scenario: 'retest_continue', pnl: 200 }),
      makeTrade({ id: '2', scenario: 'break_retest_reverse', pnl: -100 }),
      makeTrade({ id: '3', scenario: 'break_retest_reverse', pnl: 50 }),
    ]
    const result = statsByScenario(trades)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.label)).toEqual(['Retest + Continue', 'Break + Retest + Reverse'])

    expect(result[0]).toEqual({ label: 'Retest + Continue', count: 1, winRate: 100, pnl: 200 })
    expect(result[1]).toEqual({ label: 'Break + Retest + Reverse', count: 2, winRate: 50, pnl: -50 })
  })
})

describe('statsByDirection', () => {
  it('returns 2 rows in order with correct labels', () => {
    const trades = [
      makeTrade({ id: '1', direction: 'long', pnl: 200 }),
      makeTrade({ id: '2', direction: 'long', pnl: -100 }),
      makeTrade({ id: '3', direction: 'short', pnl: 50 }),
    ]
    const result = statsByDirection(trades)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.label)).toEqual(['Long', 'Short'])

    expect(result[0]).toEqual({ label: 'Long', count: 2, winRate: 50, pnl: 100 })
    expect(result[1]).toEqual({ label: 'Short', count: 1, winRate: 100, pnl: 50 })
  })
})

describe('statsByTimeOfDay', () => {
  it('buckets trades into 5 fixed time buckets with fixed labels', () => {
    const trades = [
      makeTrade({ id: '1', time_entered: '09:30:00', pnl: 100 }),
      makeTrade({ id: '2', time_entered: '10:29:59', pnl: -50 }),
      makeTrade({ id: '3', time_entered: '10:30:00', pnl: 200 }),
      makeTrade({ id: '4', time_entered: '11:45:00', pnl: 100 }),
      makeTrade({ id: '5', time_entered: '12:30:00', pnl: -100 }),
      makeTrade({ id: '6', time_entered: '13:29:59', pnl: 50 }),
      makeTrade({ id: '7', time_entered: '13:30:00', pnl: 100 }),
      makeTrade({ id: '8', time_entered: '15:00:00', pnl: -100 }),
    ]
    const result = statsByTimeOfDay(trades)
    expect(result).toHaveLength(5)
    expect(result.map(r => r.label)).toEqual([
      '9:30–10:30',
      '10:30–11:30',
      '11:30–12:30',
      '12:30–13:30',
      '13:30+',
    ])

    // 9:30–10:30 -> trades 1, 2
    expect(result[0].count).toBe(2)
    // 10:30–11:30 -> trade 3 (10:30:00 falls here, lower bound inclusive)
    expect(result[1].count).toBe(1)
    // 11:30–12:30 -> trade 4
    expect(result[2].count).toBe(1)
    // 12:30–13:30 -> trades 5, 6
    expect(result[3].count).toBe(2)
    // 13:30+ -> trades 7, 8
    expect(result[4].count).toBe(2)
  })

  it('handles a trade with no time_entered for any bucket gracefully (zero counts allowed)', () => {
    const result = statsByTimeOfDay([])
    expect(result).toHaveLength(5)
    result.forEach(row => {
      expect(row).toMatchObject({ count: 0, winRate: 0, pnl: 0 })
    })
  })
})

describe('cumulativePnl', () => {
  it('returns points sorted by date ascending with running cumulative sum', () => {
    const trades = [
      makeTrade({ id: '1', date: '2026-06-09', pnl: 100 }),
      makeTrade({ id: '2', date: '2026-06-07', pnl: 50 }),
      makeTrade({ id: '3', date: '2026-06-08', pnl: -30 }),
      makeTrade({ id: '4', date: '2026-06-08', pnl: 20 }),
    ]
    const result = cumulativePnl(trades)
    expect(result).toEqual([
      { date: '2026-06-07', cumulative: 50 },
      { date: '2026-06-08', cumulative: 40 },
      { date: '2026-06-09', cumulative: 140 },
    ])
  })

  it('returns empty array for no trades', () => {
    expect(cumulativePnl([])).toEqual([])
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
