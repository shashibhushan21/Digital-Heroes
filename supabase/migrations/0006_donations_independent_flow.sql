create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  charity_id uuid not null references public.charities(id) on delete restrict,
  source_type text not null check (source_type in ('subscription_allocation', 'independent')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'USD',
  reference_type text check (reference_type in ('subscription_invoice', 'manual_checkout', 'admin_adjustment')),
  reference_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_donations_charity_created on public.donations(charity_id, created_at desc);
create index if not exists idx_donations_user_created on public.donations(user_id, created_at desc);

alter table public.donations enable row level security;

drop policy if exists donations_self_select on public.donations;
create policy donations_self_select on public.donations
  for select to authenticated
  using (auth.uid() = user_id);
