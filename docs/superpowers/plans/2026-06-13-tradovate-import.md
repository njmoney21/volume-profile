# Tradovate Auto-Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-import executed fills from a Tradovate demo account, pair them into closed round-trip trades via FIFO matching, and insert them into the Journal as drafts for the user to annotate with volume-profile strategy fields before they count toward dashboard stats.

**Architecture:** A pure FIFO-pairing function (`lib/tradovate/pairFills.ts`) turns raw fills into draft `TradeFormData`. A small Tradovate API client (`lib/tradovate/client.ts`) authenticates and fetches fills/contracts. `app/api/import/tradovate/route.ts` ties these together behind a session-or-cron auth check, using a service-role Supabase client (`lib/supabase/admin.ts`) to write drafts and track dedup via a new `imported_fills` table. The Journal UI gets an import button, a draft/reviewed status filter, and draft styling; the Dashboard excludes drafts from strategy-performance stats.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Vitest, Supabase (Postgres), Vercel Cron.

**Reference spec:** `docs/superpowers/specs/2026-06-13-tradovate-import-design.md`

---

### Task 1: Migration + type changes for draft trades

**Files:**
- Create: `supabase/migrations/004_tradovate_import.sql`
- Modify: `types/index.ts`
- Modify: `__tests__/trades.test.ts`
- Modify: `__tests__/calendar.test.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/004_tradovate_import.sql`:

```sql
-- Strategy-annotation fields become optional (drafts won't have them yet)
alter table trades alter column level_type drop not null;
alter table trades alter column level_price drop not null;
alter table trades alter column prev_day_poc drop not null;
alter table trades alter column prev_day_vah drop not null;
alter table trades alter column prev_day_val drop not null;
alter table trades alter column scenario drop not null;

-- Draft/reviewed status
alter table trades add column status text not null default 'reviewed'
  check (status in ('draft', 'reviewed'));

-- Dedup tracking for imported Tradovate fills
create table imported_fills (
  fill_id bigint primary key,
  trade_id uuid references trades(id) on delete set null,
  imported_at timestamptz not null default now()
);

alter table imported_fills enable row level security;
create policy "auth_imported_fills" on imported_fills for all to authenticated using (true) with check (true);
```

This file is applied directly against the Supabase project (via the SQL editor or `supabase db push`) — it is not run by the test suite. No test for this step; proceed to the type changes.

- [ ] **Step 2: Update `types/index.ts`**

In `types/index.ts`, add `TradeStatus` near the other type aliases at the top:

```typescript
export type TradeStatus = 'draft' | 'reviewed'
```

Then update the `Trade` interface — six fields become nullable and a `status` field is added:

```typescript
export interface Trade {
  id: string
  date: string           // "2026-06-09"
  time_entered: string   // "HH:MM:SS"
  direction: Direction
  position_size: number
  level_type: LevelType | null
  level_price: number | null
  prev_day_poc: number | null
  prev_day_vah: number | null
  prev_day_val: number | null
  scenario: Scenario | null
  result: TradeResult
  pnl: number
  notes: string | null
  source: TradeSource
  status: TradeStatus
  created_at: string
}
```

Then update `TradeFormData` — the same six fields become optional/nullable, and `source` becomes an optional pass-through (so editing an `auto` draft doesn't get silently rewritten to `manual`):

```typescript
export interface TradeFormData {
  date: string
  time_entered: string
  direction: Direction
  position_size: number
  level_type?: LevelType | null
  level_price?: number | null
  prev_day_poc?: number | null
  prev_day_vah?: number | null
  prev_day_val?: number | null
  scenario?: Scenario | null
  result: TradeResult
  pnl: number
  notes?: string
  source?: TradeSource
}
```

Finally, add `status` to `TradeFilters`:

```typescript
export interface TradeFilters {
  date?: string
  direction?: Direction
  level_type?: LevelType
  scenario?: Scenario
  result?: TradeResult
  status?: TradeStatus
}
```

- [ ] **Step 3: Fix existing test helpers to satisfy the now-required `status` field**

In `__tests__/trades.test.ts`, update the `makeTrade` helper (around line 22) to include `status: 'reviewed'`:

```typescript
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
  status: 'reviewed',
  created_at: '2026-06-09T10:00:00Z',
  ...overrides,
})
```

In `__tests__/calendar.test.ts`, update its `makeTrade` helper the same way — add `status: 'reviewed',` in the same position (after `source: 'manual',`).

- [ ] **Step 4: Run the type check and existing tests to confirm nothing broke**

Run: `npx tsc --noEmit`
Expected: No errors.

Run: `npx vitest run __tests__/trades.test.ts __tests__/calendar.test.ts`
Expected: All existing tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/004_tradovate_import.sql types/index.ts __tests__/trades.test.ts __tests__/calendar.test.ts
git commit -m "Add draft trade status and Tradovate import migration"
```

---

### Task 2: Point-value lookup — `lib/tradovate/contracts.ts`

**Files:**
- Create: `lib/tradovate/contracts.ts`
- Test: `__tests__/tradovate-contracts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tradovate-contracts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getPointValue } from '@/lib/tradovate/contracts'

