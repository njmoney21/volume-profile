# Journal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Journal module — single date filter, dollar position size instead of contracts, manual P&L entry instead of auto-calculated, and a new W/L/BE result tag that drives win-rate-based stats.

**Architecture:** Update the `trades` table schema via a new migration, update `types/index.ts` and `lib/trades.ts` (new result-based stats functions, alongside the existing pnl-based ones kept for Backtest), then update the three Journal UI components (`trade-form`, `filters-bar`, `trade-table`) and the two stat-consuming components (`journal-client`, `dashboard-client`).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Supabase (Postgres), Vitest.

Spec: `docs/superpowers/specs/2026-06-10-journal-redesign-design.md`

---

### Task 1: Add Supabase migration

**Files:**
- Create: `supabase/migrations/002_journal_redesign.sql`

- [ ] **Step 1: Write the migration file**

```sql
alter table trades add column position_size decimal(10,2) not null default 0;
alter table trades add column result text not null default 'breakeven' check (result in ('win','loss','breakeven'));

alter table trades drop column entry_price;
alter table trades drop column exit_price;
alter table trades drop column contracts;

alter table trades alter column position_size drop default;
alter table trades alter column result drop default;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/002_journal_redesign.sql
git commit -m "Add migration for journal redesign (position_size, result)"
```

- [ ] **Step 3: Tell the user to run it**

This migration must be run manually in the Supabase SQL editor (same as `001_initial.sql` was). After running it, the one existing row in `trades` will have `position_size = 0` and `result = 'breakeven'` — the user can edit that trade afterward in the UI to fill in real values. Note this to the user; do not attempt to run it yourself.

---

### Task 2: Update `types/index.ts`

**Files:**
- Modify: `types/index.ts:1-48`

- [ ] **Step 1: Replace the `Trade`, `TradeFormData`, and `TradeFilters` types, and add `TradeResult`**

Replace lines 1-48 (from `export type Direction = 'long' | 'short'` through the end of `TradeFilters`) with:

```typescript
export type Direction = 'long' | 'short'
export type LevelType = 'POC' | 'VAH' | 'VAL'
export type Scenario = 'retest_continue' | 'break_retest_reverse'
export type TradeSource = 'auto' | 'manual'
export type TradeResult = 'win' | 'loss' | 'breakeven'

export interface Trade {
  id: string
  date: string           // "2026-06-09"
  time_entered: string   // "HH:MM:SS"
  direction: Direction
  position_size: number
  level_type: LevelType
  level_price: number
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  scenario: Scenario
  result: TradeResult
  pnl: number
  notes: string | null
  source: TradeSource
  created_at: string
}

export interface TradeFormData {
  date: string
  time_entered: string
  direction: Direction
  position_size: number
  level_type: LevelType
  level_price: number
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  scenario: Scenario
  result: TradeResult
  pnl: number
  notes?: string
}

export interface TradeFilters {
  date?: string
  direction?: Direction
  level_type?: LevelType
  scenario?: Scenario
  result?: TradeResult
}
```

