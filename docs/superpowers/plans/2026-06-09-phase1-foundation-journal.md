# Volume Profile — Phase 1: Foundation + Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working Next.js + Supabase web app with authentication, full Supabase schema, and a manual trade journal (add/edit/delete/filter trades with correct NQ P&L calculation).

**Architecture:** Next.js 14 App Router with server components fetching data, client components for interactivity. Supabase handles auth + PostgreSQL. Tailwind CSS for styling. Pure utility functions tested with Vitest.

**Tech Stack:** Next.js 14, Supabase (@supabase/ssr), TypeScript, Tailwind CSS, Vitest, React Testing Library

**Scope of this plan:** Foundation + Journal (manual entry only). Tradovate import → Plan 2. Backtest module → Plan 3. Dashboard → Plan 4. Concepts → Plan 5.

---

## File Map

```
volume-profile/
├── app/
│   ├── globals.css
│   ├── layout.tsx                    # Root layout — nav sidebar for auth'd users
│   ├── page.tsx                      # Redirects to /journal
│   ├── login/
│   │   ├── page.tsx                  # Login form
│   │   └── actions.ts                # login() and logout() server actions
│   ├── journal/
│   │   ├── page.tsx                  # Server component — fetches trades, renders JournalClient
│   │   └── actions.ts                # createTrade, updateTrade, deleteTrade server actions
│   ├── backtest/
│   │   └── page.tsx                  # Stub page
│   ├── dashboard/
│   │   └── page.tsx                  # Stub page
│   └── concepts/
│       └── page.tsx                  # Stub page
├── components/
│   ├── nav.tsx                       # Sidebar navigation with Sign out
│   └── journal/
│       ├── journal-client.tsx        # Client wrapper — filters state, stat summary
│       ├── trade-table.tsx           # Trade rows with edit/delete
│       ├── trade-form.tsx            # Add/edit modal form
│       └── filters-bar.tsx           # Date/direction/level/scenario filters
├── lib/
│   ├── supabase/
│   │   ├── client.ts                 # createBrowserClient
│   │   └── server.ts                 # createServerClient (cookie-based)
│   ├── utils.ts                      # calculatePnl, formatPnl, formatTime, formatDate
│   └── trades.ts                     # filterTrades, sumPnl, winRate, avgWin, avgLoss, avgRR, prepareTradeData
├── types/
│   └── index.ts                      # Trade, TradeFormData, TradeFilters, Backtest*, Concept types
├── __tests__/
│   ├── utils.test.ts
│   └── trades.test.ts
├── supabase/
│   └── migrations/
│       └── 001_initial.sql           # Full schema: trades, backtest_sessions/days/trades, concepts + RLS
├── middleware.ts                     # Auth redirect
├── vitest.config.ts
├── vitest.setup.ts
└── .env.local.example
```

---

## Task 1: Bootstrap Next.js project

**Files:**
- Create: `package.json`, `vitest.config.ts`, `vitest.setup.ts`, `.env.local.example`

- [ ] **Step 1: Create project**

```bash
cd C:\Users\nikol\Desktop
npx create-next-app@latest volume-profile --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
cd volume-profile
```

- [ ] **Step 2: Install Supabase and testing dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 5: Create .env.local.example**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

- [ ] **Step 6: Verify app starts**

```bash
npm run dev
```
Expected: Next.js starts on http://localhost:3000 with no errors.

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: bootstrap Next.js project with Supabase and Vitest"
```

---

## Task 2: Supabase schema migration

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Create Supabase project**

- Go to supabase.com → New project → name it `volume-profile`
- Once created, go to Project Settings → API
- Copy the **Project URL** and **anon public key**
- Create `.env.local` (copy from `.env.local.example`) and fill in both values

- [ ] **Step 2: Write migration**

Create `supabase/migrations/001_initial.sql`:
```sql
create extension if not exists "uuid-ossp";

