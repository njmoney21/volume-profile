# Journal Redesign — Design Spec

Date: 2026-06-10
Scope: `app/journal/*`, `components/journal/*`, `lib/trades.ts`, `types/index.ts`, `trades` table, and the parts of the Dashboard that consume Journal stats. **Backtest module is explicitly out of scope and unchanged.**

## 1. Goals

The current Journal page has two date-range filters, separate Entry/Exit price + Contracts fields, an auto-calculated P&L, and no way to tag a trade's outcome. The redesign:

1. Collapses the two date filters into a single "on date" exact-match filter (trades are always intraday).
2. Removes Entry Price and Exit Price (both as inputs and table columns).
3. Replaces "Contracts" with "Position Size" — a dollar amount the user put into the trade.
4. Makes P&L a manual numeric entry instead of `calculatePnl(direction, entry, exit, contracts)`.
5. Adds a manual **Result** field: Win / Loss / Breakeven (W/L/BE), separate from `direction` (Long/Short).
6. Reworks win-rate / avg-win / avg-loss / avg-R:R for the Journal to be based on the new `result` field instead of `pnl` sign, and propagates that to the Dashboard.

## 2. Data Model

### `types/index.ts`

```typescript
export type TradeResult = 'win' | 'loss' | 'breakeven'

export interface Trade {
  id: string
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

Removed from `Trade`/`TradeFormData`: `entry_price`, `exit_price`, `contracts`.
Removed from `TradeFilters`: `date_from`, `date_to` → replaced by `date`.

`BacktestTrade`, `BacktestTradeFormData`, and all `Backtest*` types are unchanged.

### Migration: `supabase/migrations/002_journal_redesign.sql`

```sql
alter table trades add column position_size decimal(10,2) not null default 0;
alter table trades add column result text not null default 'breakeven' check (result in ('win','loss','breakeven'));

alter table trades drop column entry_price;
alter table trades drop column exit_price;
alter table trades drop column contracts;

alter table trades alter column position_size drop default;
alter table trades alter column result drop default;
```

The temporary defaults exist solely so the `ALTER TABLE ADD COLUMN ... NOT NULL` succeeds against the one existing row in production. After the migration, that row will have `position_size = 0` and `result = 'breakeven'`; the user will edit it via the UI afterward to fill in real values. The defaults are dropped at the end so future inserts must supply both fields explicitly (matching `prepareTradeData` always providing them).

The user runs this migration manually in the Supabase SQL editor, the same way `001_initial.sql` was applied.

## 3. `lib/utils.ts`

No changes. `calculatePnl` remains, used only by `lib/backtest.ts` (`prepareBacktestTradeData`) for the Backtest module. `formatPnl`, `formatTime`, `formatDate` unchanged.

## 4. `lib/trades.ts`

### Filtering

```typescript
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
```

### Existing generic stats — unchanged, kept for Backtest

`sumPnl`, `winRate`, `avgWin`, `avgLoss`, `avgRR` (all `{ pnl: number }[]` generic) remain exactly as they are today. `lib/backtest.ts` and `components/backtest/session-detail.tsx` continue to import and use these unchanged — Backtest has no `result` field and keeps its existing pnl-sign-based stats.

### New Result-based stats for the Journal

```typescript
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
```

`resultWinRate` denominator is W+L+BE (i.e. all trades) — breakeven trades count toward the total but not toward wins, matching the user's chosen formula: `Win rate = W / (W + L + BE)`.

### Breakdown rows (`statsByLevelType`, `statsByScenario`, `statsByDirection`, `statsByTimeOfDay`)

`rowFor` switches from generic `winRate`/`sumPnl` to `resultWinRate`/`sumPnl`:

```typescript
function rowFor(label: string, trades: Trade[]): BreakdownRow {
  return {
    label,
    count: trades.length,
    winRate: resultWinRate(trades),
    pnl: sumPnl(trades),
  }
}
```

`BreakdownRow` type is unchanged (`label`, `count`, `winRate`, `pnl`) — only the computation behind `winRate` changes for Journal breakdowns. These functions are Journal-only today (not used by Backtest), so this is a safe internal change.

`cumulativePnl` — unchanged, operates purely on `pnl`/`date`.

### `prepareTradeData`

```typescript
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

No more `calculatePnl` call — `pnl` passes through directly from the form.

## 5. `components/journal/trade-form.tsx`

Field order, top to bottom:

