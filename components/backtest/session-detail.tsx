'use client'

import type { BacktestSession, BacktestDay, BacktestTrade } from '@/types'
import { formatDate } from '@/lib/utils'
import { sumPnl, winRate, avgWin, avgLoss, avgRR } from '@/lib/trades'
import { StatCards } from '@/components/dashboard/stat-cards'
import { DayTable } from './day-table'

interface SessionDetailProps {
  session: BacktestSession
  days: BacktestDay[]
  trades: BacktestTrade[]
  onEditSession: () => void
  onDeleteSession: () => void
}

export function SessionDetail({ session, days, trades, onEditSession, onDeleteSession }: SessionDetailProps) {
  function handleDelete() {
    if (!confirm('Delete this session?')) return
    onDeleteSession()
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-w-0">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {formatDate(session.date_from)} – {formatDate(session.date_to)}
          </h2>
          {session.notes && (
            <p className="text-sm text-gray-400 mt-1">{session.notes}</p>
          )}
        </div>
        <div className="flex gap-3 shrink-0">
          <button onClick={onEditSession}
            className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
          <button onClick={handleDelete}
            className="text-xs text-gray-400 hover:text-white transition-colors">Delete</button>
        </div>
      </div>

      <StatCards
        totalTrades={trades.length}
        winRate={winRate(trades)}
        totalPnl={sumPnl(trades)}
        avgWin={avgWin(trades)}
        avgLoss={avgLoss(trades)}
        avgRR={avgRR(trades)}
      />

      <DayTable sessionId={session.id} days={days} trades={trades} />
    </div>
  )
}
