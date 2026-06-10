'use client'

import { Fragment, useState } from 'react'
import type { BacktestDay, BacktestTrade } from '@/types'
import { formatDate, formatPnl } from '@/lib/utils'
import { deleteDay } from '@/app/backtest/actions'
import { DayForm } from './day-form'
import { DayTrades } from './day-trades'

interface DayTableProps {
  sessionId: string
  days: BacktestDay[]
  trades: BacktestTrade[]
}

export function DayTable({ sessionId, days, trades }: DayTableProps) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<BacktestDay | null>(null)
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this day?')) return
    await deleteDay(id)
  }

  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="bg-black border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-300">Days</h3>
        <button onClick={() => setAdding(true)}
          className="px-3 py-1.5 text-xs bg-white hover:bg-gray-200 text-black rounded-lg transition-colors">
          + Add Day
        </button>
      </div>

      {sortedDays.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          No days yet. Click &quot;+ Add Day&quot; to add the first day of this session.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-left">
                {['Date', 'Prev POC', 'Prev VAH', 'Prev VAL', 'Trades', 'Day P&L', ''].map(h => (
                  <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDays.map(day => {
                const dayTrades = trades.filter(t => t.day_id === day.id)
                const isExpanded = expandedDayId === day.id

                return (
                  <Fragment key={day.id}>
                    <tr
                      onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer">
                      <td className="py-3 pr-4">{formatDate(day.date)}</td>
                      <td className="py-3 pr-4 font-mono">{day.prev_day_poc}</td>
                      <td className="py-3 pr-4 font-mono">{day.prev_day_vah}</td>
                      <td className="py-3 pr-4 font-mono">{day.prev_day_val}</td>
                      <td className="py-3 pr-4 text-gray-400">{dayTrades.length}</td>
                      <td className={`py-3 pr-4 font-mono font-medium ${
                        day.day_pnl > 0 ? 'text-green-600' : day.day_pnl < 0 ? 'text-red-600' : 'text-gray-400'
                      }`}>
                        {formatPnl(day.day_pnl)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={e => { e.stopPropagation(); setEditing(day) }}
                            className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(day.id) }}
                            className="text-xs text-gray-400 hover:text-white transition-colors">Delete</button>
                          <span className="text-gray-500">{isExpanded ? '▾' : '▸'}</span>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-white/5">
                        <td colSpan={7} className="p-0">
                          <DayTrades sessionId={sessionId} day={day} trades={trades.filter(t => t.day_id === day.id)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && <DayForm sessionId={sessionId} onClose={() => setAdding(false)} />}
      {editing && <DayForm sessionId={sessionId} day={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