1. **Date** / **Time (≥ 09:30)** — unchanged, same row.
2. **Direction** (Long/Short select) / **Result** (Win/Loss/Breakeven select) — same row, replaces the old Direction/Contracts row.
3. **Position Size ($)** / **P&L ($)** — both plain numeric inputs (`step="0.01"`), replacing the old Entry/Exit Price row. P&L input allows negative values (no `min`).
4. *Previous Day Levels* section (POC/VAH/VAL) — unchanged.
5. **Level Traded** / **Level Price** — unchanged.
6. **Scenario** — unchanged.
7. **Notes (optional)** — unchanged.

`defaultForm` becomes:

```typescript
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
```

The edit-mode initializer and the `Number(...)` coercion block in `handleSubmit` are updated to match the new field set (`position_size`, `pnl` numeric; `entry_price`/`exit_price`/`contracts` removed).

The Result `<select>` uses the same `inputClass` styling as other selects, with options:
```html
<option value="win">Win</option>
<option value="loss">Loss</option>
<option value="breakeven">Breakeven</option>
```

## 6. `components/journal/trade-table.tsx`

Columns: **Date | Time | Direction | Result | Level | Scenario | Size | P&L | (actions)**

(Removed: Entry, Exit, Qty. Added: Result, Size.)

- **Result badge**: a colored badge based on `trade.result` — Win → `bg-green-600/20 text-green-400` (or similar), Loss → `bg-red-600/20 text-red-400`, Breakeven → `border border-white/20 text-gray-300`. This is a deliberate departure from the grayscale Direction/Level badges, since Result is meant to be a quick visual signal.
- **Size column**: `${trade.position_size.toFixed(2)}`, rendered in `font-mono text-gray-400` like the old Qty/Entry/Exit cells.
- **P&L cell color**: driven by `trade.result` instead of `trade.pnl` sign — Win → `text-green-600`, Loss → `text-red-600`, Breakeven → `text-gray-400`. The cell content remains `formatPnl(trade.pnl)`.
- Direction and Level badges keep their existing grayscale styling and logic — unchanged.

## 7. `components/journal/filters-bar.tsx`

- The two `<input type="date">` (`date_from`/`date_to`) are replaced by a single `<input type="date">` bound to `filters.date`.
- A new Result `<select>` is added alongside Direction/Level/Scenario:
```html
<option value="">All Results</option>
<option value="win">Win</option>
<option value="loss">Loss</option>
<option value="breakeven">Breakeven</option>
```
- "Clear filters" button logic (`hasFilters` / `onChange({})`) is unchanged — it already works generically over whatever keys are present in `TradeFilters`.

## 8. `app/journal/actions.ts`

No structural changes — `createTrade`/`updateTrade`/`deleteTrade` continue to call `prepareTradeData(formData)` and pass the result to Supabase. The shape of `formData` and the prepared object change per sections 2 and 4, but the action signatures and control flow are identical.

## 9. Dashboard (`components/dashboard/*`)

- `dashboard-client.tsx`: swap `winRate`, `avgWin`, `avgLoss`, `avgRR` imports/calls for `resultWinRate`, `resultAvgWin`, `resultAvgLoss`, `resultAvgRR`. `sumPnl` and `cumulativePnl` calls are unchanged.
- `stat-cards.tsx`, `breakdown-table.tsx`, `pnl-chart.tsx`: no prop-shape changes needed — they already just receive numbers/`BreakdownRow[]`/`PnlPoint[]`. No edits required beyond the data passed in from `dashboard-client.tsx`.
- `journal-client.tsx`: swap `winRate(filtered)` for `resultWinRate(filtered)` in the header summary line.

## 10. Out of Scope

- Backtest module (`app/backtest/*`, `components/backtest/*`, `lib/backtest.ts`, `backtest_trades`/`backtest_days`/`backtest_sessions` tables) — entirely unchanged.
- No new "By Result" breakdown section is added to the Dashboard (not requested; existing breakdowns just change their win-rate computation).
- No derived percentage-return calculation from `position_size` — it is a stored/displayed dollar figure only.

## 11. Testing

Following existing project conventions (Vitest + TDD):
- `lib/trades.ts`: unit tests for `filterTrades` (new `date`/`result` filters), `resultWinRate`, `resultAvgWin`, `resultAvgLoss`, `resultAvgRR`, updated `rowFor`/breakdown functions, and `prepareTradeData`.
- Existing tests for `sumPnl`/`winRate`/`avgWin`/`avgLoss`/`avgRR`/`cumulativePnl` (generic, Backtest-shared) remain unchanged and must continue passing.
- Component-level changes (`trade-form`, `trade-table`, `filters-bar`) follow whatever existing test coverage pattern those files currently have (if any) — primarily verified via `tsc`, `lint`, and manual smoke-check against a dev server.
