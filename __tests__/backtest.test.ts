import { describe, it, expect } from 'vitest'
import { dayPnl, prepareBacktestTradeData } from '@/lib/backtest'
import { sumPnl, winRate, avgWin, avgLoss, avgRR } from '@/lib/trades'
import type { BacktestTrade } from '@/types'

const makeBacktestTrade = (overrides: Partial<BacktestTrade> = {}): BacktestTrade => ({
  id: '1',
  session_id: 'session-1',
  day_id: 'day-1',
  date: '2026-06-09',
  time_entered: '10:00:00',
  direction: 'long',
  entry_price: 21000,
  exit_price: 21010,
  contracts: 1,
  level_type: 'POC',
  level_price: 21000,
  scenario: 'retest_continue',
  pnl: 200,
  notes: null,
  ...overrides,
})

describe('dayPnl', () => {
  it('sums pnl for trades matching the given day_id, rounded to 2 decimals', () => {
    const trades = [
      makeBacktestTrade({ id: '1', day_id: 'day-1', pnl: 100.005 }),
      makeBacktestTrade({ id: '2', day_id: 'day-1', pnl: 50.005 }),
      makeBacktestTrade({ id: '3', day_id: 'day-2', pnl: 999 }),
    ]
    expect(dayPnl(trades, 'day-1')).toBe(150.01)
  })

  it('returns 0 for a day_id with no trades', () => {
    const trades = [makeBacktestTrade({ id: '1', day_id: 'day-1', pnl: 100 })]
    expect(dayPnl(trades, 'day-2')).toBe(0)
  })
})

describe('prepareBacktestTradeData', () => {
  it('builds a BacktestTrade payload with computed pnl and copied fields', () => {
    const result = prepareBacktestTradeData('session-1', 'day-1', '2026-06-09', {
      time_entered: '10:00:00',
      direction: 'long',
      entry_price: 21000,
      exit_price: 21010,
      contracts: 1,
      level_type: 'POC',
      level_price: 21000,
      scenario: 'retest_continue',
    })

    expect(result).toEqual({
      session_id: 'session-1',
      day_id: 'day-1',
      date: '2026-06-09',
      time_entered: '10:00:00',
      direction: 'long',
      entry_price: 21000,
      exit_price: 21010,
      contracts: 1,
      level_type: 'POC',
      level_price: 21000,
      scenario: 'retest_continue',
      pnl: 200,
      notes: null,
    })
  })

  it('defaults notes to null when omitted, and copies notes when provided', () => {
    const withNotes = prepareBacktestTradeData('session-1', 'day-1', '2026-06-09', {
      time_entered: '10:00:00',
      direction: 'short',
      entry_price: 21010,
      exit_price: 21000,
      contracts: 2,
      level_type: 'VAH',
      level_price: 21010,
      scenario: 'break_retest_reverse',
      notes: 'good trade',
    })

    expect(withNotes.notes).toBe('good trade')

    const withoutNotes = prepareBacktestTradeData('session-1', 'day-1', '2026-06-09', {
      time_entered: '10:00:00',
      direction: 'short',
      entry_price: 21010,
      exit_price: 21000,
      contracts: 2,
      level_type: 'VAH',
      level_price: 21010,
      scenario: 'break_retest_reverse',
    })

    expect(withoutNotes.notes).toBeNull()
  })
})

describe('generic stats functions still work after signature change', () => {
  it('sumPnl and winRate compute correctly on plain { pnl } objects', () => {
    const items = [{ pnl: 200 }, { pnl: -100 }, { pnl: 50 }, { pnl: 150 }]
    expect(sumPnl(items)).toBe(300)
    expect(winRate(items)).toBe(75)
  })

  it('avgWin, avgLoss, avgRR compute correctly on plain { pnl } objects', () => {
    const items = [{ pnl: 300 }, { pnl: -100 }]
    expect(avgWin(items)).toBe(300)
    expect(avgLoss(items)).toBe(-100)
    expect(avgRR(items)).toBe(3)
  })
})
