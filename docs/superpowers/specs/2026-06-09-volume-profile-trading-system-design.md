# Volume Profile Trading System — Design Spec

**Date:** 2026-06-09  
**Stack:** Next.js + Supabase + Vercel  
**Instrument:** NQ (Nasdaq Futures)  
**Broker:** Tradovate (connected via TradingView)

---

## 1. Overview

A web application for journaling and backtesting a trading strategy based on the Volume Profile indicator. The strategy uses 3 key price levels drawn from the **previous trading day's** Volume Profile:

- **POC** (Point of Control) — red line, most important; highest volume traded price of the previous day
- **VAH** (Value Area High) — purple line; upper boundary of the value area
- **VAL** (Value Area Low) — purple line; lower boundary of the value area

**Core trading logic:**
- If price is above the closest level → expect retest + continuation higher
- If price is below the closest level → expect retest + continuation lower
- Price may also break through, retest from the other side, and reverse (break + retest + reverse scenario)
- No trades before 9:30 AM

---

## 2. Architecture

```
┌─────────────────────────────────────────────┐
│              Next.js App (Vercel)            │
│                                              │
│  ┌──────────────┐    ┌─────────────────────┐ │
│  │   Frontend   │    │    API Routes        │ │
│  │  (React UI)  │◄──►│  /api/trades        │ │
│  │  Dashboard   │    │  /api/import        │ │
│  │  Journal     │    │  /api/backtest      │ │
│  │  Backtest    │    └──────────┬──────────┘ │
│  └──────────────┘               │            │
└────────────────────────────────┼────────────┘
                                 │
              ┌──────────────────┼──────────┐
              │                  │          │
     ┌────────▼──────┐   ┌───────▼──────┐  │
     │   Supabase    │   │  Tradovate   │  │
     │  (PostgreSQL) │   │     API      │  │
     │  - trades     │   │ (auto-import)│  │
     │  - backtest   │   └─────────────┘  │
     │    sessions   │                    │
     └───────────────┘                    │
```

**Three main pages:**
1. **Journal** — real trades log with auto-import + manual entry
2. **Backtest** — simulate trades against manually entered previous-day levels
3. **Dashboard** — combined statistics and performance breakdown

---

## 3. Data Model

### `trades` — real journal entries
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| date | date | trading date |
| time_entered | time | must be >= 09:30 |
| direction | enum | long / short |
| entry_price | decimal | |
| exit_price | decimal | |
| contracts | integer | number of contracts |
| level_type | enum | POC / VAH / VAL |
| level_price | decimal | the actual level price traded against |
| prev_day_poc | decimal | previous day POC |
| prev_day_vah | decimal | previous day VAH |
| prev_day_val | decimal | previous day VAL |
| scenario | enum | retest_continue / break_retest_reverse |
| pnl | decimal | calculated: (exit - entry) * contracts * tick_value |
| notes | text | optional |
| source | enum | auto / manual |
| created_at | timestamp | |

### `backtest_sessions` — a backtest run
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| created_at | timestamp | |
| date_from | date | |
| date_to | date | |
| notes | text | optional session description |

### `backtest_days` — one day within a session
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| session_id | uuid | FK → backtest_sessions |
| date | date | the trading day |
| prev_day_poc | decimal | manually entered previous day POC |
| prev_day_vah | decimal | manually entered previous day VAH |
| prev_day_val | decimal | manually entered previous day VAL |
| day_pnl | decimal | sum of all trades that day |

### `backtest_trades` — individual trades within a backtest day
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | primary key |
| session_id | uuid | FK → backtest_sessions |
| day_id | uuid | FK → backtest_days |
| date | date | |
| time_entered | time | |
| direction | enum | long / short |
| entry_price | decimal | |
| exit_price | decimal | |
| contracts | integer | |
| level_type | enum | POC / VAH / VAL |
| level_price | decimal | |
| scenario | enum | retest_continue / break_retest_reverse |
| pnl | decimal | |
| notes | text | optional |

---

## 4. Core Features

### Journal
- **Auto-import:** OAuth connection to Tradovate API; pulls executed fills and maps them to the trade schema
- **Manual entry:** Form with all trade fields; user specifies which level they traded and which scenario
- **Trade table:** columns — date, time, direction, level type, scenario, entry, exit, P&L
- **Filters:** date range, direction, level type (POC/VAH/VAL), scenario
- **Edit/delete** any entry

### Backtest
- Create a named session with date range
- For each day: input the **previous day's** POC, VAH, VAL
- Add simulated trades per day: time, direction, entry/exit, level traded, scenario, contracts
- Session summary: total P&L, win rate, number of trades, avg RR
- Multiple sessions supported for comparing different periods or approaches

### Dashboard
- **Stat cards:** win rate, total P&L, avg win, avg loss, avg risk/reward ratio, total trades
- **By level type:** win rate and P&L for POC vs VAH vs VAL separately
- **By scenario:** retest+continue vs break+retest+reverse performance
- **By direction:** long vs short breakdown
- **By time of day:** performance bucketed by hour (9:30–10:30, 10:30–11:30, 11:30–12:30, 12:30–13:30, 13:30+)
- **P&L over time:** line chart
- **Toggle:** Real Trades / Backtest / Combined view

---

## 5. UI Layout

### Journal Page
- Top bar: "Import from Tradovate" button | "Add Trade" button
- Filters bar: date range | direction | level type | scenario
- Trade table (paginated, sortable)
- Click row → expand to edit/delete

### Backtest Page
- Left sidebar: list of sessions + "New Session" button
- Right panel (active session):
  - Session header: date range, name, summary stats
  - Day table: date | prev POC | prev VAH | prev VAL | # trades | day P&L
  - Click day → expand: add/edit trades for that day
  - Session summary footer: total P&L | win rate | avg RR

### Dashboard Page
- Stat cards row at top
- Charts grid below: P&L over time | win rate by level | performance by time of day | long vs short
- Toggle bar: Real / Backtest / Combined

---

## 6. Error Handling

- Tradovate import failures show a clear error with retry option; already-imported trades are skipped (deduplication by trade ID)
- Manual trade entries validate that time >= 09:30
- Backtest trades validate that entry/exit prices are not zero
- All database errors surface as user-friendly toast notifications

---

## 7. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React, Tailwind CSS |
| Backend | Next.js API Routes (server actions) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Recharts |
| Deployment | Vercel |
| Tradovate | Tradovate REST API (OAuth 2.0) |
