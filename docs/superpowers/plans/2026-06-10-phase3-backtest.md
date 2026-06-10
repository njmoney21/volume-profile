# Volume Profile — Phase 3: Backtest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Backtest page: named/dated sessions in a left sidebar, and a right panel showing the selected session's date range, summary stats (total P&L, win rate, # trades, avg R:R), and a table of backtest days (date, prev-day POC/VAH/VAL, # trades, day P&L). Clicking a day expands it to show/add/edit/delete simulated trades for that day. Day P&L is kept in sync automatically whenever trades for that day change.

**Tables already exist** (created in Phase 1, `supabase/migrations/001_initial.sql`): `backtest_sessions` (id, created_at, date_from, date_to, notes), `backtest_days` (id, session_id, date, prev_day_poc, prev_day_vah, prev_day_val, day_pnl), `backtest_trades` (id, session_id, day_id, date, time_entered, direction, entry_price, exit_price, contracts, level_type, level_price, scenario, pnl, notes). Types `BacktestSession`, `BacktestDay`, `BacktestTrade` already exist in `types/index.ts`.

**Scope decisions:**
- `backtest_sessions` has no `name` column — sessions are identified in the UI by their date range (`date_from`–`date_to`), with `notes` shown as an optional freeform label/description.
- A backtest trade's `date` always equals its parent day's `date` and is not user-editable in the trade form (it's set automatically from the day).
- Session summary stats reuse the existing `StatCards` component and the `sumPnl`/`winRate`/`avgWin`/`avgLoss`/`avgRR` functions from `lib/trades.ts`. Those functions are made generic (operate on `{ pnl: number }[]`) so they work for both `Trade[]` and `BacktestTrade[]` without duplication.
- All new UI follows the established black/white theme conventions (see `components/journal/*` and `components/dashboard/*` for reference: `bg-black`, `border border-white/10`, `border-white/20` for inputs, `bg-white text-black` primary buttons, `text-green-600`/`text-red-600` for P&L).

---

## File Map (additions)

```
volume-profile/
├── app/
│   └── backtest/
│       ├── page.tsx                       # Server component — fetches sessions/days/trades
│       └── actions.ts                     # Server actions: session/day/trade CRUD + day_pnl sync
├── components/
│   └── backtest/
│       ├── backtest-client.tsx            # Client wrapper — session selection state
│       ├── session-sidebar.tsx            # List of sessions + "New Session"
│       ├── session-form.tsx               # Modal: create/edit session (date_from, date_to, notes)
│       ├── session-detail.tsx             # Header + summary stats + day table
│       ├── day-table.tsx                  # Table of days, expandable rows
│       ├── day-form.tsx                   # Modal: create/edit day (date, prev POC/VAH/VAL)
│       ├── day-trades.tsx                 # Expanded day: trade list + "Add Trade"
│       └── backtest-trade-form.tsx        # Modal: create/edit backtest trade
├── lib/
│   ├── trades.ts                          # sumPnl/winRate/avgWin/avgLoss/avgRR -> generic over {pnl:number}
│   └── backtest.ts                        # NEW: dayPnl, prepareBacktestTradeData
├── types/
│   └── index.ts                           # + BacktestSessionFormData, BacktestDayFormData, BacktestTradeFormData
└── __tests__/
    └── backtest.test.ts                   # NEW: tests for lib/backtest.ts
```

---

## Task 1: Generic stats + lib/backtest.ts (TDD)

**Files:**
- Modify: `lib/trades.ts`
- Modify: `types/index.ts`
- Create: `lib/backtest.ts`
- Create: `__tests__/backtest.test.ts`

- [ ] **Step 1: Add form data types**

In `types/index.ts`, add:
```typescript
export interface BacktestSessionFormData {
  date_from: string
  date_to: string
  notes?: string
}

export interface BacktestDayFormData {
  date: string
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
}

export interface BacktestTradeFormData {
  time_entered: string
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  scenario: Scenario
  notes?: string
}
```

- [ ] **Step 2: Make stats functions generic**

In `lib/trades.ts`, change the signatures of `sumPnl`, `winRate`, `avgWin`, `avgLoss`, `avgRR` from `(trades: Trade[])` to `(trades: { pnl: number }[])`. The implementations are unchanged — only the parameter type changes (each function only ever reads `.pnl`). This lets the same functions compute summary stats for `BacktestTrade[]` in Task 4.

- [ ] **Step 3: Write failing tests**

Create `__tests__/backtest.test.ts`:
- `dayPnl`: given a `BacktestTrade[]` containing trades for multiple `day_id`s, returns the sum of `pnl` for trades matching the given `day_id`, rounded to 2 decimals. Returns `0` for a `day_id` with no trades.
- `prepareBacktestTradeData`: given `sessionId`, `dayId`, `date`, and a `BacktestTradeFormData`, returns an object with `session_id`, `day_id`, `date` set from the arguments, all form fields copied through, `notes` defaulting to `null` when omitted, and `pnl` computed via `calculatePnl(direction, entry_price, exit_price, contracts)`.
- Reuse a couple of existing `Trade`-shaped fixtures from `__tests__/trades.test.ts` patterns (or inline minimal fixtures) to confirm `sumPnl`/`winRate`/`avgWin`/`avgLoss`/`avgRR` still compute correctly after the generic signature change — these can be lightweight smoke tests, e.g. construct `{ pnl: number }[]` directly and check `sumPnl` and `winRate`.

Run `npm run test:run` — new tests should FAIL (functions don't exist yet).

- [ ] **Step 4: Implement lib/backtest.ts**

Create `lib/backtest.ts`:
```typescript
import type { BacktestTrade, BacktestTradeFormData } from '@/types'
import { calculatePnl } from './utils'

export function dayPnl(trades: BacktestTrade[], dayId: string): number {
  return Math.round(
    trades.filter(t => t.day_id === dayId).reduce((sum, t) => sum + t.pnl, 0) * 100
  ) / 100
}

export function prepareBacktestTradeData(
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
): Omit<BacktestTrade, 'id'> {
  return {
    session_id: sessionId,
    day_id: dayId,
    date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    entry_price: formData.entry_price,
    exit_price: formData.exit_price,
    contracts: formData.contracts,
    level_type: formData.level_type,
    level_price: formData.level_price,
    scenario: formData.scenario,
    pnl: calculatePnl(formData.direction, formData.entry_price, formData.exit_price, formData.contracts),
    notes: formData.notes ?? null,
  }
}
```

- [ ] **Step 5: Verify and commit**

```bash
npm run test:run
npx tsc --noEmit
git add lib/trades.ts lib/backtest.ts types/index.ts __tests__/backtest.test.ts
git commit -m "feat: add backtest helper functions and generalize trade stats"
```

---

## Task 2: Server actions — sessions, days, trades

**Files:**
- Create: `app/backtest/actions.ts`

- [ ] **Step 1: Create server actions**

Create `app/backtest/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { prepareBacktestTradeData } from '@/lib/backtest'
import type { BacktestSessionFormData, BacktestDayFormData, BacktestTradeFormData } from '@/types'
import { revalidatePath } from 'next/cache'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function syncDayPnl(supabase: SupabaseClient, dayId: string) {
  const { data: trades } = await supabase.from('backtest_trades').select('pnl').eq('day_id', dayId)
  const total = Math.round(((trades ?? []).reduce((sum, t) => sum + t.pnl, 0)) * 100) / 100
  await supabase.from('backtest_days').update({ day_pnl: total }).eq('id', dayId)
}

// Sessions

export async function createSession(formData: BacktestSessionFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').insert({
    date_from: formData.date_from,
    date_to: formData.date_to,
    notes: formData.notes ?? null,
  })
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateSession(id: string, formData: BacktestSessionFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').update({
    date_from: formData.date_from,
    date_to: formData.date_to,
    notes: formData.notes ?? null,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteSession(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_sessions').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

// Days

export async function createDay(sessionId: string, formData: BacktestDayFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').insert({
    session_id: sessionId,
    date: formData.date,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    day_pnl: 0,
  })
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateDay(id: string, formData: BacktestDayFormData) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').update({
    date: formData.date,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteDay(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_days').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/backtest')
  return { success: true }
}

// Trades

export async function createBacktestTrade(
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
) {
  const supabase = await createClient()
  const data = prepareBacktestTradeData(sessionId, dayId, date, formData)
  const { error } = await supabase.from('backtest_trades').insert(data)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}

export async function updateBacktestTrade(
  id: string,
  sessionId: string,
  dayId: string,
  date: string,
  formData: BacktestTradeFormData
) {
  const supabase = await createClient()
  const data = prepareBacktestTradeData(sessionId, dayId, date, formData)
  const { error } = await supabase.from('backtest_trades').update(data).eq('id', id)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}

export async function deleteBacktestTrade(id: string, dayId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('backtest_trades').delete().eq('id', id)
  if (error) return { error: error.message }
  await syncDayPnl(supabase, dayId)
  revalidatePath('/backtest')
  return { success: true }
}
```

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add app/backtest/actions.ts
git commit -m "feat: add backtest session/day/trade server actions"
```

---

## Task 3: Session sidebar + session form

**Files:**
- Create: `components/backtest/session-form.tsx`
- Create: `components/backtest/session-sidebar.tsx`

- [ ] **Step 1: Session form modal**

Create `components/backtest/session-form.tsx`. Mirror the structure/styling of `components/journal/trade-form.tsx` (fixed overlay, `bg-black border border-white/10 rounded-xl p-6` modal, `inputClass` with `border border-white/20 ... focus:ring-2 focus:ring-white/30`). Fields: Date From (`type="date"`), Date To (`type="date"`), Notes (`textarea`, optional). On submit calls `createSession` (no `session` prop) or `updateSession(session.id, data)` (when editing). Props:
```typescript
interface SessionFormProps {
  session?: BacktestSession
  onClose: () => void
}
```
Default form: `date_from`/`date_to` both today's date (`new Date().toISOString().split('T')[0]`), `notes: ''`. Show an error message in `text-red-500` if the action returns `{ error }`. Submit button label "Save Changes" when editing, "Create Session" when creating.

- [ ] **Step 2: Session sidebar**

Create `components/backtest/session-sidebar.tsx`:
```typescript
interface SessionSidebarProps {
  sessions: BacktestSession[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}
```
Render a `w-64 shrink-0` column with `bg-black border border-white/10 rounded-xl p-3 flex flex-col gap-2`. At top, a "+ New Session" button (`bg-white hover:bg-gray-200 text-black`, full width). Below, a scrollable list of sessions, each a button:
- Selected: `bg-white/10 text-white`
- Unselected: `text-gray-400 hover:text-white hover:bg-white/10`
- Content: date range formatted with `formatDate` (e.g. "Jun 1, 2026 – Jun 10, 2026") on one line, and `notes` (if present) truncated below in `text-xs text-gray-500 truncate`.

If `sessions.length === 0`, show `text-sm text-gray-500 text-center py-4` message: "No sessions yet. Create one to get started."

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
git add components/backtest/session-form.tsx components/backtest/session-sidebar.tsx
git commit -m "feat: add backtest session sidebar and session form"
```

---

## Task 4: Session detail header + summary stats

**Files:**
- Create: `components/backtest/session-detail.tsx`

- [ ] **Step 1: Create session detail shell**

Create `components/backtest/session-detail.tsx`. This component renders the right-hand panel for the selected session:
```typescript
interface SessionDetailProps {
  session: BacktestSession
  days: BacktestDay[]
  trades: BacktestTrade[]
  onEditSession: () => void
  onDeleteSession: () => void
}
```
Layout:
1. Header row: date range as `formatDate(session.date_from)` – `formatDate(session.date_to)` as `text-xl font-semibold`, `session.notes` below in `text-sm text-gray-400` (if present), and on the right "Edit" / "Delete" buttons (`text-xs text-gray-400 hover:text-white`, delete with a `confirm()` guard calling `onDeleteSession`).
2. Summary stats: compute via `sumPnl(trades)`, `winRate(trades)`, `avgWin(trades)`, `avgLoss(trades)`, `avgRR(trades)`, `trades.length`, and render with the existing `StatCards` component from `@/components/dashboard/stat-cards` (import it — same props shape: `totalTrades, winRate, totalPnl, avgWin, avgLoss, avgRR`).
3. Render `<DayTable days={days} trades={trades} sessionId={session.id} />` below the stats (DayTable built in Task 5; for now this task can stub-import it — actual wiring happens once Task 5 exists, so implement Task 4 and Task 5 together if easier, or leave the import and let Task 5 create the file).

If `days.length === 0` and `trades.length === 0`, the `StatCards` row still renders (all zeros) — `winRate`/`avgWin`/etc. already return `0` for empty arrays.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc --noEmit
git add components/backtest/session-detail.tsx
git commit -m "feat: add backtest session detail header and summary stats"
```

---

## Task 5: Day table + day form

**Files:**
- Create: `components/backtest/day-form.tsx`
- Create: `components/backtest/day-table.tsx`

- [ ] **Step 1: Day form modal**

Create `components/backtest/day-form.tsx`, mirroring `trade-form.tsx` styling. Fields: Date (`type="date"`), Prev Day POC, Prev Day VAH, Prev Day VAL (all `type="number" step="0.25"`). Props:
```typescript
interface DayFormProps {
  sessionId: string
  day?: BacktestDay
  onClose: () => void
}
```
On submit: `createDay(sessionId, data)` or `updateDay(day.id, data)`. Default form: today's date, all levels `0`.

- [ ] **Step 2: Day table**

Create `components/backtest/day-table.tsx`:
```typescript
interface DayTableProps {
  sessionId: string
  days: BacktestDay[]
  trades: BacktestTrade[]
}
```
Render a `bg-black border border-white/10 rounded-xl p-4` card. Header row with "Days" title (`text-sm font-medium text-gray-300`) and "+ Add Day" button (`bg-white hover:bg-gray-200 text-black`, opens `DayForm` with no `day` prop).

Table columns: Date | Prev POC | Prev VAH | Prev VAL | Trades | Day P&L | (chevron/expand indicator). Each row:
- `formatDate(day.date)`
- `day.prev_day_poc`, `day.prev_day_vah`, `day.prev_day_val` (font-mono)
- count of `trades.filter(t => t.day_id === day.id)`
- `formatPnl(day.day_pnl)` colored `text-green-600`/`text-red-600`/`text-gray-400` per sign
- Edit/Delete buttons (same `text-xs text-gray-400 hover:text-white` style as `trade-table.tsx`; delete uses `confirm()` then `deleteDay(day.id)`)

Clicking anywhere on the row (other than Edit/Delete) toggles an `expandedDayId` state (`useState<string | null>`). When a day is expanded, render `<DayTrades sessionId={sessionId} day={day} trades={trades.filter(t => t.day_id === day.id)} />` (built in Task 6) in a row below it spanning all columns.

If `days.length === 0`, show `text-center py-8 text-gray-500 text-sm`: "No days yet. Click \"+ Add Day\" to add the first day of this session."

Sort days by `date` ascending before rendering.

- [ ] **Step 3: Wire DayTable into SessionDetail**

In `components/backtest/session-detail.tsx`, ensure `<DayTable sessionId={session.id} days={days} trades={trades} />` is rendered (replacing any stub from Task 4).

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
git add components/backtest/day-form.tsx components/backtest/day-table.tsx components/backtest/session-detail.tsx
git commit -m "feat: add backtest day table and day form"
```

---

## Task 6: Day trades (expanded view) + backtest trade form

**Files:**
- Create: `components/backtest/backtest-trade-form.tsx`
- Create: `components/backtest/day-trades.tsx`

- [ ] **Step 1: Backtest trade form modal**

Create `components/backtest/backtest-trade-form.tsx`, mirroring `components/journal/trade-form.tsx` but **without** the "Previous Day Levels" section (those belong to the day, not the trade) and without a Date field (date is fixed to the parent day's date, shown read-only as text, e.g. `formatDate(day.date)`, not an input). Fields: Time Entered (`type="time"`, min `09:30`), Direction (select long/short), Contracts, Entry Price, Exit Price, Level Traded (select POC/VAH/VAL), Level Price, Scenario (select), Notes (optional textarea). Props:
```typescript
interface BacktestTradeFormProps {
  sessionId: string
  day: BacktestDay
  trade?: BacktestTrade
  onClose: () => void
}
```
Default form: `time_entered: '09:30'`, `direction: 'long'`, `contracts: 1`, prices `0`, `level_type: 'POC'`, `scenario: 'retest_continue'`, `notes: ''`. On submit:
- Create: `createBacktestTrade(sessionId, day.id, day.date, data)`
- Edit: `updateBacktestTrade(trade.id, sessionId, day.id, day.date, data)`

- [ ] **Step 2: Day trades expanded view**

Create `components/backtest/day-trades.tsx`:
```typescript
interface DayTradesProps {
  sessionId: string
  day: BacktestDay
  trades: BacktestTrade[]
}
```
Render within the expanded row: a header with "Trades" label and "+ Add Trade" button (`bg-white hover:bg-gray-200 text-black text-xs`, opens `BacktestTradeForm` with no `trade` prop). Below, a compact table (reuse the column layout/styling from `components/journal/trade-table.tsx`: Time | Direction | Level | Scenario | Entry | Exit | Qty | P&L | actions), using the same badge styles (`bg-white text-black` for long/POC, `border border-white/20 text-gray-300` otherwise) and P&L coloring (`text-green-600`/`text-red-600`). Edit opens `BacktestTradeForm` with `trade={trade}`; Delete uses `confirm()` then `deleteBacktestTrade(trade.id, day.id)`.

If `trades.length === 0`, show `text-sm text-gray-500 py-3`: "No trades for this day yet."

Sort trades by `time_entered` ascending.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
npm run lint
git add components/backtest/backtest-trade-form.tsx components/backtest/day-trades.tsx
git commit -m "feat: add backtest day trades view and trade form"
```

---

## Task 7: Wire backtest page together

**Files:**
- Create: `components/backtest/backtest-client.tsx`
- Modify: `app/backtest/page.tsx`

- [ ] **Step 1: Create backtest client wrapper**

Create `components/backtest/backtest-client.tsx`:
```typescript
'use client'

import { useState } from 'react'
import type { BacktestSession, BacktestDay, BacktestTrade } from '@/types'
import { deleteSession } from '@/app/backtest/actions'
import { SessionSidebar } from './session-sidebar'
import { SessionForm } from './session-form'
import { SessionDetail } from './session-detail'

interface BacktestClientProps {
  sessions: BacktestSession[]
  days: BacktestDay[]
  trades: BacktestTrade[]
}

export function BacktestClient({ sessions, days, trades }: BacktestClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null)
  const [showSessionForm, setShowSessionForm] = useState(false)
  const [editingSession, setEditingSession] = useState<BacktestSession | null>(null)

  const selected = sessions.find(s => s.id === selectedId) ?? null

  async function handleDeleteSession(id: string) {
    if (!confirm('Delete this session and all its days/trades?')) return
    await deleteSession(id)
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Backtest</h1>
      <div className="flex gap-4 items-start">
        <SessionSidebar
          sessions={sessions}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => { setEditingSession(null); setShowSessionForm(true) }}
        />
        <div className="flex-1">
          {selected ? (
            <SessionDetail
              session={selected}
              days={days.filter(d => d.session_id === selected.id)}
              trades={trades.filter(t => t.session_id === selected.id)}
              onEditSession={() => { setEditingSession(selected); setShowSessionForm(true) }}
              onDeleteSession={() => handleDeleteSession(selected.id)}
            />
          ) : (
            <div className="bg-black border border-white/10 rounded-xl p-8 text-center text-gray-500 text-sm">
              No session selected. Create a session to get started.
            </div>
          )}
        </div>
      </div>

      {showSessionForm && (
        <SessionForm session={editingSession ?? undefined} onClose={() => setShowSessionForm(false)} />
      )}
    </div>
  )
}
```
Adjust prop names/types as needed to match what was actually implemented in Tasks 3–6 (e.g. if `SessionForm`/`SessionDetail` prop names differ slightly, align them here rather than re-deriving from scratch).

- [ ] **Step 2: Create backtest server page**

Replace `app/backtest/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { BacktestClient } from '@/components/backtest/backtest-client'
import type { BacktestSession, BacktestDay, BacktestTrade } from '@/types'

export default async function BacktestPage() {
  const supabase = await createClient()

  const [{ data: sessions }, { data: days }, { data: trades }] = await Promise.all([
    supabase.from('backtest_sessions').select('*').order('date_from', { ascending: false }),
    supabase.from('backtest_days').select('*').order('date', { ascending: true }),
    supabase.from('backtest_trades').select('*').order('time_entered', { ascending: true }),
  ])

  return (
    <BacktestClient
      sessions={(sessions as BacktestSession[]) ?? []}
      days={(days as BacktestDay[]) ?? []}
      trades={(trades as BacktestTrade[]) ?? []}
    />
  )
}
```

- [ ] **Step 3: Verify everything**

```bash
npm run test:run
npx tsc --noEmit
npm run lint
npm run build
```

Fix any type/lint errors surfaced by wiring (e.g. prop name mismatches between `BacktestClient` and the components built in Tasks 3–6).

- [ ] **Step 4: Commit**

```bash
git add app/backtest/page.tsx components/backtest/backtest-client.tsx
git commit -m "feat: wire up backtest page"
```

---

## Task 8: Deploy

- [ ] **Step 1: Push to GitHub**

```bash
git push
```

- [ ] **Step 2: Verify on Vercel**

Confirm the Vercel deployment succeeds and the `/backtest` page loads correctly: create a session, add a day with prev-day levels, expand it, add a trade, and confirm the day P&L and session summary stats update correctly.

---

## What comes next

- The Phase 4 Dashboard's deferred "Real / Backtest / Combined" toggle can now be added, since `BacktestTrade[]` and `Trade[]` both satisfy `{ pnl: number }` and the breakdown/chart functions in `lib/trades.ts` already operate on arrays of objects with the shared fields (`pnl`, `direction`, `level_type`, `scenario`, `time_entered`, `date`) — only pursue if requested.
- Phase 2 (Tradovate auto-import) and Phase 5 (Concepts page) remain unplanned.
