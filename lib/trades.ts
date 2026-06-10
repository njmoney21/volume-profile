import type { Trade, TradeFilters, TradeFormData, BreakdownRow, PnlPoint } from '@/types'

export function filterTrades(trades: Trade[], filters: TradeFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.level_type && trade.level_type !== filters.level_type) return false
    if (filters.scenario && trade.scenario !== filters.scenario) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.date && trade.date !== filters.date) return false
    return true
  })
}

export function sumPnl(trades: { pnl: number }[]): number {
  return Math.round(trades.reduce((sum, t) => sum + t.pnl, 0) * 100) / 100
}

export function winRate(trades: { pnl: number }[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100)
}

export function avgWin(trades: { pnl: number }[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function avgLoss(trades: { pnl: number }[]): number {
  const losers = trades.filter(t => t.pnl < 0)
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function avgRR(trades: { pnl: number }[]): number {
  const win = Math.abs(avgWin(trades))
  const loss = Math.abs(avgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

export function resultWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter(t => t.result === 'win').length
  return Math.round((wins / trades.length) * 100)
}

export function resultAvgWin(trades: Trade[]): number {
  const winners = trades.filter(t => t.result === 'win')
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function resultAvgLoss(trades: Trade[]): number {
  const losers = trades.filter(t => t.result === 'loss')
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function resultAvgRR(trades: Trade[]): number {
  const win = Math.abs(resultAvgWin(trades))
  const loss = Math.abs(resultAvgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

function rowFor(label: string, trades: Trade[]): BreakdownRow {
  return {
    label,
    count: trades.length,
    winRate: resultWinRate(trades),
    pnl: sumPnl(trades),
  }
}

export function statsByLevelType(trades: Trade[]): BreakdownRow[] {
  return (['POC', 'VAH', 'VAL'] as const).map(level =>
    rowFor(level, trades.filter(t => t.level_type === level))
  )
}

export function statsByScenario(trades: Trade[]): BreakdownRow[] {
  const scenarios: { key: Trade['scenario']; label: string }[] = [
    { key: 'retest_continue', label: 'Retest + Continue' },
    { key: 'break_retest_reverse', label: 'Break + Retest + Reverse' },
  ]
  return scenarios.map(({ key, label }) =>
    rowFor(label, trades.filter(t => t.scenario === key))
  )
}

export function statsByDirection(trades: Trade[]): BreakdownRow[] {
  const directions: { key: Trade['direction']; label: string }[] = [
    { key: 'long', label: 'Long' },
    { key: 'short', label: 'Short' },
  ]
  return directions.map(({ key, label }) =>
    rowFor(label, trades.filter(t => t.direction === key))
  )
}

const TIME_BUCKETS = [
  { label: '9:30–10:30', start: '09:30:00', end: '10:30:00' },
  { label: '10:30–11:30', start: '10:30:00', end: '11:30:00' },
  { label: '11:30–12:30', start: '11:30:00', end: '12:30:00' },
  { label: '12:30–13:30', start: '12:30:00', end: '13:30:00' },
  { label: '13:30+', start: '13:30:00', end: '24:00:00' },
]

export function statsByTimeOfDay(trades: Trade[]): BreakdownRow[] {
  return TIME_BUCKETS.map(({ label, start, end }) =>
    rowFor(label, trades.filter(t => t.time_entered >= start && t.time_entered < end))
  )
}

export function cumulativePnl(trades: Trade[]): PnlPoint[] {
  const byDate = new Map<string, number>()
  for (const t of trades) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl)
  }
  const dates = [...byDate.keys()].sort()
  let running = 0
  return dates.map(date => {
    running = Math.round((running + byDate.get(date)!) * 100) / 100
    return { date, cumulative: running }
  })
}

export function prepareTradeData(formData: TradeFormData): Omit<Trade, 'id' | 'created_at'> {
  return {
    date: formData.date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    position_size: formData.position_size,
    level_type: formData.level_type,
    level_price: formData.level_price,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    scenario: formData.scenario,
    result: formData.result,
    pnl: formData.pnl,
    notes: formData.notes ?? null,
    source: 'manual',
  }
}
