'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Trade } from '@/types'
import {
  sumPnl, resultWinRate, resultAvgWin, resultAvgLoss, resultAvgRR,
  statsByDirection, statsByTimeOfDay, cumulativePnl,
} from '@/lib/trades'
import { DEFAULT_TIMEZONE } from '@/lib/timezones'
import { StatCards } from './stat-cards'
import { BreakdownTable } from './breakdown-table'
import { TimezoneSelect } from './timezone-select'
import { PnlChart } from './pnl-chart'
import { TradingCalendar } from './trading-calendar'

export function DashboardClient({ trades }: { trades: Trade[] }) {
  const draftCount = trades.filter(t => t.status === 'draft').length
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

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
        totalTrades={trades.length}
        winRate={resultWinRate(trades)}
        totalPnl={sumPnl(trades)}
        avgWin={resultAvgWin(trades)}
        avgLoss={resultAvgLoss(trades)}
        avgRR={resultAvgRR(trades)}
      />

      <PnlChart data={cumulativePnl(trades)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable title="By Direction" rows={statsByDirection(trades)} />
        <BreakdownTable
          title="By Time of Day"
          rows={statsByTimeOfDay(trades, timezone)}
          headerRight={<TimezoneSelect value={timezone} onChange={setTimezone} />}
        />
      </div>

      <TradingCalendar trades={trades} />
    </div>
  )
}
