'use client'

import { useState } from 'react'
import type { BacktestDay, BacktestTrade } from '@/types'
import { formatPnl, formatTime } from '@/lib/utils'
import { deleteBacktestTrade } from '@/app/backtest/actions'
import { BacktestTradeForm } from './backtest-trade-form'

const scenarioLabel: Record<string, string> = {
  retest_continue: 'Retest + Continue',
  break_retest_reverse: 'Break + Reverse',
}

interface DayTradesProps {
  sessionId: string
  day: BacktestDay
  trades: BacktestTrade[]
}

export function DayTrades({ sessionId, day, trades }: DayTradesProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<BacktestTrade | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this trade?')) return
    await deleteBacktestTrade(id, day.id)
  }

  const sortedTrades = [...trades].sort((a, b) => a.time_entered.localeCompare(b.time_entered))

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-300">Trades</h4>
        <button onClick={() => setAdding(true)}
          className="px-3 py-1.5 text-xs bg-white hover:bg-gray-200 text-black rounded-lg transition-colors">
          + Add Trade
        </button>
      </div>

      {sortedTrades.length === 0 ? (
        <div className="text-sm text-gray-500 py-3">No trades for this day yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                {['Time', 'Direction', 'Level', 'Scenario', 'Entry', 'Exit', 'Qty', 'P&L', ''].map(h => (
                  <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTrades.map(trade => (
                <tr key={trade.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 pr-4 text-gray-400">{formatTime(trade.time_entered)}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.direction === 'long'
                        ? 'bg-white text-black'
                        : 'border border-white/20 text-gray-300'
                    }`}>
                      {trade.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.level_type === 'POC'
                        ? 'bg-white text-black'
                        : 'border border-white/20 text-gray-300'
                    }`}>
                      {trade.level_type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{scenarioLabel[trade.scenario]}</td>
                  <td className="py-3 pr-4 font-mono">{trade.entry_price}</td>
                  <td className="py-3 pr-4 font-mono">{trade.exit_price}</td>
                  <td className="py-3 pr-4 text-gray-400">{trade.contracts}</td>
                  <td className={`py-3 pr-4 font-mono font-medium ${
                    trade.pnl > 0 ? 'text-green-600' : trade.pnl < 0 ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {formatPnl(trade.pnl)}
                  </td>
                  <td className="py-3">
                    <div className="flex gap-3">
                      <button onClick={() => setEditing(trade)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                      <button onClick={() => handleDelete(trade.id)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && <BacktestTradeForm sessionId={sessionId} day={day} onClose={() => setAdding(false)} />}
      {editing && <BacktestTradeForm sessionId={sessionId} day={day} trade={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
