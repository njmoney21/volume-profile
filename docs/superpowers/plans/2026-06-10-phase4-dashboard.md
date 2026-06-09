# Volume Profile — Phase 4: Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Dashboard page showing performance statistics for journal trades: stat cards (win rate, total P&L, avg win/loss, avg RR, total trades), breakdowns by level type / scenario / direction / time-of-day, and a cumulative P&L over time chart.

**Scope decision:** The original design spec includes a "Real / Backtest / Combined" toggle on the Dashboard. Phase 3 (Backtest module) has not been built yet, so there is no backtest data to show. This plan builds the Dashboard for **journal (real) trades only**. The toggle is deferred — when Phase 3 ships, a follow-up task can add it without restructuring this work, since the stats functions operate on a `Trade[]` array regardless of source.

**Tech additions:** `recharts` for the P&L-over-time line chart.

---

## File Map (additions)

```
volume-profile/
├── app/
│   └── dashboard/
│       └── page.tsx                  # Server component — fetches trades, renders DashboardClient
├── components/
│   └── dashboard/
│       ├── dashboard-client.tsx      # Client wrapper — computes stats, renders sections
│       ├── stat-cards.tsx            # Top row of summary stat cards
│       ├── breakdown-table.tsx       # Reusable table for level/scenario/direction/time breakdowns
│       └── pnl-chart.tsx             # Cumulative P&L line chart (recharts)
├── lib/
│   └── trades.ts                     # + statsByLevelType, statsByScenario, statsByDirection,
│                                      #   statsByTimeOfDay, cumulativePnl, BreakdownRow type
├── types/
│   └── index.ts                      # + BreakdownRow, PnlPoint types
└── __tests__/
    └── trades.test.ts                # + tests for new breakdown/chart-data functions
```

---

## Task 1: Breakdown & chart-data functions in lib/trades.ts (TDD)

**Files:**
- Modify: `__tests__/trades.test.ts`
- Modify: `lib/trades.ts`
- Modify: `types/index.ts`

- [ ] **Step 1: Add types**

In `types/index.ts`, add:
```typescript
export interface BreakdownRow {
  label: string
  count: number
  winRate: number
  pnl: number
}

export interface PnlPoint {
  date: string
  cumulative: number
}
```

- [ ] **Step 2: Write failing tests**

Add to `__tests__/trades.test.ts`:
- `statsByLevelType`: given trades with `level_type` POC/VAH/VAL, returns 3 `BreakdownRow`s in order `['POC', 'VAH', 'VAL']`, each with correct `count`, `winRate`, `pnl`. Levels with zero trades still appear with `count: 0, winRate: 0, pnl: 0`.
- `statsByScenario`: returns 2 rows in order `['retest_continue', 'break_retest_reverse']` with labels `'Retest + Continue'` and `'Break + Retest + Reverse'`.
- `statsByDirection`: returns 2 rows in order `['long', 'short']` with labels `'Long'` and `'Short'`.
- `statsByTimeOfDay`: buckets trades by `time_entered` into 5 fixed buckets with labels `'9:30–10:30'`, `'10:30–11:30'`, `'11:30–12:30'`, `'12:30–13:30'`, `'13:30+'`. A trade at exactly `10:30:00` falls into the `10:30–11:30` bucket (lower bound inclusive, next bucket starts at its lower bound). A trade at `13:30:00` or later falls into `'13:30+'`.
- `cumulativePnl`: given trades (unsorted), returns `PnlPoint[]` sorted by date ascending, where each point's `cumulative` is the running sum of `pnl` for all trades on or before that date (group same-day trades into one point — one point per unique date, not per trade).

Run `npm run test:run` — new tests should FAIL (functions don't exist yet).

- [ ] **Step 3: Implement functions**

Add to `lib/trades.ts`:

```typescript
import type { Trade, TradeFilters, TradeFormData, BreakdownRow, PnlPoint } from '@/types'

function rowFor(label: string, trades: Trade[]): BreakdownRow {
  return {
    label,
    count: trades.length,
    winRate: winRate(trades),
    pnl: sumPnl(trades),
  }
}

export function statsByLevelType(trades: Trade[]): BreakdownRow[] {
  return (['POC', 'VAH', 'VAL'] as const).map(level =>
    rowFor(level, trades.filter(t => t.level_type === level))
  )
}

export function statsByScenario(trades: Trade[]): BreakdownRow[] {
  const scenarios: { key: Trade['scenario']; label: string }[] = [
    { key: 'retest_continue', label: 'Retest + Continue' },
    { key: 'break_retest_reverse', label: 'Break + Retest + Reverse' },
  ]
  return scenarios.map(({ key, label }) =>
    rowFor(label, trades.filter(t => t.scenario === key))
  )
}

export function statsByDirection(trades: Trade[]): BreakdownRow[] {
  const directions: { key: Trade['direction']; label: string }[] = [
    { key: 'long', label: 'Long' },
    { key: 'short', label: 'Short' },
  ]
  return directions.map(({ key, label }) =>
    rowFor(label, trades.filter(t => t.direction === key))
  )
}

const TIME_BUCKETS = [
  { label: '9:30–10:30', start: '09:30:00', end: '10:30:00' },
  { label: '10:30–11:30', start: '10:30:00', end: '11:30:00' },
  { label: '11:30–12:30', start: '11:30:00', end: '12:30:00' },
  { label: '12:30–13:30', start: '12:30:00', end: '13:30:00' },
  { label: '13:30+', start: '13:30:00', end: '24:00:00' },
]

export function statsByTimeOfDay(trades: Trade[]): BreakdownRow[] {
  return TIME_BUCKETS.map(({ label, start, end }) =>
    rowFor(label, trades.filter(t => t.time_entered >= start && t.time_entered < end))
  )
}

export function cumulativePnl(trades: Trade[]): PnlPoint[] {
  const byDate = new Map<string, number>()
  for (const t of trades) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.pnl)
  }
  const dates = [...byDate.keys()].sort()
  let running = 0
  return dates.map(date => {
    running = Math.round((running + byDate.get(date)!) * 100) / 100
    return { date, cumulative: running }
  })
}
```

Note: `time_entered` is a Postgres `time` value returned as a string like `"09:30:00"`. The `>=`/`<` string comparisons work correctly for zero-padded `HH:MM:SS` format.

- [ ] **Step 4: Verify tests pass**

```bash
npm run test:run
```
Expected: All tests PASS (existing 35 + new ones).

- [ ] **Step 5: Commit**

```bash
git add lib/trades.ts __tests__/trades.test.ts types/index.ts
git commit -m "feat: add dashboard breakdown and cumulative P&L functions"
```

---

## Task 2: Stat cards component

**Files:**
- Create: `components/dashboard/stat-cards.tsx`

- [ ] **Step 1: Create stat cards**

Create `components/dashboard/stat-cards.tsx`:
```tsx
import { formatPnl } from '@/lib/utils'

interface StatCardsProps {
  totalTrades: number
  winRate: number
  totalPnl: number
  avgWin: number
  avgLoss: number
  avgRR: number
}

function Card({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${valueClass ?? ''}`}>{value}</p>
    </div>
  )
}

