# Tradovate Auto-Import — Design Spec

**Date:** 2026-06-13
**Stack:** Next.js + Supabase + Vercel
**Environment:** Tradovate demo API (`demo.tradovateapi.com`)

---

## 1. Overview

Automatically pull executed fills from a Tradovate account, pair them into closed round-trip trades via FIFO matching, and insert them into the `trades` table as **drafts** for the user to annotate with their volume-profile strategy fields (level type, level price, previous-day POC/VAH/VAL, scenario) before they count toward dashboard statistics.

Import can be triggered manually (Journal page button) or automatically (daily Vercel Cron job).

---

## 2. Tradovate Auth & Client

**Env vars** (added to `.env.local` / Vercel project settings):
- `TRADOVATE_USERNAME`, `TRADOVATE_PASSWORD`
- `TRADOVATE_CID`, `TRADOVATE_SECRET` (app/client credentials)
- `TRADOVATE_DEVICE_ID` (a fixed UUID generated once, identifies this app instance to Tradovate)
- `TRADOVATE_ACCOUNT_ID` (the demo account to import from)
- `CRON_SECRET` (shared secret for authorizing Vercel Cron requests to the import route)

**`lib/tradovate/client.ts`:**
- `getAccessToken()`: performs the password-grant request to `https://demo.tradovateapi.com/v1/auth/accesstokenrequest` with the above credentials; returns an access token. Tokens are fetched fresh per import run (not persisted) since runs are infrequent (manual clicks + once-daily cron) and tokens last ~80 minutes.
- `getFills(accessToken, accountId)`: calls `GET /v1/fill/list` (or `fill/deps` as needed) filtered to the account, returns raw fill records (`id`, `orderId`, `contractId`, `timestamp`, `tradeDate`, `action`, `price`, `qty`).
- `getContracts(accessToken, contractIds)`: calls `GET /v1/contract/item` (or batched) to resolve `contractId → symbol` for point-value lookup.

**`lib/tradovate/contracts.ts`:**
- Static map from product symbol prefix to `$/point`: `{ NQ: 20, MNQ: 2 }`, extendable for other instruments. A symbol that doesn't match a known prefix causes that contract's fills to be skipped with a logged warning (not inserted as drafts) — this is a v1 limitation, documented so it's not mistaken for a bug.

---

## 3. Data Model Changes

### Migration `004_tradovate_import.sql`

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
```

### `types/index.ts` changes

```typescript
export type TradeStatus = 'draft' | 'reviewed'

export interface Trade {
  id: string
  date: string
  time_entered: string
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

`TradeFormData` likewise makes those six fields optional. The trade form's submit handler requires them to be non-empty before it will save with `status: 'reviewed'`; if any are missing, it saves with `status: 'draft'` unchanged (or sets it to `'draft'` if it was already `'reviewed'` and a field was cleared — though that's an edge case, not actively prevented).

---

## 4. Fill-Pairing Logic — `lib/tradovate/pairFills.ts`

Pure function, unit-tested independently of any network/DB code.

```typescript
interface RawFill {
  id: number
  contractId: number
  timestamp: string   // ISO
  tradeDate: string   // "YYYY-MM-DD"
  action: 'Buy' | 'Sell'
  price: number
  qty: number
}

interface PairResult {
  drafts: TradeFormData[]              // status: 'draft', source: 'auto'
  fillAssignments: Map<number, number | null>  // fillId -> index into drafts[], or null if still open
}

function pairFillsIntoTrades(
  fills: RawFill[],
  pointValueByContract: Map<number, number>,
): PairResult
```

**Algorithm:**
1. Group fills by `contractId`, sort each group chronologically.
2. Walk each group maintaining a FIFO queue of open lots (`{ fillId, qty, price, timestamp, tradeDate, action }`) and a running net position.
3. When a fill **adds to** the current position (same direction as net position, or net position is flat), push it onto the queue as a new lot (records the start of a lifecycle if the queue was empty).
4. When a fill **opposes** the current position, match it against the front of the queue (FIFO), splitting either side as needed for partial fills. Each match produces a `(entryLot, exitFill, matchedQty)` segment. Realized P&L for a segment = `(exitPrice - entryPrice) * matchedQty * directionSign * pointValue` where `directionSign = +1` for long entries, `-1` for short entries.
5. A **lifecycle** is the span from the position going flat → non-flat → flat again. All segments within one lifecycle are aggregated into one draft trade:
   - `date`, `time_entered` ← first opening fill's `tradeDate`/`timestamp`
   - `direction` ← `'long'` if the opening fill was `Buy`, else `'short'`
   - `position_size` ← sum of opening-fill quantities in the lifecycle
   - `pnl` ← sum of segment P&Ls, rounded to 2 decimals
   - `result` ← `'win'` (pnl > 0) / `'loss'` (pnl < 0) / `'breakeven'` (pnl === 0)
   - strategy fields ← `null`, `status: 'draft'`, `source: 'auto'`
