import type { Trade, TradeFilters, TradeFormData } from '@/types'
import { calculatePnl } from './utils'

export function filterTrades(trades: Trade[], filters: TradeFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.level_type && trade.level_type !== filters.level_type) return false
    if (filters.scenario && trade.scenario !== filters.scenario) return false
    if (filters.date_from && trade.date < filters.date_from) return false
    if (filters.date_to && trade.date > filters.date_to) return false
    return true
  })
}

export function sumPnl(trades: Trade[]): number {
  return Math.round(trades.reduce((sum, t) => sum + t.pnl, 0) * 100) / 100
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100)
}

export function avgWin(trades: Trade[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function avgLoss(trades: Trade[]): number {
  const losers = trades.filter(t => t.pnl < 0)
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function avgRR(trades: Trade[]): number {
  const win = Math.abs(avgWin(trades))
  const loss = Math.abs(avgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

export function prepareTradeData(formData: TradeFormData): Omit<Trade, 'id' | 'created_at'> {
  return {
    date: formData.date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    entry_price: formData.entry_price,
    exit_price: formData.exit_price,
    contracts: formData.contracts,
    level_type: formData.level_type,
    level_price: formData.level_price,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    scenario: formData.scenario,
    pnl: calculatePnl(formData.direction, formData.entry_price, formData.exit_price, formData.contracts),
    notes: formData.notes ?? null,
    source: 'manual',
  }
}