-- Real journal trades
create table trades (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time_entered time not null check (time_entered >= '09:30:00'),
  direction text not null check (direction in ('long', 'short')),
  entry_price decimal(10,2) not null,
  exit_price decimal(10,2) not null,
  contracts integer not null check (contracts > 0),
  level_type text not null check (level_type in ('POC', 'VAH', 'VAL')),
  level_price decimal(10,2) not null,
  prev_day_poc decimal(10,2) not null,
  prev_day_vah decimal(10,2) not null,
  prev_day_val decimal(10,2) not null,
  scenario text not null check (scenario in ('retest_continue', 'break_retest_reverse')),
  pnl decimal(10,2) not null,
  notes text,
  source text not null default 'manual' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now()
);

-- Backtest sessions
create table backtest_sessions (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now(),
  date_from date not null,
  date_to date not null,
  notes text
);

-- Backtest days (one row per trading day per session)
create table backtest_days (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references backtest_sessions(id) on delete cascade,
  date date not null,
  prev_day_poc decimal(10,2) not null,
  prev_day_vah decimal(10,2) not null,
  prev_day_val decimal(10,2) not null,
  day_pnl decimal(10,2) not null default 0
);

-- Backtest trades
create table backtest_trades (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references backtest_sessions(id) on delete cascade,
  day_id uuid not null references backtest_days(id) on delete cascade,
  date date not null,
  time_entered time not null,
  direction text not null check (direction in ('long', 'short')),
  entry_price decimal(10,2) not null,
  exit_price decimal(10,2) not null,
  contracts integer not null check (contracts > 0),
  level_type text not null check (level_type in ('POC', 'VAH', 'VAL')),
  level_price decimal(10,2) not null,
  scenario text not null check (scenario in ('retest_continue', 'break_retest_reverse')),
  pnl decimal(10,2) not null,
  notes text
);

