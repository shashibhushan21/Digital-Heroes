create table if not exists public.draws (
  id uuid primary key default gen_random_uuid(),
  draw_year integer not null,
  draw_month integer not null check (draw_month between 1 and 12),
  mode text not null check (mode in ('random', 'weighted')),
  status text not null check (status in ('draft', 'simulated', 'published', 'closed')),
  published_at timestamptz,
  published_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (draw_year, draw_month)
);

create index if not exists idx_draws_period on public.draws(draw_year desc, draw_month desc);
create index if not exists idx_draws_status on public.draws(status);

create table if not exists public.draw_runs (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  run_type text not null check (run_type in ('simulation', 'official')),
  run_version integer not null default 1,
  result_numbers jsonb not null,
  participant_snapshot_count integer not null,
  executed_at timestamptz not null default now(),
  executed_by uuid references public.users(id) on delete set null,
  is_published boolean not null default false
);

create unique index if not exists idx_draw_runs_official_unique
  on public.draw_runs(draw_id)
  where run_type = 'official';

create index if not exists idx_draw_runs_draw_type on public.draw_runs(draw_id, run_type, executed_at desc);

create table if not exists public.draw_entries (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  entry_numbers jsonb not null,
  match_count smallint not null check (match_count between 0 and 5),
  is_eligible boolean not null default true,
  created_at timestamptz not null default now(),
  unique (draw_id, user_id)
);

create index if not exists idx_draw_entries_draw_match on public.draw_entries(draw_id, match_count);

create table if not exists public.prize_pools (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null unique references public.draws(id) on delete cascade,
  active_subscriber_count integer not null,
  gross_pool_minor integer not null check (gross_pool_minor >= 0),
  rollover_in_minor integer not null default 0 check (rollover_in_minor >= 0),
  tier_5_minor integer not null check (tier_5_minor >= 0),
  tier_4_minor integer not null check (tier_4_minor >= 0),
  tier_3_minor integer not null check (tier_3_minor >= 0),
  rollover_out_minor integer not null default 0 check (rollover_out_minor >= 0),
  currency text not null default 'USD',
  computed_at timestamptz not null default now()
);

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  draw_id uuid not null references public.draws(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  draw_entry_id uuid references public.draw_entries(id) on delete set null,
  tier smallint not null check (tier in (3, 4, 5)),
  winning_amount_minor integer not null check (winning_amount_minor >= 0),
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create index if not exists idx_winners_draw_tier on public.winners(draw_id, tier);
create index if not exists idx_winners_user_created on public.winners(user_id, created_at desc);
