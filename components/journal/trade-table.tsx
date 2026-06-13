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
      <div className="text-center py-16 text-gray-500 text-sm rounded-xl border border-white/10 bg-white/[0.02]">
        No trades yet. Click &quot;+ Add Trade&quot; to log your first trade.
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-white/[0.03]">
                {['Date', 'Time', 'Direction', 'Result', 'Status', 'Level', 'Scenario', 'Size', 'P&L', ''].map(h => (
                  <th key={h} className="py-3 px-4 font-medium text-gray-400 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.map(trade => (
                <tr key={trade.id}
                  className={`group hover:bg-white/[0.04] transition-colors ${
                    trade.status === 'draft' ? 'bg-amber-500/[0.04]' : ''
                  }`}>
                  <td className="py-3.5 px-4 font-medium whitespace-nowrap">{formatDate(trade.date)}</td>
                  <td className="py-3.5 px-4 text-gray-400 tabular-nums whitespace-nowrap">{formatTime(trade.time_entered)}</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      trade.direction === 'long'
                        ? 'bg-white text-black'
                        : 'border border-white/20 text-gray-300'
                    }`}>
                      {trade.direction.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${resultBadgeClass[trade.result]}`}>
                      {resultLabel[trade.result]}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    {trade.status === 'draft' ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
                        Draft
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/10">
                        Reviewed
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {trade.level_type ? (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        trade.level_type === 'POC'
                          ? 'bg-white text-black'
                          : 'border border-white/20 text-gray-300'
                      }`}>
                        {trade.level_type}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400 text-xs whitespace-nowrap">{trade.scenario ? scenarioLabel[trade.scenario] : '—'}</td>
                  <td className="py-3.5 px-4 font-mono text-gray-400 tabular-nums">${trade.position_size.toFixed(2)}</td>
                  <td className={`py-3.5 px-4 font-mono font-semibold tabular-nums ${resultPnlClass[trade.result]}`}>
                    {formatPnl(trade.pnl)}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditing(trade)}
                        className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                      <button onClick={() => handleDelete(trade.id)}
                        className="text-xs text-gray-400 hover:text-red-400 transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <TradeForm trade={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