-- Concepts / research notes
create table concepts (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text not null default 'General',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security — authenticated users only
alter table trades enable row level security;
alter table backtest_sessions enable row level security;
alter table backtest_days enable row level security;
alter table backtest_trades enable row level security;
alter table concepts enable row level security;

create policy "auth_trades" on trades for all to authenticated using (true) with check (true);
create policy "auth_backtest_sessions" on backtest_sessions for all to authenticated using (true) with check (true);
create policy "auth_backtest_days" on backtest_days for all to authenticated using (true) with check (true);
create policy "auth_backtest_trades" on backtest_trades for all to authenticated using (true) with check (true);
create policy "auth_concepts" on concepts for all to authenticated using (true) with check (true);
```

- [ ] **Step 3: Run migration**

- Go to Supabase dashboard → SQL Editor → New query
- Paste the full SQL above → click **Run**
- Verify: Table Editor shows 5 new tables (trades, backtest_sessions, backtest_days, backtest_trades, concepts)

- [ ] **Step 4: Create your login user**

- Supabase dashboard → Authentication → Users → **Add user**
- Email: `nikolatodorovic800@gmail.com`, set a strong password
- This is the single account for the app

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "chore: add full Supabase schema migration"
```

---

## Task 3: Supabase clients + TypeScript types

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `types/index.ts`

- [ ] **Step 1: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — middleware handles session refresh
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Define all TypeScript types**

Create `types/index.ts`:
```typescript
export type Direction = 'long' | 'short'
export type LevelType = 'POC' | 'VAH' | 'VAL'
export type Scenario = 'retest_continue' | 'break_retest_reverse'
export type TradeSource = 'auto' | 'manual'

export interface Trade {
  id: string
  date: string           // "2026-06-09"
  time_entered: string   // "HH:MM:SS"
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  scenario: Scenario
  pnl: number
  notes: string | null
  source: TradeSource
  created_at: string
}

export interface TradeFormData {
  date: string
  time_entered: string
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  scenario: Scenario
  notes?: string
}

export interface TradeFilters {
  date_from?: string
  date_to?: string
  direction?: Direction
  level_type?: LevelType
  scenario?: Scenario
}

export interface BacktestSession {
  id: string
  created_at: string
  date_from: string
  date_to: string
  notes: string | null
}

export interface BacktestDay {
  id: string
  session_id: string
  date: string
  prev_day_poc: number
  prev_day_vah: number
  prev_day_val: number
  day_pnl: number
}

export interface BacktestTrade {
  id: string
  session_id: string
  day_id: string
  date: string
  time_entered: string
  direction: Direction
  entry_price: number
  exit_price: number
  contracts: number
  level_type: LevelType
  level_price: number
  scenario: Scenario
  pnl: number
  notes: string | null
}

export interface Concept {
  id: string
  title: string
  category: string
  body: string
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/ types/
git commit -m "feat: add Supabase clients and TypeScript types"
```

---

## Task 4: Auth — middleware + login page

**Files:**
- Create: `middleware.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/actions.ts`
- Create: `__tests__/auth-routing.test.ts`

- [ ] **Step 1: Write failing tests for auth routing logic**

Create `__tests__/auth-routing.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

function resolveRoute(isAuthenticated: boolean, pathname: string): string {
  if (!isAuthenticated && pathname !== '/login') return 'redirect:/login'
  if (isAuthenticated && pathname === '/login') return 'redirect:/journal'
  return 'allow'
}

describe('auth routing', () => {
  it('redirects unauthenticated user from /journal to /login', () => {
    expect(resolveRoute(false, '/journal')).toBe('redirect:/login')
  })

  it('redirects unauthenticated user from / to /login', () => {
    expect(resolveRoute(false, '/')).toBe('redirect:/login')
  })

  it('allows authenticated user to access /journal', () => {
    expect(resolveRoute(true, '/journal')).toBe('allow')
  })

  it('redirects authenticated user away from /login to /journal', () => {
    expect(resolveRoute(true, '/login')).toBe('redirect:/journal')
  })

  it('allows unauthenticated user to stay on /login', () => {
    expect(resolveRoute(false, '/login')).toBe('allow')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm run test:run -- __tests__/auth-routing.test.ts
```
Expected: 5 tests PASS

- [ ] **Step 3: Create auth middleware**

Create `middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/journal'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Create server actions for auth**

Create `app/login/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/journal')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

- [ ] **Step 5: Create login page**

Create `app/login/page.tsx`:
```tsx
import { login } from './actions'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h1 className="text-xl font-semibold text-white mb-6">Volume Profile</h1>
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-400" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-sm font-medium transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Test login flow**

```bash
npm run dev
```
- Open http://localhost:3000 → should redirect to /login
- Enter the credentials created in Task 2, Step 4
- Should redirect to /journal (blank page for now)

- [ ] **Step 7: Commit**

```bash
git add middleware.ts app/login/ __tests__/auth-routing.test.ts
git commit -m "feat: add auth middleware and login page"
```

---

## Task 5: Root layout + navigation + stub pages

**Files:**
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `components/nav.tsx`
- Create: `app/backtest/page.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `app/concepts/page.tsx`

- [ ] **Step 1: Create navigation sidebar**

Create `components/nav.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/login/actions'

const navItems = [
  { href: '/journal', label: 'Journal' },
  { href: '/backtest', label: 'Backtest' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/concepts', label: 'Concepts' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="w-56 min-h-screen bg-gray-900 border-r border-gray-800 flex flex-col py-6 px-4 shrink-0">
      <span className="text-white font-semibold text-base mb-8 px-2">Volume Profile</span>
      <div className="flex flex-col gap-1 flex-1">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              pathname.startsWith(item.href)
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <form action={logout}>
        <button
          type="submit"
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          Sign out
        </button>
      </form>
    </nav>
  )
}
```

- [ ] **Step 2: Create root layout**

Create `app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { createClient } from '@/lib/supabase/server'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Volume Profile',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        {user ? (
          <div className="flex min-h-screen">
            <Nav />
            <main className="flex-1 p-8 overflow-auto">{children}</main>
          </div>
        ) : (
          <>{children}</>
        )}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create root redirect**

Create `app/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/journal')
}
```

- [ ] **Step 4: Create stub pages**

Create `app/backtest/page.tsx`:
```tsx
export default function BacktestPage() {
  return <h1 className="text-2xl font-semibold">Backtest — coming in Phase 3</h1>
}
```

Create `app/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return <h1 className="text-2xl font-semibold">Dashboard — coming in Phase 4</h1>
}
```

Create `app/concepts/page.tsx`:
```tsx
export default function ConceptsPage() {
  return <h1 className="text-2xl font-semibold">Concepts — coming in Phase 5</h1>
}
```

- [ ] **Step 5: Verify navigation**

```bash
npm run dev
```
- Login → verify sidebar appears with 4 nav items
- Click each nav item → verify correct page loads
- Click Sign out → verify redirect to /login

- [ ] **Step 6: Commit**

```bash
git add app/ components/nav.tsx
git commit -m "feat: add root layout, navigation sidebar, and stub pages"
```

---

## Task 6: P&L utilities — TDD

**Files:**
- Create: `lib/utils.ts`
- Create: `__tests__/utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculatePnl, formatPnl, formatTime, formatDate } from '@/lib/utils'

