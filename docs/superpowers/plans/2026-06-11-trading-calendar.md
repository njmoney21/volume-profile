# Trading Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a monthly trading calendar to the Dashboard showing per-day P&L and win rate, with month navigation and click-through to the Journal filtered to that day.

**Architecture:** A pure-function `lib/calendar.ts` builds a Sun–Sat week grid annotated with per-day trade stats from existing `lib/trades.ts` helpers. A new `TradingCalendar` client component renders that grid with month-navigation state, and is added to the Dashboard below the existing breakdown tables. The Journal client reads an optional `?date=` URL param to seed its existing date filter.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest.

---

### Task 1: `lib/calendar.ts` — `buildCalendarGrid` + tests

**Files:**
- Create: `lib/calendar.ts`
- Test: `__tests__/calendar.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/calendar.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCalendarGrid } from '@/lib/calendar'
import type { Trade } from '@/types'

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: '1',
  date: '2026-06-09',
  time_entered: '10:00:00',
  direction: 'long',
  position_size: 1000,
  level_type: 'POC',
  level_price: 21000,
  prev_day_poc: 21000,
  prev_day_vah: 21050,
  prev_day_val: 20950,
  scenario: 'retest_continue',
  result: 'win',
  pnl: 200,
  notes: null,
  source: 'manual',
  created_at: '2026-06-09T10:00:00Z',
  ...overrides,
})

describe('buildCalendarGrid', () => {
  it('pads the first week so day 1 lands on its correct weekday', () => {
    // June 1, 2026 is a Monday, so the first week's Sunday cell is null
    const weeks = buildCalendarGrid([], 2026, 5)
    expect(weeks[0][0]).toBeNull()
    expect(weeks[0][1]).toMatchObject({ day: 1, date: '2026-06-01' })
  })

  it('produces weeks that are always 7 cells long', () => {
    const weeks = buildCalendarGrid([], 2026, 5)
    for (const week of weeks) {
      expect(week).toHaveLength(7)
    }
  })

  it('includes one cell per day in the month', () => {
    const weeks = buildCalendarGrid([], 2026, 5) // June 2026 has 30 days
    const dayCells = weeks.flat().filter(cell => cell !== null)
    expect(dayCells).toHaveLength(30)
  })

  it('aggregates pnl, winRate, and tradeCount for a day with trades', () => {
    const trades = [
      makeTrade({ id: '1', date: '2026-06-09', pnl: 200, result: 'win' }),
      makeTrade({ id: '2', date: '2026-06-09', pnl: -50, result: 'loss' }),
    ]
    const weeks = buildCalendarGrid(trades, 2026, 5)
    const day9 = weeks.flat().find(cell => cell?.date === '2026-06-09')
    expect(day9).toMatchObject({ day: 9, pnl: 150, winRate: 50, tradeCount: 2 })
  })

  it('returns zeroed stats for a day with no trades', () => {
    const weeks = buildCalendarGrid([], 2026, 5)
    const day1 = weeks.flat().find(cell => cell?.date === '2026-06-01')
    expect(day1).toMatchObject({ day: 1, pnl: 0, winRate: 0, tradeCount: 0 })
  })

  it('handles February in a leap year and a non-leap year', () => {
    const leapWeeks = buildCalendarGrid([], 2024, 1) // Feb 2024 has 29 days
    const nonLeapWeeks = buildCalendarGrid([], 2026, 1) // Feb 2026 has 28 days
    expect(leapWeeks.flat().filter(cell => cell !== null)).toHaveLength(29)
    expect(nonLeapWeeks.flat().filter(cell => cell !== null)).toHaveLength(28)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/calendar.test.ts`
Expected: FAIL with an error that `lib/calendar.ts` (or `buildCalendarGrid`) cannot be found / does not exist.

- [ ] **Step 3: Implement `lib/calendar.ts`**

Create `lib/calendar.ts`:

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

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/calendar.test.ts`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/calendar.ts __tests__/calendar.test.ts
git commit -m "Add buildCalendarGrid for trading calendar"
```

---

### Task 2: `components/dashboard/trading-calendar.tsx`