6. Fills belonging to a completed lifecycle are mapped to that draft's index in `fillAssignments`. Fills belonging to a still-open lifecycle (queue non-empty at end of input) map to `null` — they're recorded in `imported_fills` but produce no draft yet, and are re-matched on the next run once their closing fills are fetched (the caller re-fetches *all* unprocessed fills each run, including these).
7. Fills on contracts not in `pointValueByContract` are skipped entirely (not added to `fillAssignments`, not turned into drafts) — logged as a warning in the route's response.

**Test cases** (`__tests__/pairFills.test.ts`): simple round trip (1 buy + 1 sell), partial-fill exit (1 buy + 2 sells), scaled entry (2 buys + 1 sell), position reversal (buy 2, sell 3 — closes long and opens short), still-open position at end of input, unknown contract skipped.

---

## 5. Import Route — `app/api/import/tradovate/route.ts`

**POST handler:**
1. **Auth check:** accept if either (a) the request has a valid Supabase session cookie, or (b) the `Authorization` header matches `Bearer ${CRON_SECRET}`. Otherwise 401.
2. Get Tradovate access token via `lib/tradovate/client.ts`.
3. Fetch all fills for `TRADOVATE_ACCOUNT_ID`.
4. Query `imported_fills` for existing `fill_id`s with non-null `trade_id` (fully processed) and exclude those from the fill list. Fills with `trade_id = null` (still-open lifecycles) ARE re-included.
5. Resolve contracts for distinct `contractId`s in the remaining fills → build `pointValueByContract`.
6. Run `pairFillsIntoTrades`.
7. Insert `drafts` into `trades`, capturing returned IDs.
8. Upsert `imported_fills` rows: for each fill, `trade_id` = the inserted trade's ID if its `fillAssignments` entry is non-null, else `null`. (Upsert because still-open fills from a previous run are being re-recorded.)
9. Respond `{ imported: <drafts.length>, stillOpen: <count of null assignments>, skipped: <count of unknown-contract fills> }`. On Tradovate API failure, respond 502 with `{ error: message }`.

---

## 6. Journal Page Changes

**`components/journal/journal-client.tsx`:**
- "Import from Tradovate" button in the top bar (next to "Add Trade"). On click: POST to `/api/import/tradovate`, show a loading spinner, then a toast summarizing the result (`"Imported 3 trades (1 position still open)"` / `"No new trades"` / error message), then `router.refresh()`.
- Trade table rows where `status === 'draft'` get a "Draft" badge and amber-tinted row styling.
- New filter option in `filters-bar.tsx`: a `status` dropdown (`All` / `Draft` / `Reviewed`), wired into `TradeFilters` and `filterTrades` in `lib/trades.ts`.

**`components/journal/trade-form.tsx`:**
- Strategy fields (`level_type`, `level_price`, `prev_day_poc/vah/val`, `scenario`) remain in the form but are no longer marked required at the HTML level for draft trades.
- On submit: if all six strategy fields are filled in, save with `status: 'reviewed'`; otherwise save with `status: 'draft'`.

---

## 7. Dashboard Changes

**`lib/trades.ts`:**
- All breakdown helpers used by the Dashboard (`statsByLevelType`, `statsByScenario`, `statsByDirection`, `statsByTimeOfDay`, stat cards, P&L chart) operate on `trades.filter(t => t.status === 'reviewed')`.

**`components/dashboard/dashboard-client.tsx`:**
- New small banner/card above the stat cards, shown only when drafts exist: `"N trades pending annotation"`, linking to `/journal?status=draft`.

**`components/dashboard/trading-calendar.tsx`:**
- Unchanged — continues to use **all** trades (draft + reviewed), since `pnl` is known for drafts and represents real money even before strategy annotation.

**`components/journal/journal-client.tsx`:**
- Reads `?status=draft` URL param (alongside the existing `?date=` param) to seed the new status filter, same pattern as the existing date-filter seeding.

---

## 8. Vercel Cron

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/import/tradovate", "schedule": "0 22 * * 1-5" }
  ]
}
```
Vercel automatically sends `Authorization: Bearer $CRON_SECRET`-equivalent (via the `CRON_SECRET` env var convention) — the route checks this header per Section 5.

---

## 9. Error Handling Summary

- Tradovate auth/API errors → 502 from the import route, surfaced as a toast on the Journal page; cron failures appear in Vercel's cron logs (no additional alerting in v1).
- Unknown contract symbols → fills skipped, reported in the `skipped` count, logged server-side.
- Dedup is enforced via `imported_fills`; re-running the import is always safe (idempotent).

---

## 10. Out of Scope (v1)

- Live Tradovate account support (demo only).
- WebSocket/real-time streaming.
- Merging/splitting drafts in the UI (a lifecycle is always one draft row).
- Alerting on cron failures beyond Vercel's built-in logs.