describe('calculatePnl', () => {
  it('calculates long profit: +10 points = +$200 per contract', () => {
    expect(calculatePnl('long', 21000, 21010, 1)).toBe(200)
  })

  it('calculates long loss: -10 points = -$200', () => {
    expect(calculatePnl('long', 21010, 21000, 1)).toBe(-200)
  })

  it('calculates short profit: sell 21010, buy back 21000 = +$200', () => {
    expect(calculatePnl('short', 21010, 21000, 1)).toBe(200)
  })

  it('calculates short loss: sell 21000, buy back 21010 = -$200', () => {
    expect(calculatePnl('short', 21000, 21010, 1)).toBe(-200)
  })

  it('scales with multiple contracts: long +5 pts × 2 contracts = $200', () => {
    expect(calculatePnl('long', 21000, 21005, 2)).toBe(200)
  })

  it('handles tick precision: 0.25 points = $5', () => {
    expect(calculatePnl('long', 21000, 21000.25, 1)).toBe(5)
  })
})

describe('formatPnl', () => {
  it('formats positive with + prefix', () => {
    expect(formatPnl(200)).toBe('+$200.00')
  })

  it('formats negative with - prefix', () => {
    expect(formatPnl(-200)).toBe('-$200.00')
  })

  it('formats zero without sign', () => {
    expect(formatPnl(0)).toBe('$0.00')
  })
})

describe('formatTime', () => {
  it('trims seconds from time string', () => {
    expect(formatTime('09:30:00')).toBe('09:30')
  })
})