**Files:**
- Create: `components/dashboard/trading-calendar.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/trading-calendar.tsx`:

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

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/trading-calendar.tsx
git commit -m "Add TradingCalendar component"
```

---

### Task 3: Wire `TradingCalendar` into the Dashboard

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Add the import and render the component**

In `components/dashboard/dashboard-client.tsx`, add the import alongside the existing component imports:

```typescript
import { TradingCalendar } from './trading-calendar'
```

So the import block becomes:

```typescript
import { StatCards } from './stat-cards'
import { BreakdownTable } from './breakdown-table'
import { PnlChart } from './pnl-chart'
import { TradingCalendar } from './trading-calendar'
```

Then add `<TradingCalendar trades={trades} />` as the last child of the outer `<div className="flex flex-col gap-8">`, after the `By Time of Day` breakdown table:

```typescript
      <BreakdownTable title="By Time of Day" rows={statsByTimeOfDay(trades)} />

      <TradingCalendar trades={trades} />
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-client.tsx
git commit -m "Render TradingCalendar on the Dashboard"
```

---

### Task 4: Seed Journal date filter from `?date=` URL param

**Files:**
- Modify: `components/journal/journal-client.tsx`

- [ ] **Step 1: Read the `date` search param and seed the filter state**

In `components/journal/journal-client.tsx`, add the `useSearchParams` import:

```typescript
'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Trade, TradeFilters } from '@/types'
import { filterTrades, sumPnl, resultWinRate } from '@/lib/trades'
import { formatPnl } from '@/lib/utils'
import { FiltersBar } from './filters-bar'
import { TradeTable } from './trade-table'
import { TradeForm } from './trade-form'

export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') ?? undefined
  const [filters, setFilters] = useState<TradeFilters>(initialDate ? { date: initialDate } : {})
  const [showForm, setShowForm] = useState(false)
```

The rest of the component (the `filtered`, `totalPnl`, `wr` calculations and the JSX returned) stays exactly as it is.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/journal/journal-client.tsx
git commit -m "Seed journal date filter from URL search param"
```

---

### Task 5: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass, including the new `__tests__/calendar.test.ts` (6 new tests). Total test count should be 65 (existing) + 6 = 71.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors or warnings.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Build succeeds. `/dashboard` and `/journal` routes are listed. If `useSearchParams` in `JournalClient` triggers a "should be wrapped in a suspense boundary" build error, wrap the page content: in `app/journal/page.tsx`, import `Suspense` from `react` and wrap the returned `<JournalClient ... />` in `<Suspense fallback={null}>...</Suspense>`. Re-run `npm run build` to confirm it then succeeds.

- [ ] **Step 4: Manual smoke check**

Run `npm run dev`, open `/dashboard`:
- Confirm the Trading Calendar renders below the breakdown tables, showing the current month with weekday headers SUN–SAT.
- Click the `←` and `→` buttons and confirm the month/year label updates and the grid re-renders.
- For a day with trades, confirm the cell shows the day number, P&L (green if positive, red if negative), and win rate %, and is colored accordingly.
- Click a day with trades and confirm it navigates to `/journal?date=YYYY-MM-DD` with the Journal's date filter pre-set to that date and the trade table showing only that day's trades.
- For a day with no trades, confirm it shows only the day number on a neutral background and is not clickable.

- [ ] **Step 5: Push**

```bash
git push origin master
```

---

## Self-Review Notes

- **Spec coverage:** All sections of `docs/superpowers/specs/2026-06-11-trading-calendar-design.md` are covered — `lib/calendar.ts` (Task 1), `TradingCalendar` component (Task 2), Dashboard wiring (Task 3), Journal URL-param seeding (Task 4), testing and verification (Task 5).
- **Type consistency:** `CalendarDay` fields (`date`, `day`, `pnl`, `winRate`, `tradeCount`) are used identically in `lib/calendar.ts`, the test file, and `trading-calendar.tsx`. `buildCalendarGrid(trades, year, month)` signature matches its only call site in `trading-calendar.tsx`.
- **Suspense caveat:** The spec argues `useSearchParams` won't require a Suspense boundary because `app/journal/page.tsx` is already dynamic (uses `createClient()` which reads cookies). Task 5 Step 3 includes a fallback fix in case the build proves otherwise — this is a defensive verification step, not a placeholder.
- **No placeholders:** every step has complete, runnable code or exact commands.
