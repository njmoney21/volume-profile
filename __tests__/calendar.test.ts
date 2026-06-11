import { describe, it, expect } from 'vitest'
import { buildCalendarGrid } from '@/lib/calendar'
import type { Trade } from '@/types'

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: '1',
  date: '2026-06-09',
  time_entered: '10:00:00',
  direction: 'long',
  position_size: 1000,
  level_type: 'POC',
  level_price: 21000,
  prev_day_poc: 21000,
  prev_day_vah: 21050,
  prev_day_val: 20950,
  scenario: 'retest_continue',
  result: 'win',
  pnl: 200,
  notes: null,
  source: 'manual',
  created_at: '2026-06-09T10:00:00Z',
  ...overrides,
})

describe('buildCalendarGrid', () => {
  it('pads the first week so day 1 lands on its correct weekday', () => {
    // June 1, 2026 is a Monday, so the first week's Sunday cell is null
    const weeks = buildCalendarGrid([], 2026, 5)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][1]).toMatchObject({ day: 1, date: '2026-06-01' })
  })

  it('produces weeks that are always 7 cells long', () => {
    const weeks = buildCalendarGrid([], 2026, 5)
    for (const week of weeks) {
      expect(week).toHaveLength(7)
    }
  })

  it('includes one cell per day in the month', () => {
    const weeks = buildCalendarGrid([], 2026, 5) // June 2026 has 30 days
    const dayCells = weeks.flat().filter(cell => cell !== null)
    expect(dayCells).toHaveLength(30)
  })

  it('aggregates pnl, winRate, and tradeCount for a day with trades', () => {
    const trades = [
      makeTrade({ id: '1', date: '2026-06-09', pnl: 200, result: 'win' }),
      makeTrade({ id: '2', date: '2026-06-09', pnl: -50, result: 'loss' }),
    ]
    const weeks = buildCalendarGrid(trades, 2026, 5)
    const day9 = weeks.flat().find(cell => cell?.date === '2026-06-09')
    expect(day9).toMatchObject({ day: 9, pnl: 150, winRate: 50, tradeCount: 2 })
  })

  it('returns zeroed stats for a day with no trades', () => {
    const weeks = buildCalendarGrid([], 2026, 5)
    const day1 = weeks.flat().find(cell => cell?.date === '2026-06-01')
    expect(day1).toMatchObject({ day: 1, pnl: 0, winRate: 0, tradeCount: 0 })
  })

  it('handles February in a leap year and a non-leap year', () => {
    const leapWeeks = buildCalendarGrid([], 2024, 1) // Feb 2024 has 29 days
    const nonLeapWeeks = buildCalendarGrid([], 2026, 1) // Feb 2026 has 28 days
    expect(leapWeeks.flat().filter(cell => cell !== null)).toHaveLength(29)
    expect(nonLeapWeeks.flat().filter(cell => cell !== null)).toHaveLength(28)
  })
})
