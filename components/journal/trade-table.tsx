'use client'

import { useEffect, useRef, useState } from 'react'
import type { Trade } from '@/types'
import { formatPnl, formatTime, formatDate } from '@/lib/utils'
import { deleteTrade } from '@/app/journal/actions'
import { TradeForm } from './trade-form'

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRefs = useRef(new Map<string, HTMLDivElement>())

  useEffect(() => {
    if (!openMenuId) return
    const id = openMenuId
    function handleClickOutside(e: MouseEvent) {
      const menu = menuRefs.current.get(id)
      if (menu && !menu.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  async function handleDelete(id: string) {
    if (!confirm('Delete this trade?')) return
    await deleteTrade(id)
    setOpenMenuId(null)
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
                {['Date', 'Time', 'Direction', 'Result', 'Status', 'Size', 'P&L', ''].map(h => (
                  <th key={h} className="py-3 px-4 font-medium text-gray-400 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trades.map(trade => (
                <tr key={trade.id}
                  className={`hover:bg-white/[0.04] transition-colors ${
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
                  <td className="py-3.5 px-4 font-mono text-gray-400 tabular-nums">${trade.position_size.toFixed(2)}</td>
                  <td className={`py-3.5 px-4 font-mono font-semibold tabular-nums ${resultPnlClass[trade.result]}`}>
                    {formatPnl(trade.pnl)}
                  </td>
                  <td className="py-3.5 px-4 relative">
                    <div ref={el => { if (el) menuRefs.current.set(trade.id, el); else menuRefs.current.delete(trade.id) }}>
                      <button
                        onClick={() => setOpenMenuId(openMenuId === trade.id ? null : trade.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        aria-label="Row actions"
                      >
                        ⋮
                      </button>
                      {openMenuId === trade.id && (
                        <div className="absolute right-4 top-full z-10 mt-1 w-32 rounded-lg border border-white/10 bg-[#111] shadow-lg overflow-hidden">
                          <button
                            onClick={() => { setEditing(trade); setOpenMenuId(null) }}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(trade.id)}
                            className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
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
