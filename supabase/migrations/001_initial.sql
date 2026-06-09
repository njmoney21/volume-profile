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
