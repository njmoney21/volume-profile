'use client'

import { useState } from 'react'
import type { Trade } from '@/types'
import { formatPnl, formatTime, formatDate } from '@/lib/utils'
import { deleteTrade } from '@/app/journal/actions'
import { TradeForm } from './trade-form'

const scenarioLabel: Record<string, string> = {
  retest_continue: 'Retest + Continue',
  break_retest_reverse: 'Break + Reverse',
}

const resultLabel: Record<string, string> = {
  win: 'W',
  loss: 'L',
  breakeven: 'BE',
}

const resultBadgeClass: Record<string, string> = {
  win: 'bg-green-600/20 text-green-400',
  loss: 'bg-red-600/20 text-red-400',
  breakeven: 'border border-white/20 text-gray-300',
}

const resultPnlClass: Record<string, string> = {
  win: 'text-green-600',
  loss: 'text-red-600',
  breakeven: 'text-gray-400',
}

export function TradeTable({ trades }: { trades: Trade[] }) {
  const [editing, setEditing] = useState<Trade | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this trade?')) return
    await deleteTrade(id)
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">
        No trades yet. Click &quot;+ Add Trade&quot; to log your first trade.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-left">
              {['Date', 'Time', 'Direction', 'Result', 'Level', 'Scenario', 'Size', 'P&L', ''].map(h => (
                <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 pr-4">{formatDate(trade.date)}</td>
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultBadgeClass[trade.result]}`}>
                    {resultLabel[trade.result]}
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
                <td className="py-3 pr-4 text-gray-400 text-xs">{trade.scenario ? scenarioLabel[trade.scenario] : '—'}</td>
                <td className="py-3 pr-4 font-mono text-gray-400">${trade.position_size.toFixed(2)}</td>
                <td className={`py-3 pr-4 font-mono font-medium ${resultPnlClass[trade.result]}`}>
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

      {editing && <TradeForm trade={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