export function StatCards({ totalTrades, winRate, totalPnl, avgWin, avgLoss, avgRR }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card label="Total Trades" value={String(totalTrades)} />
      <Card label="Win Rate" value={`${winRate}%`} />
      <Card label="Total P&L" value={formatPnl(totalPnl)}
        valueClass={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'} />
      <Card label="Avg Win" value={formatPnl(avgWin)} valueClass="text-green-400" />
      <Card label="Avg Loss" value={formatPnl(avgLoss)} valueClass="text-red-400" />
      <Card label="Avg R:R" value={avgRR.toFixed(2)} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/stat-cards.tsx
git commit -m "feat: add dashboard stat cards component"
```

---

## Task 3: Breakdown table component

**Files:**
- Create: `components/dashboard/breakdown-table.tsx`

- [ ] **Step 1: Create breakdown table**

Create `components/dashboard/breakdown-table.tsx`:
```tsx
import type { BreakdownRow } from '@/types'
import { formatPnl } from '@/lib/utils'

export function BreakdownTable({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-300 mb-3">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-left text-xs">
            <th className="pb-2 font-medium">Segment</th>
            <th className="pb-2 font-medium text-right">Trades</th>
            <th className="pb-2 font-medium text-right">Win Rate</th>
            <th className="pb-2 font-medium text-right">P&L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-t border-gray-800/50">
              <td className="py-2 text-gray-300">{row.label}</td>
              <td className="py-2 text-right text-gray-400">{row.count}</td>
              <td className="py-2 text-right text-gray-400">{row.count > 0 ? `${row.winRate}%` : '—'}</td>
              <td className={`py-2 text-right font-mono ${
                row.pnl > 0 ? 'text-green-400' : row.pnl < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {row.count > 0 ? formatPnl(row.pnl) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/breakdown-table.tsx
git commit -m "feat: add dashboard breakdown table component"
```

---

## Task 4: P&L over time chart

**Files:**
- Create: `components/dashboard/pnl-chart.tsx`
- Modify: `package.json` (add `recharts`)

- [ ] **Step 1: Install recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Create chart component**

Create `components/dashboard/pnl-chart.tsx`:
```tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { PnlPoint } from '@/types'
import { formatPnl, formatDate } from '@/lib/utils'

export function PnlChart({ data }: { data: PnlPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 h-72 flex items-center justify-center text-sm text-gray-500">
        No trades yet — P&L chart will appear here.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Cumulative P&L</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tickFormatter={formatDate} stroke="#6b7280" fontSize={12} />
          <YAxis tickFormatter={v => formatPnl(v)} stroke="#6b7280" fontSize={12} width={80} />
          <Tooltip
            formatter={(value: number) => formatPnl(value)}
            labelFormatter={formatDate}
            contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run test:run
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/pnl-chart.tsx package.json package-lock.json
git commit -m "feat: add cumulative P&L chart with recharts"
```

---

## Task 5: Dashboard page — wire everything together

**Files:**
- Create: `components/dashboard/dashboard-client.tsx`
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Create client wrapper**

Create `components/dashboard/dashboard-client.tsx`:
```tsx
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
```

- [ ] **Step 2: Create dashboard server page**

Replace `app/dashboard/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/dashboard-client'
import type { Trade } from '@/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('date', { ascending: true })
    .order('time_entered', { ascending: true })

  return <DashboardClient trades={(trades as Trade[]) ?? []} />
}
```

- [ ] **Step 3: Verify**

```bash
npm run test:run
npx tsc --noEmit
npm run lint
npm run build
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/ components/dashboard/
git commit -m "feat: complete dashboard page with stats, breakdowns, and P&L chart"
```

---

## Task 6: Deploy

- [ ] Push to GitHub (`git push`) — Vercel auto-deploys.
- [ ] Open the production Dashboard page, confirm it loads with real journal data (stat cards, breakdown tables, chart) and matches the journal's totals.

---

## What comes next

| Plan | Scope |
|------|-------|
| Phase 2 | Tradovate auto-import via API |
| Phase 3 | Backtest module (sessions, days, trades) — after which a follow-up task can add the Real/Backtest/Combined toggle to this Dashboard |
| Phase 5 | Concepts / research notes page |