describe('getPointValue', () => {
  it('returns $20/point for NQ contracts', () => {
    expect(getPointValue('NQZ5')).toBe(20)
    expect(getPointValue('NQM6')).toBe(20)
  })

  it('returns $2/point for MNQ contracts', () => {
    expect(getPointValue('MNQZ5')).toBe(2)
  })

  it('returns null for unknown symbols', () => {
    expect(getPointValue('ESZ5')).toBeNull()
    expect(getPointValue('')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/tradovate-contracts.test.ts`
Expected: FAIL — `lib/tradovate/contracts.ts` does not exist / `getPointValue` is not exported.

- [ ] **Step 3: Implement `lib/tradovate/contracts.ts`**

Create `lib/tradovate/contracts.ts`:

```typescript
// $/point by contract symbol prefix. More specific prefixes (e.g. "MNQ")
// must come before the prefixes they're contained in (e.g. "NQ").
const POINT_VALUES: { prefix: string; value: number }[] = [
  { prefix: 'MNQ', value: 2 },
  { prefix: 'NQ', value: 20 },
]

export function getPointValue(symbol: string): number | null {
  for (const { prefix, value } of POINT_VALUES) {
    if (symbol.startsWith(prefix)) return value
  }
  return null
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/tradovate-contracts.test.ts`
Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/tradovate/contracts.ts __tests__/tradovate-contracts.test.ts
git commit -m "Add Tradovate contract point-value lookup"
```

---

### Task 3: FIFO fill-pairing — `lib/tradovate/pairFills.ts`

This is the core logic: turning a list of raw fills into draft trades. It's a pure function with no I/O, so it's fully covered by unit tests with synthetic fill sequences.

**Files:**
- Create: `lib/tradovate/pairFills.ts`
- Test: `__tests__/pairFills.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/pairFills.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { pairFillsIntoTrades, type RawFill } from '@/lib/tradovate/pairFills'

const NQ_POINT_VALUE = new Map([[1, 20]])

function fill(overrides: Partial<RawFill>): RawFill {
  return {
    id: 1,
    contractId: 1,
    timestamp: '2026-06-12T14:00:00.000Z',
    tradeDate: '2026-06-12',
    action: 'Buy',
    price: 21000,
    qty: 1,
    ...overrides,
  }
}

describe('pairFillsIntoTrades', () => {
  it('pairs a simple round trip into one draft trade', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      date: '2026-06-12',
      time_entered: '14:00:00',
      direction: 'long',
      position_size: 1,
      pnl: 200,
      result: 'win',
      level_type: null,
      level_price: null,
      prev_day_poc: null,
      prev_day_vah: null,
      prev_day_val: null,
      scenario: null,
      source: 'auto',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
  })

  it('handles a partial-fill exit (one entry, two exits)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 2, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
      fill({ id: 3, action: 'Sell', price: 21005, qty: 1, timestamp: '2026-06-12T14:20:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 300, // (21010-21000)*1*20 + (21005-21000)*1*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
    expect(fillAssignments.get(3)).toBe(0)
  })

  it('handles a scaled entry (two entries, one exit)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Buy', price: 21005, qty: 1, timestamp: '2026-06-12T14:05:00.000Z' }),
      fill({ id: 3, action: 'Sell', price: 21020, qty: 2, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 700, // (21020-21000)*1*20 + (21020-21005)*1*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
    expect(fillAssignments.get(3)).toBe(0)
  })

  it('handles a position reversal (exit closes long and opens short)', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 2, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 21010, qty: 3, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      direction: 'long',
      position_size: 2,
      pnl: 400, // (21010-21000)*2*20
      result: 'win',
    })
    expect(fillAssignments.get(1)).toBe(0)
    expect(fillAssignments.get(2)).toBe(0)
  })

  it('leaves a still-open position unassigned with no draft', () => {
    const fills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(0)
    expect(fillAssignments.get(1)).toBeNull()
  })

  it('handles a loss and a breakeven trade', () => {
    const lossFills = [
      fill({ id: 1, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Sell', price: 20990, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]
    const { drafts: lossDrafts } = pairFillsIntoTrades(lossFills, NQ_POINT_VALUE)
    expect(lossDrafts[0]).toMatchObject({ pnl: -200, result: 'loss' })

    const beFills = [
      fill({ id: 1, action: 'Sell', price: 21000, qty: 1, timestamp: '2026-06-12T14:00:00.000Z' }),
      fill({ id: 2, action: 'Buy', price: 21000, qty: 1, timestamp: '2026-06-12T14:10:00.000Z' }),
    ]
    const { drafts: beDrafts } = pairFillsIntoTrades(beFills, NQ_POINT_VALUE)
    expect(beDrafts[0]).toMatchObject({ direction: 'short', pnl: 0, result: 'breakeven' })
  })

  it('skips fills on contracts with no known point value', () => {
    const fills = [
      fill({ id: 1, contractId: 99, action: 'Buy', price: 4500, qty: 1 }),
      fill({ id: 2, contractId: 99, action: 'Sell', price: 4510, qty: 1 }),
    ]

    const { drafts, fillAssignments } = pairFillsIntoTrades(fills, NQ_POINT_VALUE)

    expect(drafts).toHaveLength(0)
    expect(fillAssignments.has(1)).toBe(false)
    expect(fillAssignments.has(2)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/pairFills.test.ts`
Expected: FAIL — `lib/tradovate/pairFills.ts` does not exist.

- [ ] **Step 3: Implement `lib/tradovate/pairFills.ts`**

Create `lib/tradovate/pairFills.ts`:

```typescript
import type { TradeFormData } from '@/types'

export interface RawFill {
  id: number
  contractId: number
  timestamp: string   // ISO 8601, e.g. "2026-06-12T14:00:00.000Z"
  tradeDate: string   // "YYYY-MM-DD"
  action: 'Buy' | 'Sell'
  price: number
  qty: number
}

export interface PairResult {
  drafts: TradeFormData[]
  // fillId -> index into drafts[], or null if part of a still-open position
  fillAssignments: Map<number, number | null>
}

interface Lot {
  qty: number
  price: number
  action: 'Buy' | 'Sell'
}

interface LifecycleStart {
  tradeDate: string
  timestamp: string
  action: 'Buy' | 'Sell'
  size: number
}

export function pairFillsIntoTrades(
  fills: RawFill[],
  pointValueByContract: Map<number, number>
): PairResult {
  const drafts: TradeFormData[] = []
  const fillAssignments = new Map<number, number | null>()

  const byContract = new Map<number, RawFill[]>()
  for (const f of fills) {
    if (!pointValueByContract.has(f.contractId)) continue
    const list = byContract.get(f.contractId) ?? []
    list.push(f)
    byContract.set(f.contractId, list)
  }

  for (const [contractId, contractFills] of byContract) {
    const pointValue = pointValueByContract.get(contractId)!
    const sorted = [...contractFills].sort((a, b) => a.timestamp.localeCompare(b.timestamp))

    const queue: Lot[] = []
    let lifecycleStart: LifecycleStart | null = null
    let lifecyclePnl = 0
    let pendingFillIds: number[] = []

    const closeLifecycle = () => {
      if (!lifecycleStart) return
      const direction = lifecycleStart.action === 'Buy' ? 'long' : 'short'
      const draftIndex = drafts.length
      const pnl = Math.round(lifecyclePnl * 100) / 100
      drafts.push({
        date: lifecycleStart.tradeDate,
        time_entered: lifecycleStart.timestamp.slice(11, 19),
        direction,
        position_size: lifecycleStart.size,
        level_type: null,
        level_price: null,
        prev_day_poc: null,
        prev_day_vah: null,
        prev_day_val: null,
        scenario: null,
        result: pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'breakeven',
        pnl,
        source: 'auto',
      })
      for (const fid of pendingFillIds) fillAssignments.set(fid, draftIndex)
      pendingFillIds = []
      lifecycleStart = null
      lifecyclePnl = 0
    }

    for (const f of sorted) {
      let remaining = f.qty

      if (queue.length === 0) {
        // starts a new lifecycle
        lifecycleStart = { tradeDate: f.tradeDate, timestamp: f.timestamp, action: f.action, size: f.qty }
        lifecyclePnl = 0
        queue.push({ qty: f.qty, price: f.price, action: f.action })
        pendingFillIds.push(f.id)
        fillAssignments.set(f.id, null)
        continue
      }

      if (queue[0].action === f.action) {
        // adds to the existing position (scaling in)
        queue.push({ qty: f.qty, price: f.price, action: f.action })
        if (lifecycleStart) lifecycleStart.size += f.qty
        pendingFillIds.push(f.id)
        fillAssignments.set(f.id, null)
        continue
      }

      // opposing fill: match FIFO against the queue
      pendingFillIds.push(f.id)
      fillAssignments.set(f.id, null)

      while (remaining > 0 && queue.length > 0) {
        const lot = queue[0]
        const matched = Math.min(remaining, lot.qty)
        const directionSign = lot.action === 'Buy' ? 1 : -1
        lifecyclePnl += (f.price - lot.price) * matched * directionSign * pointValue
        lot.qty -= matched
        remaining -= matched
        if (lot.qty === 0) queue.shift()
      }

      if (queue.length === 0) {
        closeLifecycle()

        if (remaining > 0) {
          // reversal: the remainder of this fill opens a new position
          // in the opposite direction. That new lifecycle isn't tracked
          // for dedup/draft purposes until its own closing fill arrives
          // in a future import run with this fill no longer excluded —
          // a known v1 limitation for reversal fills (see spec Section 10).
          lifecycleStart = { tradeDate: f.tradeDate, timestamp: f.timestamp, action: f.action, size: remaining }
          lifecyclePnl = 0
          queue.push({ qty: remaining, price: f.price, action: f.action })
          pendingFillIds = []
        }
      }
    }
  }

  return { drafts, fillAssignments }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/pairFills.test.ts`
Expected: PASS, 7 tests passing.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx vitest run`
Expected: All test files pass.

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add lib/tradovate/pairFills.ts __tests__/pairFills.test.ts
git commit -m "Add FIFO fill-pairing for Tradovate import"
```

---

### Task 4: Service-role Supabase client — `lib/supabase/admin.ts`

The import route is invoked by Vercel Cron with no user session, so it needs a Supabase client that bypasses RLS via the service-role key. This client must only ever be used in server-only code (API routes), never imported into client components.

**Files:**
- Create: `lib/supabase/admin.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Add the service-role env var to `.env.local.example`**

Add a line to `.env.local.example`:

```
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

- [ ] **Step 2: Create `lib/supabase/admin.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

// Server-only client using the service-role key — bypasses RLS.
// Used by the Tradovate import route, which may run with no user session
// (Vercel Cron). Never import this into client components.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 3: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/admin.ts .env.local.example
git commit -m "Add service-role Supabase client for server-only routes"
```

---

### Task 5: Tradovate API client — `lib/tradovate/client.ts`

This wraps Tradovate's auth and fill/contract endpoints. Because exact response shapes can only be confirmed against a live account, this task includes a verification step against the real demo API using your credentials.

**Files:**
- Create: `lib/tradovate/client.ts`
- Modify: `.env.local.example`

- [ ] **Step 1: Add Tradovate env vars to `.env.local.example`**

Add these lines:

```
TRADOVATE_USERNAME=your-tradovate-username
TRADOVATE_PASSWORD=your-tradovate-password
TRADOVATE_CID=your-tradovate-app-cid
TRADOVATE_SECRET=your-tradovate-app-secret
TRADOVATE_DEVICE_ID=a-fixed-uuid-you-generate-once
TRADOVATE_ACCOUNT_ID=your-tradovate-account-id
CRON_SECRET=a-random-secret-shared-with-vercel-cron
```

- [ ] **Step 2: Implement `lib/tradovate/client.ts`**

```typescript
import type { RawFill } from './pairFills'

const BASE_URL = 'https://demo.tradovateapi.com/v1'

interface AccessTokenResponse {
  accessToken?: string
  errorText?: string
}

export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: process.env.TRADOVATE_USERNAME,
      password: process.env.TRADOVATE_PASSWORD,
      appId: 'volume-profile-journal',
      appVersion: '1.0',
      cid: Number(process.env.TRADOVATE_CID),
      sec: process.env.TRADOVATE_SECRET,
      deviceId: process.env.TRADOVATE_DEVICE_ID,
    }),
  })

  const data = (await res.json()) as AccessTokenResponse
  if (!res.ok || !data.accessToken) {
    throw new Error(`Tradovate auth failed: ${data.errorText ?? res.statusText}`)
  }
  return data.accessToken
}

// Raw shape of a Tradovate fill record. `tradeDate` may come back as either
// a plain "YYYY-MM-DD" string or a { date: "YYYY-MM-DDT..." } object,
// depending on API version — normalizeFill handles both.
interface TradovateFillResponse {
  id: number
  contractId: number
  timestamp: string
  tradeDate: string | { date: string }
  action: 'Buy' | 'Sell'
  price: number
  qty: number
  accountId?: number
}

function normalizeFill(raw: TradovateFillResponse): RawFill {
  const tradeDateStr = typeof raw.tradeDate === 'string' ? raw.tradeDate : raw.tradeDate.date
  return {
    id: raw.id,
    contractId: raw.contractId,
    timestamp: raw.timestamp,
    tradeDate: tradeDateStr.slice(0, 10),
    action: raw.action,
    price: raw.price,
    qty: raw.qty,
  }
}

export async function getFills(accessToken: string, accountId: number): Promise<RawFill[]> {
  const res = await fetch(`${BASE_URL}/fill/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Tradovate fill/list failed: ${res.status} ${res.statusText}`)

  const data = (await res.json()) as TradovateFillResponse[]
  return data
    .filter(f => f.accountId === undefined || f.accountId === accountId)
    .map(normalizeFill)
}

export async function getContractSymbol(accessToken: string, contractId: number): Promise<string> {
  const res = await fetch(`${BASE_URL}/contract/item?id=${contractId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`Tradovate contract/item failed: ${res.status} ${res.statusText}`)

  const data = (await res.json()) as { name: string }
  return data.name
}
```

- [ ] **Step 3: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/tradovate/client.ts .env.local.example
git commit -m "Add Tradovate API client for auth, fills, and contracts"
```

- [ ] **Step 5: Verify against the live demo API (manual, do this once you have real credentials in `.env.local`)**

This step can't be scripted in advance since it depends on your live account data. Once `.env.local` has real Tradovate values:

1. Temporarily add a throwaway script `scripts/tradovate-check.ts`:
   ```typescript
   import { getAccessToken, getFills, getContractSymbol } from '@/lib/tradovate/client'

   async function main() {
     const token = await getAccessToken()
     console.log('Got token')
     const fills = await getFills(token, Number(process.env.TRADOVATE_ACCOUNT_ID))
     console.log(JSON.stringify(fills.slice(0, 3), null, 2))
     if (fills[0]) {
       const symbol = await getContractSymbol(token, fills[0].contractId)
       console.log('Symbol:', symbol)
     }
   }

   main()
   ```
2. Run: `npx tsx scripts/tradovate-check.ts` (if `tsx` isn't installed, `npx --yes tsx scripts/tradovate-check.ts`)
3. Check the printed fills against the `RawFill` shape: does `timestamp` look like an ISO string? Does `tradeDate` come through as `"YYYY-MM-DD"` after normalization? Does `getContractSymbol` return something like `"NQZ5"`?
4. If any field doesn't match, adjust `normalizeFill` / `getContractSymbol` in `lib/tradovate/client.ts` accordingly, and re-run.
5. Delete `scripts/tradovate-check.ts` once verified — it's a throwaway diagnostic, not part of the app.
6. If you made adjustments, commit them: `git add lib/tradovate/client.ts && git commit -m "Adjust Tradovate client to match live API response shapes"`

---

### Task 6: Import route — `app/api/import/tradovate/route.ts`

**Files:**
- Create: `app/api/import/tradovate/route.ts`

- [ ] **Step 1: Implement the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessToken, getFills, getContractSymbol } from '@/lib/tradovate/client'
import { getPointValue } from '@/lib/tradovate/contracts'
import { pairFillsIntoTrades } from '@/lib/tradovate/pairFills'
import { prepareTradeData } from '@/lib/trades'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const accountId = Number(process.env.TRADOVATE_ACCOUNT_ID)

    const token = await getAccessToken()
    const fills = await getFills(token, accountId)

    const { data: existing } = await admin
      .from('imported_fills')
      .select('fill_id')
      .not('trade_id', 'is', null)
    const processedFillIds = new Set((existing ?? []).map(r => r.fill_id))

    const newFills = fills.filter(f => !processedFillIds.has(f.id))

    const contractIds = [...new Set(newFills.map(f => f.contractId))]
    const pointValueByContract = new Map<number, number>()
    let skipped = 0
    for (const contractId of contractIds) {
      const symbol = await getContractSymbol(token, contractId)
      const pointValue = getPointValue(symbol)
      if (pointValue === null) {
        skipped += newFills.filter(f => f.contractId === contractId).length
        continue
      }
      pointValueByContract.set(contractId, pointValue)
    }

    const { drafts, fillAssignments } = pairFillsIntoTrades(newFills, pointValueByContract)

    let imported = 0
    let stillOpen = 0

    if (drafts.length > 0) {
      const rows = drafts.map(prepareTradeData)
      const { data: inserted, error } = await admin.from('trades').insert(rows).select('id')
      if (error) throw new Error(`Failed to insert draft trades: ${error.message}`)
      imported = inserted?.length ?? 0

      const fillRows = [...fillAssignments.entries()].map(([fillId, draftIndex]) => ({
        fill_id: fillId,
        trade_id: draftIndex !== null ? inserted?.[draftIndex]?.id ?? null : null,
      }))
      stillOpen = fillRows.filter(r => r.trade_id === null).length

      const { error: upsertError } = await admin.from('imported_fills').upsert(fillRows)
      if (upsertError) throw new Error(`Failed to record imported fills: ${upsertError.message}`)
    } else {
      stillOpen = [...fillAssignments.values()].filter(v => v === null).length
      if (fillAssignments.size > 0) {
        const fillRows = [...fillAssignments.entries()].map(([fillId, draftIndex]) => ({
          fill_id: fillId,
          trade_id: draftIndex,
        }))
        const { error: upsertError } = await admin.from('imported_fills').upsert(fillRows)
        if (upsertError) throw new Error(`Failed to record imported fills: ${upsertError.message}`)
      }
    }

    return NextResponse.json({ imported, stillOpen, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown import error'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
```

- [ ] **Step 2: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/import/tradovate/route.ts
git commit -m "Add Tradovate import API route"
```

---

### Task 7: Vercel Cron config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    { "path": "/api/import/tradovate", "schedule": "0 22 * * 1-5" }
  ]
}
```

This runs the import daily at 22:00 UTC on weekdays (after the futures session close). Vercel sends the request with an `Authorization: Bearer $CRON_SECRET` header when the `CRON_SECRET` environment variable is set on the project — matching the check added in Task 6.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "Add Vercel Cron schedule for Tradovate import"
```

---

### Task 8: `lib/trades.ts` — status filter and draft-aware `prepareTradeData`

**Files:**
- Modify: `lib/trades.ts`
- Modify: `__tests__/trades.test.ts`

- [ ] **Step 1: Write the failing tests**

In `__tests__/trades.test.ts`, add a new case to the existing `describe('filterTrades', ...)` block (after the existing filter tests, before its closing `})`):

```typescript
  it('filters by status', () => {
    const withStatus = [
      makeTrade({ id: '1', status: 'draft' }),
      makeTrade({ id: '2', status: 'reviewed' }),
    ]
    expect(filterTrades(withStatus, { status: 'draft' })).toHaveLength(1)
    expect(filterTrades(withStatus, { status: 'draft' })[0].id).toBe('1')
  })
```

Then add new cases to the existing `describe('prepareTradeData', ...)` block (after the existing test, before its closing `})`):

```typescript
  it('marks a trade with all strategy fields filled as reviewed', () => {
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
    expect(result.status).toBe('reviewed')
  })

  it('marks a trade missing strategy fields as draft and preserves auto source', () => {
    const result = prepareTradeData({
      date: '2026-06-12',
      time_entered: '14:00:00',
      direction: 'long',
      position_size: 1,
      level_type: null,
      level_price: null,
      prev_day_poc: null,
      prev_day_vah: null,
      prev_day_val: null,
      scenario: null,
      result: 'win',
      pnl: 200,
      source: 'auto',
    })
    expect(result.status).toBe('draft')
    expect(result.source).toBe('auto')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/trades.test.ts`
Expected: FAIL — `filterTrades` doesn't filter by `status`, and `prepareTradeData`'s result has no `status` property (TypeScript errors on `result.status` and on the new `TradeFormData` shapes with `level_type: null` etc. — those should already compile fine after Task 1's type changes; only the runtime assertions fail).

- [ ] **Step 3: Update `lib/trades.ts`**

Update `filterTrades` (add the status check):

```typescript
export function filterTrades(trades: Trade[], filters: TradeFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.level_type && trade.level_type !== filters.level_type) return false
    if (filters.scenario && trade.scenario !== filters.scenario) return false
    if (filters.result && trade.result !== filters.result) return false
    if (filters.date && trade.date !== filters.date) return false
    if (filters.status && trade.status !== filters.status) return false
    return true
  })
}
```

Update `prepareTradeData`:

```typescript
export function prepareTradeData(formData: TradeFormData): Omit<Trade, 'id' | 'created_at'> {
  const strategyFieldsComplete =
    formData.level_type != null &&
    formData.level_price != null &&
    formData.prev_day_poc != null &&
    formData.prev_day_vah != null &&
    formData.prev_day_val != null &&
    formData.scenario != null

  return {
    date: formData.date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    position_size: formData.position_size,
    level_type: formData.level_type ?? null,
    level_price: formData.level_price ?? null,
    prev_day_poc: formData.prev_day_poc ?? null,
    prev_day_vah: formData.prev_day_vah ?? null,
    prev_day_val: formData.prev_day_val ?? null,
    scenario: formData.scenario ?? null,
    result: formData.result,
    pnl: formData.pnl,
    notes: formData.notes ?? null,
    source: formData.source ?? 'manual',
    status: strategyFieldsComplete ? 'reviewed' : 'draft',
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/trades.test.ts`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Run the full test suite and type check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/trades.ts __tests__/trades.test.ts
git commit -m "Add status filter and draft/reviewed logic to prepareTradeData"
```

---

### Task 9: Trade form — handle nullable strategy fields and draft status

**Files:**
- Modify: `components/journal/trade-form.tsx`

- [ ] **Step 1: Update `defaultForm` and the loaded-form mapping**

In `components/journal/trade-form.tsx`, `defaultForm` keeps all fields filled (so manually-added trades are `reviewed` by default) — no change needed there. But the form state for an *editing* draft trade must pass through `null` strategy fields and the trade's `source`. Update the `useState<TradeFormData>` initializer (around lines 41-59):

```typescript
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
          source: trade.source,
        }
      : defaultForm
  )
```

- [ ] **Step 2: Widen the `set` helper to accept `null`**

Update the `set` function signature (around line 63):

```typescript
  function set(key: keyof TradeFormData, value: string | number | null) {
    setForm(prev => ({ ...prev, [key]: value }))
  }
```

- [ ] **Step 3: Update `handleSubmit` to coerce numeric fields only when non-null**

Replace the `data: TradeFormData = { ... }` block in `handleSubmit` (around lines 72-80):

```typescript
    const data: TradeFormData = {
      ...form,
      position_size: Number(form.position_size),
      pnl: Number(form.pnl),
      level_price: form.level_price == null ? null : Number(form.level_price),
      prev_day_poc: form.prev_day_poc == null ? null : Number(form.prev_day_poc),
      prev_day_vah: form.prev_day_vah == null ? null : Number(form.prev_day_vah),
      prev_day_val: form.prev_day_val == null ? null : Number(form.prev_day_val),
    }
```

- [ ] **Step 4: Make the strategy-field inputs nullable in the JSX**

In the "Previous Day Levels" block (around lines 144-163), replace the three `Field`s:

```typescript
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 mb-3">Previous Day Levels</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="POC (Red)">
                <input type="number" step="0.25" value={form.prev_day_poc ?? ''}
                  onChange={e => set('prev_day_poc', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
              <Field label="VAH (Purple)">
                <input type="number" step="0.25" value={form.prev_day_vah ?? ''}
                  onChange={e => set('prev_day_vah', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
              <Field label="VAL (Purple)">
                <input type="number" step="0.25" value={form.prev_day_val ?? ''}
                  onChange={e => set('prev_day_val', e.target.value === '' ? null : e.target.value)}
                  className={inputClass} />
              </Field>
            </div>
          </div>
```

Then replace the "Level Traded" / "Level Price" block (around lines 165-180):

```typescript
          <div className="grid grid-cols-2 gap-4">
            <Field label="Level Traded">
              <select value={form.level_type ?? ''}
                onChange={e => set('level_type', e.target.value === '' ? null : e.target.value as LevelType)}
                className={inputClass}>
                <option value="">— Select —</option>
                <option value="POC">POC (Red)</option>
                <option value="VAH">VAH (Purple)</option>
                <option value="VAL">VAL (Purple)</option>
              </select>
            </Field>
            <Field label="Level Price">
              <input type="number" step="0.25" value={form.level_price ?? ''}
                onChange={e => set('level_price', e.target.value === '' ? null : e.target.value)}
                className={inputClass} />
            </Field>
          </div>
```

Then replace the "Scenario" field (around lines 182-189):

```typescript
          <Field label="Scenario">
            <select value={form.scenario ?? ''}
              onChange={e => set('scenario', e.target.value === '' ? null : e.target.value as Scenario)}
              className={inputClass}>
              <option value="">— Select —</option>
              <option value="retest_continue">Retest + Continue</option>
              <option value="break_retest_reverse">Break + Retest + Reverse</option>
            </select>
          </Field>
```

- [ ] **Step 5: Add a draft-status hint to the form header**

In the header line (around line 95), show a hint when editing a draft:

```typescript
        <h2 className="text-lg font-semibold mb-1">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
        {trade?.status === 'draft' && (
          <p className="text-xs text-amber-400 mb-4">
            Imported from Tradovate — fill in the strategy fields below to mark this trade as reviewed.
          </p>
        )}
```

Note this replaces the existing `<h2 ... className="text-lg font-semibold mb-5">` — change its bottom margin from `mb-5` to `mb-1` and add the conditional hint paragraph directly after it. If `trade?.status !== 'draft'` (or `trade` is undefined), no hint renders and the spacing should still look right — add `mb-5` back via a wrapping check, or simplify: give the `<h2>` `mb-1` always and add `<div className="mb-4" />` after the conditional block when there's no hint. Simplest correct approach — wrap both in a container with consistent spacing:

```typescript
        <div className="mb-5">
          <h2 className="text-lg font-semibold">{trade ? 'Edit Trade' : 'Add Trade'}</h2>
          {trade?.status === 'draft' && (
            <p className="text-xs text-amber-400 mt-1">
              Imported from Tradovate — fill in the strategy fields below to mark this trade as reviewed.
            </p>
          )}
        </div>
```

- [ ] **Step 6: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Run the dev server and manually verify the form**

Run: `npm run dev`, open `/journal`, click "+ Add Trade":
- Confirm all fields still default sensibly and the form submits successfully (status should end up `reviewed` since all fields are filled).
- Confirm "Level Traded" and "Scenario" now show a "— Select —" option but default to a real value for new trades.

- [ ] **Step 8: Commit**

```bash
git add components/journal/trade-form.tsx
git commit -m "Support nullable strategy fields and draft status in trade form"
```

---

### Task 10: Trade table — draft badge and row styling

**Files:**
- Modify: `components/journal/trade-table.tsx`

- [ ] **Step 1: Add a "Status" column header**

In the header row (around lines 54-56), add `'Status'` after `'Result'`:

```typescript
              {['Date', 'Time', 'Direction', 'Result', 'Status', 'Level', 'Scenario', 'Size', 'P&L', ''].map(h => (
```

- [ ] **Step 2: Add the draft badge cell and amber row styling**

Update the row `<tr>` (around line 61) to add conditional styling for drafts:

```typescript
              <tr key={trade.id}
                className={`border-b border-white/5 hover:bg-white/5 transition-colors ${
                  trade.status === 'draft' ? 'bg-amber-500/5' : ''
                }`}>
```

Then add a new `<td>` for the status badge right after the "Result" `<td>` (after line 78's closing `</td>`):

```typescript
                <td className="py-3 pr-4">
                  {trade.status === 'draft' && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/20 text-amber-400">
                      Draft
                    </span>
                  )}
                </td>
```

- [ ] **Step 3: Handle `null` level_type when rendering the "Level" cell**

The existing "Level" cell (around lines 79-87) assumes `trade.level_type` is always set. Update it to render an em-dash for drafts with no level yet:

```typescript
                <td className="py-3 pr-4">
                  {trade.level_type ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      trade.level_type === 'POC'
                        ? 'bg-white text-black'
                        : 'border border-white/20 text-gray-300'
                    }`}>
                      {trade.level_type}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">—</span>
                  )}
                </td>
```

- [ ] **Step 4: Handle `null` scenario in the "Scenario" cell**

Update the scenario cell (around line 88):

```typescript
                <td className="py-3 pr-4 text-gray-400 text-xs">
                  {trade.scenario ? scenarioLabel[trade.scenario] : '—'}
                </td>
```

- [ ] **Step 5: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/journal/trade-table.tsx
git commit -m "Show draft badge and handle null strategy fields in trade table"
```

---

### Task 11: Filters bar — status filter

**Files:**
- Modify: `components/journal/filters-bar.tsx`

- [ ] **Step 1: Add a status `<select>`**

Add a new `<select>` after the "All Results" select (around line 49, before the `{hasFilters && ...}` block):

```typescript
      <select value={filters.status ?? ''}
        onChange={e => set('status', e.target.value)} className={selectClass}>
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="reviewed">Reviewed</option>
      </select>
```

- [ ] **Step 2: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors. (`set('status', value)` works because `set`'s `key` parameter is `keyof TradeFilters`, which now includes `status`.)

- [ ] **Step 3: Commit**

```bash
git add components/journal/filters-bar.tsx
git commit -m "Add draft/reviewed status filter to journal filters bar"
```

---

### Task 12: Journal page — import button, draft-status URL seeding, toast

**Files:**
- Modify: `components/journal/journal-client.tsx`

- [ ] **Step 1: Seed filters from `?status=` in addition to `?date=`**

Update the top of `JournalClient` (around lines 12-16):

```typescript
export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const searchParams = useSearchParams()
  const initialDate = searchParams.get('date') ?? undefined
  const initialStatus = searchParams.get('status') as TradeFilters['status'] | null
  const [filters, setFilters] = useState<TradeFilters>({
    ...(initialDate && { date: initialDate }),
    ...(initialStatus && { status: initialStatus }),
  })
  const [showForm, setShowForm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
```

- [ ] **Step 2: Add the import handler**

Add this function inside `JournalClient`, after the state declarations and before `const filtered = ...`:

```typescript
  async function handleImport() {
    setImporting(true)
    setImportMessage(null)
    try {
      const res = await fetch('/api/import/tradovate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setImportMessage(`Import failed: ${data.error ?? 'Unknown error'}`)
      } else if (data.imported === 0) {
        setImportMessage('No new trades to import.')
      } else {
        const openNote = data.stillOpen > 0 ? ` (${data.stillOpen} position still open)` : ''
        setImportMessage(`Imported ${data.imported} trade${data.imported === 1 ? '' : 's'}${openNote}.`)
        router.refresh()
      }
    } catch {
      setImportMessage('Import failed: network error.')
    } finally {
      setImporting(false)
    }
  }
```

- [ ] **Step 3: Add `useRouter` import**

Add to the imports at the top:

```typescript
import { useRouter, useSearchParams } from 'next/navigation'
```

(replacing the existing `import { useSearchParams } from 'next/navigation'`), and add `const router = useRouter()` alongside `const searchParams = useSearchParams()`.

- [ ] **Step 4: Add the "Import from Tradovate" button and toast message**

Update the header `<div className="flex items-center justify-between mb-6">` block (around lines 24-40) to add the import button before "+ Add Trade":

```typescript
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} trade{filtered.length !== 1 ? 's' : ''} · Win rate {wr}% ·{' '}
            <span className={totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPnl(totalPnl)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 border border-white/20 hover:bg-white/5 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import from Tradovate'}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-medium transition-colors"
          >
            + Add Trade
          </button>
        </div>
      </div>

      {importMessage && (
        <p className="text-sm text-gray-400 mb-4">{importMessage}</p>
      )}
```

- [ ] **Step 5: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Run the dev server and manually verify**

Run: `npm run dev`, open `/journal`:
- Confirm "Import from Tradovate" button renders and shows "Importing..." while clicked (it will likely show "Import failed: ..." until Tradovate env vars are configured — that's expected at this stage).
- Confirm navigating to `/journal?status=draft` seeds the status filter to "Draft" in the filters bar.

- [ ] **Step 7: Commit**

```bash
git add components/journal/journal-client.tsx
git commit -m "Add Tradovate import button and draft-status URL seeding to journal"
```

---

### Task 13: Dashboard — exclude drafts from stats, show pending-annotation banner

**Files:**
- Modify: `components/dashboard/dashboard-client.tsx`

- [ ] **Step 1: Split trades into reviewed vs. draft**

Update `DashboardClient` (around lines 13-43):

```typescript
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
```

Note `TradingCalendar` still receives **all** `trades` (draft + reviewed) — its P&L/win-rate figures reflect real money regardless of annotation status.

- [ ] **Step 2: Run the type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run the dev server and manually verify**

Run: `npm run dev`, open `/dashboard`:
- Confirm the page renders with no pending-annotation banner (no drafts exist yet).
- Confirm stat cards, breakdown tables, P&L chart, and calendar all still render correctly with existing reviewed trades.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-client.tsx
git commit -m "Exclude draft trades from dashboard stats, add pending-annotation banner"
```

---

### Task 14: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: All test files pass, including the new `__tests__/tradovate-contracts.test.ts` (3 tests) and `__tests__/pairFills.test.ts` (7 tests), plus the 3 new cases added to `__tests__/trades.test.ts`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors or warnings.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: Build succeeds, including the new `/api/import/tradovate` route.

- [ ] **Step 4: Apply the database migration**

Apply `supabase/migrations/004_tradovate_import.sql` to the Supabase project (via the Supabase dashboard SQL editor or `supabase db push`, depending on how prior migrations were applied). Confirm:
- `trades.level_type`, `level_price`, `prev_day_poc`, `prev_day_vah`, `prev_day_val`, `scenario` are now nullable.
- `trades.status` exists, defaults to `'reviewed'`, and existing rows all have `status = 'reviewed'`.
- `imported_fills` table exists with RLS enabled.

- [ ] **Step 5: Configure environment variables**

In `.env.local` (and the Vercel project's environment variables for production), set real values for: `SUPABASE_SERVICE_ROLE_KEY`, `TRADOVATE_USERNAME`, `TRADOVATE_PASSWORD`, `TRADOVATE_CID`, `TRADOVATE_SECRET`, `TRADOVATE_DEVICE_ID`, `TRADOVATE_ACCOUNT_ID`, `CRON_SECRET`.

- [ ] **Step 6: Manual smoke check**

Run `npm run dev`, open `/journal`:
- Click "Import from Tradovate". With real credentials configured, confirm it either reports `"Imported N trades..."` or `"No new trades to import."` without an error.
- If trades were imported, confirm they appear in the table with the "Draft" badge and amber row tint, with "—" shown for Level and Scenario.
- Click a draft row's "Edit" button, fill in all six strategy fields, and save. Confirm the "Draft" badge disappears and the row returns to normal styling.
- Open `/dashboard` and confirm the pending-annotation banner count matches the number of remaining draft trades, and that newly-reviewed trades now appear in the breakdown tables.
- Run the import a second time and confirm it reports `"No new trades to import."` (dedup via `imported_fills` works).

- [ ] **Step 7: Push**

```bash
git push origin master
```

---

## Self-Review Notes

- **Spec coverage:** Section 2 (auth/client) → Tasks 4–5; Section 3 (data model) → Task 1; Section 4 (pairing) → Task 3; Section 5 (route) → Task 6; Section 6 (Journal/trade-form/filters) → Tasks 9–12; Section 7 (Dashboard) → Task 13; Section 8 (cron) → Task 7; Section 9 (error handling) → Task 6's try/catch and Task 12's toast.
- **Type consistency:** `TradeStatus`, `Trade.status`, `TradeFormData` nullable fields, `TradeFilters.status`, `RawFill`, `PairResult`/`fillAssignments`, and `prepareTradeData`'s derived `status` are used identically across Tasks 1, 3, 6, 8, 11, 12, 13.
- **Known v1 limitation (documented inline in Task 3's code comment):** a reversal fill that both closes one lifecycle and opens a new one is recorded in `imported_fills` against the closed trade only; the newly-opened lifecycle isn't separately tracked across import runs. Acceptable per spec Section 10 (out of scope) for a single-strategy demo account.
- **No placeholders:** every step has complete, runnable code or exact commands; Task 5's live-verification step is necessarily manual (external API) but gives a concrete script, command, and checklist of what to inspect/adjust.
