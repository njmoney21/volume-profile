'use client'

import type { Trade } from '@/types'
import {
  sumPnl, winRate, avgWin, avgLoss, avgRR,
  statsByLevelType, statsByScenario, statsByDirection, statsByTimeOfDay, cumulativePnl,
} from '@/lib/trades'
import { StatCards } from './stat-cards'
import { BreakdownTable } from './breakdown-table'
import { PnlChart } from './pnl-chart'

export function DashboardClient({ trades }: { trades: Trade[] }) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Journal performance overview</p>
      </div>

      <StatCards
        totalTrades={trades.length}
        winRate={winRate(trades)}
        totalPnl={sumPnl(trades)}
        avgWin={avgWin(trades)}
        avgLoss={avgLoss(trades)}
        avgRR={avgRR(trades)}
      />

      <PnlChart data={cumulativePnl(trades)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownTable title="By Level Type" rows={statsByLevelType(trades)} />
        <BreakdownTable title="By Scenario" rows={statsByScenario(trades)} />
        <BreakdownTable title="By Direction" rows={statsByDirection(trades)} />
      </div>

      <BreakdownTable title="By Time of Day" rows={statsByTimeOfDay(trades)} />
    </div>
  )
}
