# Trading Calendar — Design Spec

Date: 2026-06-11
Scope: `lib/calendar.ts`, `components/dashboard/trading-calendar.tsx`, `components/dashboard/dashboard-client.tsx`, `components/journal/journal-client.tsx`.

## 1. Goals & Scope

Add a monthly trading calendar to the Dashboard, showing P&L and win rate per day, with month navigation and a click-through to the Journal filtered to that day.

Out of scope: Events toggle (no events data source exists), day click on empty days, editing trades from the calendar, multi-month/year views.

## 2. `lib/calendar.ts`

New file, pure functions, no dependencies beyond `types` and `lib/trades`.

```typescript
import type { Trade } from '@/types'
import { sumPnl, resultWinRate } from './trades'

export interface CalendarDay {
  date: string   // "YYYY-MM-DD"
  day: number    // 1-31
  pnl: number
  winRate: number
  tradeCount: number
}

export function buildCalendarGrid(trades: Trade[], year: number, month: number): (CalendarDay | null)[][] {
  const firstOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startWeekday = firstOfMonth.getDay() // 0 = Sunday

  const tradesByDate = new Map<string, Trade[]>()
  for (const trade of trades) {
    const list = tradesByDate.get(trade.date) ?? []
    list.push(trade)
    tradesByDate.set(trade.date, list)
  }

  const cells: (CalendarDay | null)[] = []

  for (let i = 0; i < startWeekday; i++) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayTrades = tradesByDate.get(date) ?? []
    cells.push({
      date,
      day,
      pnl: sumPnl(dayTrades),
      winRate: resultWinRate(dayTrades),
      tradeCount: dayTrades.length,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  const weeks: (CalendarDay | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return weeks
}
```

- `month` is 0-indexed (JavaScript `Date` convention: 0 = January).
- `tradesByDate` groups trades by their `date` field (already `"YYYY-MM-DD"`).
- `sumPnl` and `resultWinRate` are existing functions from `lib/trades.ts`; for an empty array they return `0`.
- Trailing `null` cells pad the grid to a multiple of 7 so every week row has 7 columns.

## 3. `components/dashboard/trading-calendar.tsx`

New client component.

```typescript
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Trade } from '@/types'
import { buildCalendarGrid } from '@/lib/calendar'
import { formatPnl } from '@/lib/utils'

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function TradingCalendar({ trades }: { trades: Trade[] }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const weeks = buildCalendarGrid(trades, year, month)
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  function prevMonth() {
    if (month === 0) {
      setYear(year - 1)
      setMonth(11)
    } else {
      setMonth(month - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setYear(year + 1)
      setMonth(0)
    } else {
      setMonth(month + 1)
    }
  }

  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 rounded-2xl p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Trading Calendar</h2>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            ←
          </button>
          <span className="text-sm font-medium text-white w-32 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors">
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map(wd => (
          <div key={wd} className="text-center text-xs font-medium text-gray-500 py-1">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weeks.flatMap((week, wi) =>
          week.map((cell, di) => {
            if (!cell) {
              return <div key={`${wi}-${di}`} className="aspect-square rounded-xl bg-white/[0.02] border border-white/5" />
            }

            const isToday = cell.date === todayStr
            const hasTrades = cell.tradeCount > 0
            const isProfit = hasTrades && cell.pnl > 0
            const isLoss = hasTrades && cell.pnl < 0

            const colorClass = isProfit
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : isLoss
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-white/[0.02] border-white/5 text-white'

            const ringClass = isToday ? 'ring-1 ring-white/30' : ''

            const content = (
              <div className={`aspect-square rounded-xl border p-2 flex flex-col ${colorClass} ${ringClass} ${hasTrades ? 'hover:border-white/40 transition-colors cursor-pointer' : ''}`}>
                <span className="text-sm font-semibold">{cell.day}</span>
                {hasTrades && (
                  <div className="mt-auto">
                    <div className="text-xs font-semibold">{formatPnl(cell.pnl)}</div>
                    <div className="text-[11px] text-gray-400">{cell.winRate}%</div>
                  </div>
                )}
              </div>
            )

            return hasTrades ? (
              <Link key={cell.date} href={`/journal?date=${cell.date}`}>
                {content}
              </Link>
            ) : (
              <div key={cell.date}>{content}</div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- Win rate is only meaningful with `tradeCount > 0`; the `winRate` line is hidden for empty days.
- Breakeven days (`pnl === 0` but `tradeCount > 0`) fall into the neutral `colorClass` branch (same as empty days) but still show P&L/win-rate text since `hasTrades` is true.

## 4. `components/dashboard/dashboard-client.tsx`

Add the calendar below the existing breakdown tables:

```typescript
import { TradingCalendar } from './trading-calendar'
// ...
      <BreakdownTable title="By Time of Day" rows={statsByTimeOfDay(trades)} />

      <TradingCalendar trades={trades} />
    </div>
  )
}
```

## 5. `components/journal/journal-client.tsx`

Seed the date filter from the URL so calendar links pre-filter the Journal:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Trade, TradeFilters } from '@/types'
// ... existing imports

export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') ?? undefined
  const [filters, setFilters] = useState<TradeFilters>(initialDate ? { date: initialDate } : {})
  const [showForm, setShowForm] = useState(false)
  // ... unchanged below
```

`useSearchParams` requires the page to render within a Suspense boundary in Next.js when used in a client component that's part of a statically-rendered tree. `app/journal/page.tsx` is a server component rendering `<JournalClient>` directly with no `<Suspense>` wrapper; `JournalClient` is `'use client'`. Since `app/journal/page.tsx` is already a dynamic (server-rendered on demand) route per the build output, `useSearchParams` works without an explicit Suspense boundary — Next.js only requires it for statically generated pages. No change to `page.tsx` needed.

## 6. Testing

`__tests__/calendar.test.ts` — unit tests for `buildCalendarGrid`:
- Correct leading `null` padding for a month that doesn't start on Sunday (e.g., June 2026 starts on Monday → 1 leading `null`)
- Correct trailing `null` padding so every week has 7 cells
- Correct number of day cells matches days in the month
- A day with trades aggregates `pnl`, `winRate`, `tradeCount` correctly from a sample `Trade[]`
- A day with no trades returns `pnl: 0, winRate: 0, tradeCount: 0`
- February in a leap year vs. non-leap year produces the correct day count

Component-level (`TradingCalendar`): verified via `tsc`, `lint`, and manual smoke-check on `/dashboard` — calendar renders, prev/next month navigation works, clicking a day with trades navigates to `/journal?date=YYYY-MM-DD` and the Journal shows that day's trades.

## 7. Out of Scope

- Events toggle / non-PNL views
- Day click for empty days
- Editing or adding trades from the calendar
- Multi-month or yearly views