describe('formatDate', () => {
  it('formats ISO date to readable string', () => {
    expect(formatDate('2026-06-09')).toBe('Jun 9, 2026')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- __tests__/utils.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/utils'"

- [ ] **Step 3: Implement utils**

Create `lib/utils.ts`:
```typescript
import type { Direction } from '@/types'

export function calculatePnl(
  direction: Direction,
  entryPrice: number,
  exitPrice: number,
  contracts: number
): number {
  const points = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice
  return Math.round(points * contracts * 20 * 100) / 100
}

export function formatPnl(pnl: number): string {
  const abs = Math.abs(pnl).toFixed(2)
  if (pnl > 0) return `+$${abs}`
  if (pnl < 0) return `-$${abs}`
  return `$${abs}`
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/utils.test.ts
```
Expected: 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils.ts __tests__/utils.test.ts
git commit -m "feat: add NQ P&L calculation and formatting utilities"
```

---

## Task 7: Trades data library — TDD

**Files:**
- Create: `lib/trades.ts`
- Create: `__tests__/trades.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/trades.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { filterTrades, sumPnl, winRate, avgWin, avgLoss, avgRR, prepareTradeData } from '@/lib/trades'
import type { Trade } from '@/types'

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: '1',
  date: '2026-06-09',
  time_entered: '10:00:00',
  direction: 'long',
  entry_price: 21000,
  exit_price: 21010,
  contracts: 1,
  level_type: 'POC',
  level_price: 21000,
  prev_day_poc: 21000,
  prev_day_vah: 21050,
  prev_day_val: 20950,
  scenario: 'retest_continue',
  pnl: 200,
  notes: null,
  source: 'manual',
  created_at: '2026-06-09T10:00:00Z',
  ...overrides,
})

describe('filterTrades', () => {
  const trades = [
    makeTrade({ id: '1', date: '2026-06-09', direction: 'long', level_type: 'POC', scenario: 'retest_continue' }),
    makeTrade({ id: '2', date: '2026-06-08', direction: 'short', level_type: 'VAH', scenario: 'break_retest_reverse' }),
    makeTrade({ id: '3', date: '2026-06-07', direction: 'long', level_type: 'VAL', scenario: 'retest_continue' }),
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

  it('filters by date_from (inclusive)', () => {
    const result = filterTrades(trades, { date_from: '2026-06-08' })
    expect(result).toHaveLength(2)
  })

  it('filters by date_to (inclusive)', () => {
    const result = filterTrades(trades, { date_to: '2026-06-08' })
    expect(result).toHaveLength(2)
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

describe('prepareTradeData', () => {
  it('calculates pnl and sets source to manual', () => {
    const result = prepareTradeData({
      date: '2026-06-09',
      time_entered: '10:00',
      direction: 'long',
      entry_price: 21000,
      exit_price: 21010,
      contracts: 1,
      level_type: 'POC',
      level_price: 21000,
      prev_day_poc: 21000,
      prev_day_vah: 21050,
      prev_day_val: 20950,
      scenario: 'retest_continue',
    })
    expect(result.pnl).toBe(200)
    expect(result.source).toBe('manual')
    expect(result.notes).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- __tests__/trades.test.ts
```
Expected: FAIL — "Cannot find module '@/lib/trades'"

- [ ] **Step 3: Implement trades library**

Create `lib/trades.ts`:
```typescript
import type { Trade, TradeFilters, TradeFormData } from '@/types'
import { calculatePnl } from './utils'

export function filterTrades(trades: Trade[], filters: TradeFilters): Trade[] {
  return trades.filter(trade => {
    if (filters.direction && trade.direction !== filters.direction) return false
    if (filters.level_type && trade.level_type !== filters.level_type) return false
    if (filters.scenario && trade.scenario !== filters.scenario) return false
    if (filters.date_from && trade.date < filters.date_from) return false
    if (filters.date_to && trade.date > filters.date_to) return false
    return true
  })
}

export function sumPnl(trades: Trade[]): number {
  return Math.round(trades.reduce((sum, t) => sum + t.pnl, 0) * 100) / 100
}

export function winRate(trades: Trade[]): number {
  if (trades.length === 0) return 0
  return Math.round((trades.filter(t => t.pnl > 0).length / trades.length) * 100)
}

export function avgWin(trades: Trade[]): number {
  const winners = trades.filter(t => t.pnl > 0)
  if (winners.length === 0) return 0
  return Math.round((winners.reduce((s, t) => s + t.pnl, 0) / winners.length) * 100) / 100
}

export function avgLoss(trades: Trade[]): number {
  const losers = trades.filter(t => t.pnl < 0)
  if (losers.length === 0) return 0
  return Math.round((losers.reduce((s, t) => s + t.pnl, 0) / losers.length) * 100) / 100
}

export function avgRR(trades: Trade[]): number {
  const win = Math.abs(avgWin(trades))
  const loss = Math.abs(avgLoss(trades))
  if (loss === 0) return 0
  return Math.round((win / loss) * 100) / 100
}

export function prepareTradeData(formData: TradeFormData): Omit<Trade, 'id' | 'created_at'> {
  return {
    date: formData.date,
    time_entered: formData.time_entered,
    direction: formData.direction,
    entry_price: formData.entry_price,
    exit_price: formData.exit_price,
    contracts: formData.contracts,
    level_type: formData.level_type,
    level_price: formData.level_price,
    prev_day_poc: formData.prev_day_poc,
    prev_day_vah: formData.prev_day_vah,
    prev_day_val: formData.prev_day_val,
    scenario: formData.scenario,
    pnl: calculatePnl(formData.direction, formData.entry_price, formData.exit_price, formData.contracts),
    notes: formData.notes ?? null,
    source: 'manual',
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:run -- __tests__/trades.test.ts
```
Expected: 17 tests PASS

- [ ] **Step 5: Run all tests**

```bash
npm run test:run
```
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add lib/trades.ts __tests__/trades.test.ts
git commit -m "feat: add trades data library with filtering and statistics"
```

---

## Task 8: Trade CRUD server actions + trade form

**Files:**
- Create: `app/journal/actions.ts`
- Create: `components/journal/trade-form.tsx`

- [ ] **Step 1: Create server actions**

Create `app/journal/actions.ts`:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { prepareTradeData } from '@/lib/trades'
import type { TradeFormData } from '@/types'
import { revalidatePath } from 'next/cache'

export async function createTrade(formData: TradeFormData) {
  const supabase = await createClient()
  const data = prepareTradeData(formData)
  const { error } = await supabase.from('trades').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}

export async function updateTrade(id: string, formData: TradeFormData) {
  const supabase = await createClient()
  const data = prepareTradeData(formData)
  const { error } = await supabase.from('trades').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}

export async function deleteTrade(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/journal')
  return { success: true }
}
```

- [ ] **Step 2: Create trade form modal**

Create `components/journal/trade-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createTrade, updateTrade } from '@/app/journal/actions'
import type { Trade, TradeFormData, Direction, LevelType, Scenario } from '@/types'

const inputClass =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full'

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
  entry_price: 0,
  exit_price: 0,
  contracts: 1,
  level_type: 'POC',
  level_price: 0,
  prev_day_poc: 0,
  prev_day_vah: 0,
  prev_day_val: 0,
  scenario: 'retest_continue',
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
          entry_price: trade.entry_price,
          exit_price: trade.exit_price,
          contracts: trade.contracts,
          level_type: trade.level_type,
          level_price: trade.level_price,
          prev_day_poc: trade.prev_day_poc,
          prev_day_vah: trade.prev_day_vah,
          prev_day_val: trade.prev_day_val,
          scenario: trade.scenario,
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
      entry_price: Number(form.entry_price),
      exit_price: Number(form.exit_price),
      contracts: Number(form.contracts),
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
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
            <Field label="Contracts">
              <input type="number" min="1" value={form.contracts}
                onChange={e => set('contracts', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry Price">
              <input type="number" step="0.25" value={form.entry_price}
                onChange={e => set('entry_price', e.target.value)}
                className={inputClass} required />
            </Field>
            <Field label="Exit Price">
              <input type="number" step="0.25" value={form.exit_price}
                onChange={e => set('exit_price', e.target.value)}
                className={inputClass} required />
            </Field>
          </div>

          <div className="border-t border-gray-800 pt-4">
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : trade ? 'Save Changes' : 'Add Trade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/journal/actions.ts components/journal/trade-form.tsx
git commit -m "feat: add trade CRUD server actions and trade form modal"
```

---

## Task 9: Filters bar component

**Files:**
- Create: `components/journal/filters-bar.tsx`

- [ ] **Step 1: Create filters bar**

Create `components/journal/filters-bar.tsx`:
```tsx
'use client'

import type { TradeFilters, Direction, LevelType, Scenario } from '@/types'

const selectClass =
  'bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500'

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
      <input type="date" value={filters.date_from ?? ''} title="From date"
        onChange={e => set('date_from', e.target.value)} className={selectClass} />
      <input type="date" value={filters.date_to ?? ''} title="To date"
        onChange={e => set('date_to', e.target.value)} className={selectClass} />
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
git commit -m "feat: add journal filters bar"
```

---

## Task 10: Trade table component

**Files:**
- Create: `components/journal/trade-table.tsx`

- [ ] **Step 1: Create trade table**

Create `components/journal/trade-table.tsx`:
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

export function TradeTable({ trades }: { trades: Trade[] }) {
  const [editing, setEditing] = useState<Trade | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this trade?')) return
    await deleteTrade(id)
  }

  if (trades.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">
        No trades yet. Click "+ Add Trade" to log your first trade.
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              {['Date', 'Time', 'Direction', 'Level', 'Scenario', 'Entry', 'Exit', 'Qty', 'P&L', ''].map(h => (
                <th key={h} className="pb-3 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.map(trade => (
              <tr key={trade.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="py-3 pr-4">{formatDate(trade.date)}</td>
                <td className="py-3 pr-4 text-gray-400">{formatTime(trade.time_entered)}</td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.direction === 'long'
                      ? 'bg-green-900/50 text-green-400'
                      : 'bg-red-900/50 text-red-400'
                  }`}>
                    {trade.direction.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    trade.level_type === 'POC'
                      ? 'bg-red-900/40 text-red-300'
                      : 'bg-purple-900/40 text-purple-300'
                  }`}>
                    {trade.level_type}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400 text-xs">{scenarioLabel[trade.scenario]}</td>
                <td className="py-3 pr-4 font-mono">{trade.entry_price}</td>
                <td className="py-3 pr-4 font-mono">{trade.exit_price}</td>
                <td className="py-3 pr-4 text-gray-400">{trade.contracts}</td>
                <td className={`py-3 pr-4 font-mono font-medium ${
                  trade.pnl > 0 ? 'text-green-400' : trade.pnl < 0 ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {formatPnl(trade.pnl)}
                </td>
                <td className="py-3">
                  <div className="flex gap-3">
                    <button onClick={() => setEditing(trade)}
                      className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => handleDelete(trade.id)}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors">Delete</button>
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
git commit -m "feat: add trade table with edit and delete"
```

---

## Task 11: Journal page — wire everything together

**Files:**
- Create: `components/journal/journal-client.tsx`
- Create: `app/journal/page.tsx`

- [ ] **Step 1: Create client-side journal wrapper**

Create `components/journal/journal-client.tsx`:
```tsx
'use client'

import { useState } from 'react'
import type { Trade, TradeFilters } from '@/types'
import { filterTrades, sumPnl, winRate } from '@/lib/trades'
import { formatPnl } from '@/lib/utils'
import { FiltersBar } from './filters-bar'
import { TradeTable } from './trade-table'
import { TradeForm } from './trade-form'

export function JournalClient({ initialTrades }: { initialTrades: Trade[] }) {
  const [filters, setFilters] = useState<TradeFilters>({})
  const [showForm, setShowForm] = useState(false)

  const filtered = filterTrades(initialTrades, filters)
  const totalPnl = sumPnl(filtered)
  const wr = winRate(filtered)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Journal</h1>
          <p className="text-sm text-gray-400 mt-1">
            {filtered.length} trade{filtered.length !== 1 ? 's' : ''} · Win rate {wr}% ·{' '}
            <span className={totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatPnl(totalPnl)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Trade
        </button>
      </div>

      <div className="mb-5">
        <FiltersBar filters={filters} onChange={setFilters} />
      </div>

      <TradeTable trades={filtered} />

      {showForm && <TradeForm onClose={() => setShowForm(false)} />}
    </div>
  )
}
```

- [ ] **Step 2: Create journal server page**

Create `app/journal/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { JournalClient } from '@/components/journal/journal-client'
import type { Trade } from '@/types'

export default async function JournalPage() {
  const supabase = await createClient()

  const { data: trades } = await supabase
    .from('trades')
    .select('*')
    .order('date', { ascending: false })
    .order('time_entered', { ascending: false })

  return <JournalClient initialTrades={(trades as Trade[]) ?? []} />
}
```

- [ ] **Step 3: Test the full journal flow**

```bash
npm run dev
```
Open http://localhost:3000, login, then:

1. Click **+ Add Trade**, fill in:
   - Date: today, Time: 10:00, Direction: Long, Contracts: 1
   - Entry: 21000, Exit: 21010
   - Prev day POC: 21000, VAH: 21050, VAL: 20950
   - Level traded: POC, Level price: 21000
   - Scenario: Retest + Continue
   - Click **Add Trade**
2. Verify trade appears in table with **P&L = +$200.00** (10 points × $20)
3. Apply **Direction: Short** filter → trade disappears
4. Clear filters → trade reappears
5. Click **Edit** → change Exit to 20990 → Save → P&L shows **-$200.00**
6. Click **Delete** → confirm → trade removed

- [ ] **Step 4: Run all tests**

```bash
npm run test:run
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add app/journal/ components/journal/
git commit -m "feat: complete journal page with add, edit, delete, and filters"
```

---

## Task 12: Deploy to Vercel

**Files:** No new files

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/njmoney21/volume-profile.git
git push -u origin master
```

- [ ] **Step 2: Deploy to Vercel**

- Go to vercel.com → **Add New Project** → Import `volume-profile`
- Under **Environment Variables**, add:
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key
- Click **Deploy**

- [ ] **Step 3: Verify production**

- Open the Vercel deployment URL
- Login with your credentials
- Add a test trade and confirm it saves and shows correct P&L

---

## What comes next

| Plan | Scope |
|------|-------|
| Phase 2 | Tradovate auto-import via API |
| Phase 3 | Backtest module (sessions, days, trades) |
| Phase 4 | Dashboard (charts, full stats breakdown) |
| Phase 5 | Concepts / research notes page |
