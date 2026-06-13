'use client'

import Link from 'next/link'
import type { Trade } from '@/types'
import {
  sumPnl, resultWinRate, resultAvgWin, resultAvgLoss, resultAvgRR,
  statsByLevelType, statsByScenario, statsByDirection, statsByTimeOfDay, cumulativePnl,
} from '@/lib/trades'
import { StatCards } from './stat-cards'
import { BreakdownTable } from './breakdown-table'
import { PnlChart } from './pnl-chart'
import { TradingCalendar } from './trading-calendar'

export function DashboardClient({ trades }: { trades: Trade[] }) {
  const reviewed = trades.filter(t => t.status === 'reviewed')
  const draftCount = trades.length - reviewed.length

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1.5">Journal performance overview</p>
      </div>

      {draftCount > 0 && (
        <Link
          href="/journal?status=draft"
          className="block bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          {draftCount} trade{draftCount === 1 ? '' : 's'} pending annotation →
        </Link>
      )}

      <StatCards
        totalTrades={reviewed.length}
        winRate={resultWinRate(reviewed)}
        totalPnl={sumPnl(reviewed)}
        avgWin={resultAvgWin(reviewed)}
        avgLoss={resultAvgLoss(reviewed)}
        avgRR={resultAvgRR(reviewed)}
      />

      <PnlChart data={cumulativePnl(reviewed)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownTable title="By Level Type" rows={statsByLevelType(reviewed)} />
        <BreakdownTable title="By Scenario" rows={statsByScenario(reviewed)} />
        <BreakdownTable title="By Direction" rows={statsByDirection(reviewed)} />
      </div>

      <BreakdownTable title="By Time of Day" rows={statsByTimeOfDay(reviewed)} />

      <TradingCalendar trades={trades} />
    </div>
  )
}
