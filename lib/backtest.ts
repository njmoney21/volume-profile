import type { BacktestTrade, BacktestTradeFormData } from '@/types'
import { calculatePnl } from './utils'

export function dayPnl(trades: BacktestTrade[], dayId: string): number {
  return Math.round(
    trades.filter(t => t.day_id === dayId).reduce((sum, t) => sum + t.pnl, 0) * 100
  ) / 100
}

export function prepareBacktestTradeData(
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
): Omit<BacktestTrade, 'id'> {
  return {
    session_id: sessionId,
    day_id: dayId,
    date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    entry_price: formData.entry_price,
    exit_price: formData.exit_price,
    contracts: formData.contracts,
    level_type: formData.level_type,
    level_price: formData.level_price,
    scenario: formData.scenario,
    pnl: calculatePnl(formData.direction, formData.entry_price, formData.exit_price, formData.contracts),
    notes: formData.notes ?? null,
  }
}
