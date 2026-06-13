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