Everything below this (BacktestSession, BacktestDay, BacktestTrade, BreakdownRow, PnlPoint, BacktestSessionFormData, BacktestDayFormData, BacktestTradeFormData, Concept) is unchanged — leave as-is.

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "Update Trade types for journal redesign"
```

(`tsc` will report errors in `lib/trades.ts` and `components/journal/*` at this point — that's expected and fixed in the following tasks.)

---

### Task 3: Update `lib/trades.ts` and its tests

**Files:**
- Modify: `lib/trades.ts` (full rewrite)
- Modify: `__tests__/trades.test.ts` (full rewrite)

- [ ] **Step 1: Write the updated test file**

Replace the entire contents of `__tests__/trades.test.ts` with:

```typescript
import { describe, it, expect } from 'vitest'
import {
  filterTrades,
  sumPnl,
  winRate,
  avgWin,
  avgLoss,
  avgRR,
  resultWinRate,
  resultAvgWin,
  resultAvgLoss,
  resultAvgRR,
  prepareTradeData,
  statsByLevelType,
  statsByScenario,
  statsByDirection,
  statsByTimeOfDay,
  cumulativePnl,
} from '@/lib/trades'
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

describe('filterTrades', () => {
  const trades = [
    makeTrade({ id: '1', date: '2026-06-09', direction: 'long', level_type: 'POC', scenario: 'retest_continue', result: 'win' }),
    makeTrade({ id: '2', date: '2026-06-08', direction: 'short', level_type: 'VAH', scenario: 'break_retest_reverse', result: 'loss' }),
    makeTrade({ id: '3', date: '2026-06-07', direction: 'long', level_type: 'VAL', scenario: 'retest_continue', result: 'breakeven' }),
  ]

  it('returns all trades when no filters applied', () => {
    expect(filterTrades(trades, {})).toHaveLength(3)
  })

  it('filters by direction', () => {
    const result = filterTrades(trades, { direction: 'long' })
    expect(result).toHaveLength(2)
    expect(result.every(t => t.direction === 'long')).toBe(true)
  })

  it('filters by level_type', () => {
    const result = filterTrades(trades, { level_type: 'POC' })
    expect(result).toHaveLength(1)
    expect(result[0].level_type).toBe('POC')
  })

  it('filters by scenario', () => {
    const result = filterTrades(trades, { scenario: 'retest_continue' })
    expect(result).toHaveLength(2)
  })

  it('filters by date (exact match)', () => {
    const result = filterTrades(trades, { date: '2026-06-08' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('filters by result', () => {
    const result = filterTrades(trades, { result: 'loss' })
    expect(result).toHaveLength(1)
    expect(result[0].result).toBe('loss')
  })

  it('combines multiple filters', () => {
    const result = filterTrades(trades, { direction: 'long', level_type: 'POC' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })
})

describe('sumPnl', () => {
  it('sums P&L correctly', () => {
    const trades = [makeTrade({ pnl: 200 }), makeTrade({ pnl: -100 }), makeTrade({ pnl: 50 })]
    expect(sumPnl(trades)).toBe(150)
  })

  it('returns 0 for empty array', () => {
    expect(sumPnl([])).toBe(0)
  })
})

describe('winRate', () => {
  it('calculates correctly: 2 of 4 wins = 50%', () => {
    const trades = [
      makeTrade({ pnl: 200 }),
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: -100 }),
    ]
    expect(winRate(trades)).toBe(50)
  })

  it('returns 0 for empty array', () => {
    expect(winRate([])).toBe(0)
  })

  it('returns 100 when all trades are winners', () => {
    expect(winRate([makeTrade({ pnl: 100 }), makeTrade({ pnl: 200 })])).toBe(100)
  })
})

describe('avgWin', () => {
  it('averages only winning trades', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: 100 }), makeTrade({ pnl: -200 })]
    expect(avgWin(trades)).toBe(200)
  })

  it('returns 0 when no winners', () => {
    expect(avgWin([makeTrade({ pnl: -100 })])).toBe(0)
  })
})

describe('avgLoss', () => {
  it('averages only losing trades (negative value)', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: -100 }), makeTrade({ pnl: -200 })]
    expect(avgLoss(trades)).toBe(-150)
  })

  it('returns 0 when no losers', () => {
    expect(avgLoss([makeTrade({ pnl: 100 })])).toBe(0)
  })
})

describe('avgRR', () => {
  it('calculates risk/reward ratio', () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: -100 })]
    expect(avgRR(trades)).toBe(3)
  })

  it('returns 0 when no losers', () => {
    expect(avgRR([makeTrade({ pnl: 100 })])).toBe(0)
  })
})

describe('resultWinRate', () => {
  it('calculates W / (W + L + BE): 2 wins of 4 = 50%', () => {
    const trades = [
      makeTrade({ result: 'win' }),
      makeTrade({ result: 'win' }),
      makeTrade({ result: 'loss' }),
      makeTrade({ result: 'breakeven' }),
    ]
    expect(resultWinRate(trades)).toBe(50)
  })

  it('returns 0 for empty array', () => {
    expect(resultWinRate([])).toBe(0)
  })

  it('returns 100 when all trades are wins', () => {
    expect(resultWinRate([makeTrade({ result: 'win' }), makeTrade({ result: 'win' })])).toBe(100)
  })

  it('counts breakeven trades in the denominator but not as wins', () => {
    const trades = [makeTrade({ result: 'win' }), makeTrade({ result: 'breakeven' })]
    expect(resultWinRate(trades)).toBe(50)
  })
})

describe('resultAvgWin', () => {
  it('averages pnl of trades tagged as win', () => {
    const trades = [
      makeTrade({ result: 'win', pnl: 300 }),
      makeTrade({ result: 'win', pnl: 100 }),
      makeTrade({ result: 'loss', pnl: -200 }),
    ]
    expect(resultAvgWin(trades)).toBe(200)
  })

  it('returns 0 when no trades tagged as win', () => {
    expect(resultAvgWin([makeTrade({ result: 'loss', pnl: -100 })])).toBe(0)
  })
})

describe('resultAvgLoss', () => {
  it('averages pnl of trades tagged as loss', () => {
    const trades = [
      makeTrade({ result: 'win', pnl: 300 }),
      makeTrade({ result: 'loss', pnl: -100 }),
      makeTrade({ result: 'loss', pnl: -200 }),
    ]
    expect(resultAvgLoss(trades)).toBe(-150)
  })

  it('returns 0 when no trades tagged as loss', () => {
    expect(resultAvgLoss([makeTrade({ result: 'win', pnl: 100 })])).toBe(0)
  })
})

describe('resultAvgRR', () => {
  it('calculates risk/reward ratio from result-tagged trades', () => {
    const trades = [
      makeTrade({ result: 'win', pnl: 300 }),
      makeTrade({ result: 'loss', pnl: -100 }),
    ]
    expect(resultAvgRR(trades)).toBe(3)
  })

  it('returns 0 when no trades tagged as loss', () => {
    expect(resultAvgRR([makeTrade({ result: 'win', pnl: 100 })])).toBe(0)
  })
})

describe('statsByLevelType', () => {
  it('returns 3 rows in order POC, VAH, VAL with correct stats', () => {
    const trades = [
      makeTrade({ id: '1', level_type: 'POC', result: 'win', pnl: 200 }),
      makeTrade({ id: '2', level_type: 'POC', result: 'loss', pnl: -100 }),
      makeTrade({ id: '3', level_type: 'VAH', result: 'win', pnl: 300 }),
    ]
    const result = statsByLevelType(trades)
    expect(result).toHaveLength(3)
    expect(result.map(r => r.label)).toEqual(['POC', 'VAH', 'VAL'])

    expect(result[0]).toEqual({ label: 'POC', count: 2, winRate: 50, pnl: 100 })
    expect(result[1]).toEqual({ label: 'VAH', count: 1, winRate: 100, pnl: 300 })
    expect(result[2]).toEqual({ label: 'VAL', count: 0, winRate: 0, pnl: 0 })
  })
})

describe('statsByScenario', () => {
  it('returns 2 rows in order with correct labels', () => {
    const trades = [
      makeTrade({ id: '1', scenario: 'retest_continue', result: 'win', pnl: 200 }),
      makeTrade({ id: '2', scenario: 'break_retest_reverse', result: 'loss', pnl: -100 }),
      makeTrade({ id: '3', scenario: 'break_retest_reverse', result: 'win', pnl: 50 }),
    ]
    const result = statsByScenario(trades)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.label)).toEqual(['Retest + Continue', 'Break + Retest + Reverse'])

    expect(result[0]).toEqual({ label: 'Retest + Continue', count: 1, winRate: 100, pnl: 200 })
    expect(result[1]).toEqual({ label: 'Break + Retest + Reverse', count: 2, winRate: 50, pnl: -50 })
  })
})

describe('statsByDirection', () => {
  it('returns 2 rows in order with correct labels', () => {
    const trades = [
      makeTrade({ id: '1', direction: 'long', result: 'win', pnl: 200 }),
      makeTrade({ id: '2', direction: 'long', result: 'loss', pnl: -100 }),
      makeTrade({ id: '3', direction: 'short', result: 'win', pnl: 50 }),
    ]
    const result = statsByDirection(trades)
    expect(result).toHaveLength(2)
    expect(result.map(r => r.label)).toEqual(['Long', 'Short'])

    expect(result[0]).toEqual({ label: 'Long', count: 2, winRate: 50, pnl: 100 })
    expect(result[1]).toEqual({ label: 'Short', count: 1, winRate: 100, pnl: 50 })
  })
})

describe('statsByTimeOfDay', () => {
  it('buckets trades into 5 fixed time buckets with fixed labels', () => {
    const trades = [
      makeTrade({ id: '1', time_entered: '09:30:00', pnl: 100 }),
      makeTrade({ id: '2', time_entered: '10:29:59', pnl: -50 }),
      makeTrade({ id: '3', time_entered: '10:30:00', pnl: 200 }),
      makeTrade({ id: '4', time_entered: '11:45:00', pnl: 100 }),
      makeTrade({ id: '5', time_entered: '12:30:00', pnl: -100 }),
      makeTrade({ id: '6', time_entered: '13:29:59', pnl: 50 }),
      makeTrade({ id: '7', time_entered: '13:30:00', pnl: 100 }),
      makeTrade({ id: '8', time_entered: '15:00:00', pnl: -100 }),
    ]
    const result = statsByTimeOfDay(trades)
    expect(result).toHaveLength(5)
    expect(result.map(r => r.label)).toEqual([
      '9:30–10:30',
      '10:30–11:30',
      '11:30–12:30',
      '12:30–13:30',
      '13:30+',
    ])

    // 9:30–10:30 -> trades 1, 2
    expect(result[0].count).toBe(2)
    // 10:30–11:30 -> trade 3 (10:30:00 falls here, lower bound inclusive)
    expect(result[1].count).toBe(1)
    // 11:30–12:30 -> trade 4
    expect(result[2].count).toBe(1)
    // 12:30–13:30 -> trades 5, 6
    expect(result[3].count).toBe(2)
    // 13:30+ -> trades 7, 8
    expect(result[4].count).toBe(2)
  })

  it('handles a trade with no time_entered for any bucket gracefully (zero counts allowed)', () => {
    const result = statsByTimeOfDay([])
    expect(result).toHaveLength(5)
    result.forEach(row => {
      expect(row).toMatchObject({ count: 0, winRate: 0, pnl: 0 })
    })
  })
})

describe('cumulativePnl', () => {
  it('returns points sorted by date ascending with running cumulative sum', () => {
    const trades = [
      makeTrade({ id: '1', date: '2026-06-09', pnl: 100 }),
      makeTrade({ id: '2', date: '2026-06-07', pnl: 50 }),
      makeTrade({ id: '3', date: '2026-06-08', pnl: -30 }),
      makeTrade({ id: '4', date: '2026-06-08', pnl: 20 }),
    ]
    const result = cumulativePnl(trades)
    expect(result).toEqual([
      { date: '2026-06-07', cumulative: 50 },
      { date: '2026-06-08', cumulative: 40 },
      { date: '2026-06-09', cumulative: 140 },
    ])
  })

  it('returns empty array for no trades', () => {
    expect(cumulativePnl([])).toEqual([])
  })
})

describe('prepareTradeData', () => {
  it('passes through manual pnl, position_size, and result; sets source to manual', () => {
    const result = prepareTradeData({
      date: '2026-06-09',
      time_entered: '10:00',
      direction: 'long',
      position_size: 1500,
      level_type: 'POC',
      level_price: 21000,
      prev_day_poc: 21000,
      prev_day_vah: 21050,
      prev_day_val: 20950,
      scenario: 'retest_continue',
      result: 'win',
      pnl: 200,
    })
    expect(result.pnl).toBe(200)
    expect(result.position_size).toBe(1500)
    expect(result.result).toBe('win')
    expect(result.source).toBe('manual')
    expect(result.notes).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/trades.test.ts`
Expected: FAIL — `resultWinRate`, `resultAvgWin`, `resultAvgLoss`, `resultAvgRR` are not exported from `lib/trades.ts`, and `filterTrades`/`prepareTradeData`/`rowFor`-based tests fail because `lib/trades.ts` still uses the old field names.

- [ ] **Step 3: Rewrite `lib/trades.ts`**

Replace the entire contents of `lib/trades.ts` with:

```typescript
import type { Trade, TradeFilters, TradeFormData, BreakdownRow, PnlPoint } from '@/types'

export function filterTrades(trades: Trade[], filters: TradeFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.level_type && trade.level_type !== filters.level_type) return false
    if (filters.scenario && trade.scenario !== filters.scenario) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.date && trade.date !== filters.date) return false
    return true
  })
}

export function sumPnl(trades: { pnl: number }[]): number {
  return Math.round(trades.reduce((sum, t) => sum + t.pnl, 0) * 100) / 100
}

export function winRate(trades: { pnl: number }[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100)
}

export function avgWin(trades: { pnl: number }[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function avgLoss(trades: { pnl: number }[]): number {
  const losers = trades.filter(t => t.pnl < 0)
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function avgRR(trades: { pnl: number }[]): number {
  const win = Math.abs(avgWin(trades))
  const loss = Math.abs(avgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

export function resultWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  const wins = trades.filter(t => t.result === 'win').length
  return Math.round((wins / trades.length) * 100)
}

export function resultAvgWin(trades: Trade[]): number {
  const winners = trades.filter(t => t.result === 'win')
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function resultAvgLoss(trades: Trade[]): number {
  const losers = trades.filter(t => t.result === 'loss')
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function resultAvgRR(trades: Trade[]): number {
  const win = Math.abs(resultAvgWin(trades))
  const loss = Math.abs(resultAvgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

function rowFor(label: string, trades: Trade[]): BreakdownRow {
  return {
    label,
    count: trades.length,
    winRate: resultWinRate(trades),
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

export function prepareTradeData(formData: TradeFormData): Omit<Trade, 'id' | 'created_at'> {
  return {
    date: formData.date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    position_size: formData.position_size,
    level_type: formData.level_type,
    level_price: formData.level_price,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    scenario: formData.scenario,
    result: formData.result,
    pnl: formData.pnl,
    notes: formData.notes ?? null,
    source: 'manual',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/trades.test.ts`
Expected: PASS (all tests in this file green)

- [ ] **Step 5: Commit**

```bash
git add lib/trades.ts __tests__/trades.test.ts
git commit -m "Add result-based stats to lib/trades.ts for journal redesign"
```

---

### Task 4: Redesign `components/journal/trade-form.tsx`

**Files:**
- Modify: `components/journal/trade-form.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `components/journal/trade-form.tsx` with:

```tsx
'use client'

import { useState } from 'react'
import { createTrade, updateTrade } from '@/app/journal/actions'
import type { Trade, TradeFormData, Direction, LevelType, Scenario, TradeResult } from '@/types'

const inputClass =
  'bg-black border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/30 w-full'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const defaultForm: TradeFormData = {
  date: new Date().toISOString().split('T')[0],
  time_entered: '09:30',
  direction: 'long',
  position_size: 0,
  level_type: 'POC',
  level_price: 0,
  prev_day_poc: 0,
  prev_day_vah: 0,
  prev_day_val: 0,
  scenario: 'retest_continue',
  result: 'breakeven',
  pnl: 0,
  notes: '',
}

interface TradeFormProps {
  trade?: Trade
  onClose: () => void
}

export function TradeForm({ trade, onClose }: TradeFormProps) {
  const [form, setForm] = useState<TradeFormData>(
    trade
      ? {
          date: trade.date,
          time_entered: trade.time_entered.slice(0, 5),
          direction: trade.direction,
          position_size: trade.position_size,
          level_type: trade.level_type,
          level_price: trade.level_price,
          prev_day_poc: trade.prev_day_poc,
          prev_day_vah: trade.prev_day_vah,
          prev_day_val: trade.prev_day_val,
          scenario: trade.scenario,
          result: trade.result,
          pnl: trade.pnl,
          notes: trade.notes ?? '',
        }
      : defaultForm
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(key: keyof TradeFormData, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const data: TradeFormData = {
      ...form,
      position_size: Number(form.position_size),
      pnl: Number(form.pnl),
      level_price: Number(form.level_price),
      prev_day_poc: Number(form.prev_day_poc),
      prev_day_vah: Number(form.prev_day_vah),
      prev_day_val: Number(form.prev_day_val),
    }

    const result = trade ? await updateTrade(trade.id, data) : await createTrade(data)

    if ('error' in result && result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-black border border-white/10 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          <div className="grid grid-cols-2 gap-4">
            <Field label="Date">
              <input type="date" value={form.date}
                onChange={e => set('date', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="Time (≥ 09:30)">
              <input type="time" value={form.time_entered} min="09:30"
                onChange={e => set('time_entered', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Direction">
              <select value={form.direction}
                onChange={e => set('direction', e.target.value as Direction)}
                className={inputClass}>
                <option value="long">Long</option>
                <option value="short">Short</option>
              </select>
            </Field>
            <Field label="Result">
              <select value={form.result}
                onChange={e => set('result', e.target.value as TradeResult)}
                className={inputClass}>
                <option value="win">Win</option>
                <option value="loss">Loss</option>
                <option value="breakeven">Breakeven</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Position Size ($)">
              <input type="number" step="0.01" value={form.position_size}
                onChange={e => set('position_size', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="P&L ($)">
              <input type="number" step="0.01" value={form.pnl}
                onChange={e => set('pnl', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 mb-3">Previous Day Levels</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="POC (Red)">
                <input type="number" step="0.25" value={form.prev_day_poc}
                  onChange={e => set('prev_day_poc', e.target.value)}
                  className={inputClass} required />
              </Field>
              <Field label="VAH (Purple)">
                <input type="number" step="0.25" value={form.prev_day_vah}
                  onChange={e => set('prev_day_vah', e.target.value)}
                  className={inputClass} required />
              </Field>
              <Field label="VAL (Purple)">
                <input type="number" step="0.25" value={form.prev_day_val}
                  onChange={e => set('prev_day_val', e.target.value)}
                  className={inputClass} required />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Level Traded">
              <select value={form.level_type}
                onChange={e => set('level_type', e.target.value as LevelType)}
                className={inputClass}>
                <option value="POC">POC (Red)</option>
                <option value="VAH">VAH (Purple)</option>
                <option value="VAL">VAL (Purple)</option>
              </select>
            </Field>
            <Field label="Level Price">
              <input type="number" step="0.25" value={form.level_price}
                onChange={e => set('level_price', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <Field label="Scenario">
            <select value={form.scenario}
              onChange={e => set('scenario', e.target.value as Scenario)}
              className={inputClass}>
              <option value="retest_continue">Retest + Continue</option>
              <option value="break_retest_reverse">Break + Retest + Reverse</option>
            </select>
          </Field>

          <Field label="Notes (optional)">
            <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
              className={`${inputClass} h-20 resize-none`} />
          </Field>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-white hover:bg-gray-200 text-black rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : trade ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/journal/trade-form.tsx
git commit -m "Redesign trade form: position size, manual P&L, result field"
```

---

### Task 5: Redesign `components/journal/filters-bar.tsx`

**Files:**
- Modify: `components/journal/filters-bar.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `components/journal/filters-bar.tsx` with:

```tsx
'use client'

import type { TradeFilters } from '@/types'

const selectClass =
  'bg-black border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30'

interface FiltersBarProps {
  filters: TradeFilters
  onChange: (filters: TradeFilters) => void
}

export function FiltersBar({ filters, onChange }: FiltersBarProps) {
  function set(key: keyof TradeFilters, value: string) {
    onChange({ ...filters, [key]: value || undefined })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input type="date" value={filters.date ?? ''} title="Date"
        onChange={e => set('date', e.target.value)} className={selectClass} />
      <select value={filters.direction ?? ''}
        onChange={e => set('direction', e.target.value)} className={selectClass}>
        <option value="">All Directions</option>
        <option value="long">Long</option>
        <option value="short">Short</option>
      </select>
      <select value={filters.level_type ?? ''}
        onChange={e => set('level_type', e.target.value)} className={selectClass}>
        <option value="">All Levels</option>
        <option value="POC">POC</option>
        <option value="VAH">VAH</option>
        <option value="VAL">VAL</option>
      </select>
      <select value={filters.scenario ?? ''}
        onChange={e => set('scenario', e.target.value)} className={selectClass}>
        <option value="">All Scenarios</option>
        <option value="retest_continue">Retest + Continue</option>
        <option value="break_retest_reverse">Break + Retest + Reverse</option>
      </select>
      <select value={filters.result ?? ''}
        onChange={e => set('result', e.target.value)} className={selectClass}>
        <option value="">All Results</option>
        <option value="win">Win</option>
        <option value="loss">Loss</option>
        <option value="breakeven">Breakeven</option>
      </select>
      {hasFilters && (
        <button onClick={() => onChange({})}
          className="text-xs text-gray-400 hover:text-white transition-colors">
          Clear filters
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/journal/filters-bar.tsx
git commit -m "Collapse journal date filters into one, add result filter"
```

---

### Task 6: Redesign `components/journal/trade-table.tsx`

**Files:**
- Modify: `components/journal/trade-table.tsx` (full rewrite)

- [ ] **Step 1: Rewrite the file**

Replace the entire contents of `components/journal/trade-table.tsx` with:

```tsx
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
      <div className="text-center py-16 text-gray-500 text-sm">
        No trades yet. Click &quot;+ Add Trade&quot; to log your first trade.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-left">
              {['Date', 'Time', 'Direction', 'Result', 'Level', 'Scenario', 'Size', 'P&L', ''].map(h => (
                <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="py-3 pr-4">{formatDate(trade.date)}</td>
                <td className="py-3 pr-4 text-gray-400">{formatTime(trade.time_entered)}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.direction === 'long'
                      ? 'bg-white text-black'
                      : 'border border-white/20 text-gray-300'
                  }`}>
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${resultBadgeClass[trade.result]}`}>
                    {resultLabel[trade.result]}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.level_type === 'POC'
                      ? 'bg-white text-black'
                      : 'border border-white/20 text-gray-300'
                  }`}>
                    {trade.level_type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs">{scenarioLabel[trade.scenario]}</td>
                <td className="py-3 pr-4 font-mono text-gray-400">${trade.position_size.toFixed(2)}</td>
                <td className={`py-3 pr-4 font-mono font-medium ${resultPnlClass[trade.result]}`}>
                  {formatPnl(trade.pnl)}
                </td>
                <td className="py-3">
                  <div className="flex gap-3">
                    <button onClick={() => setEditing(trade)}
                      className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => handleDelete(trade.id)}
                      className="text-xs text-gray-400 hover:text-white transition-colors">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <TradeForm trade={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/journal/trade-table.tsx
git commit -m "Redesign trade table: result/size columns, result-driven coloring"
```

---

### Task 7: Update `components/journal/journal-client.tsx`

**Files:**
- Modify: `components/journal/journal-client.tsx:5,17`

- [ ] **Step 1: Swap `winRate` for `resultWinRate`**

In `components/journal/journal-client.tsx`, change line 5:

```typescript
import { filterTrades, sumPnl, winRate } from '@/lib/trades'
```

to:

```typescript
import { filterTrades, sumPnl, resultWinRate } from '@/lib/trades'
```

And change line 17:

```typescript
  const wr = winRate(filtered)
```

to:

```typescript
  const wr = resultWinRate(filtered)
```

- [ ] **Step 2: Commit**

```bash
git add components/journal/journal-client.tsx
git commit -m "Use result-based win rate in journal header"
```

---

### Task 8: Update `components/dashboard/dashboard-client.tsx`

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx:4-27`

- [ ] **Step 1: Swap generic stats for result-based stats**

In `components/dashboard/dashboard-client.tsx`, change the import block (lines 4-7):

```typescript
import {
  sumPnl, winRate, avgWin, avgLoss, avgRR,
  statsByLevelType, statsByScenario, statsByDirection, statsByTimeOfDay, cumulativePnl,
} from '@/lib/trades'
```

to:

```typescript
import {
  sumPnl, resultWinRate, resultAvgWin, resultAvgLoss, resultAvgRR,
  statsByLevelType, statsByScenario, statsByDirection, statsByTimeOfDay, cumulativePnl,
} from '@/lib/trades'
```

And change the `<StatCards .../>` props (lines 20-27):

```tsx
      <StatCards
        totalTrades={trades.length}
        winRate={winRate(trades)}
        totalPnl={sumPnl(trades)}
        avgWin={avgWin(trades)}
        avgLoss={avgLoss(trades)}
        avgRR={avgRR(trades)}
      />
```

to:

```tsx
      <StatCards
        totalTrades={trades.length}
        winRate={resultWinRate(trades)}
        totalPnl={sumPnl(trades)}
        avgWin={resultAvgWin(trades)}
        avgLoss={resultAvgLoss(trades)}
        avgRR={resultAvgRR(trades)}
      />
```

- [ ] **Step 2: Commit**

```bash
git add components/dashboard/dashboard-client.tsx
git commit -m "Use result-based stats on dashboard"
```

---

### Task 9: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: No errors. If `app/journal/actions.ts` or any other file references removed fields (`entry_price`, `exit_price`, `contracts`, `date_from`, `date_to`), fix those references using the new field names from `types/index.ts` (Task 2).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: All tests pass (including `__tests__/trades.test.ts` from Task 3 and any pre-existing Backtest tests, which must remain unaffected).

- [ ] **Step 4: Build the project**

Run: `npm run build`
Expected: Build succeeds with no type or compile errors.

- [ ] **Step 5: Push to GitHub**

```bash
git push origin master
```

Vercel will deploy automatically. Remind the user that they still need to run `supabase/migrations/002_journal_redesign.sql` in the Supabase SQL editor (Task 1, Step 3) for the deployed app to work against the new schema — and that after running it, they should edit their one existing journal trade to fill in `position_size`/`result` since it will default to `0`/`breakeven`.
