create table if not exists public.winner_verifications (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null unique references public.winners(id) on delete cascade,
  submitted_by_user_id uuid not null references public.users(id) on delete restrict,
  proof_file_path text not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by_user_id uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_winner_verifications_status_created
  on public.winner_verifications(status, created_at);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  winner_id uuid not null unique references public.winners(id) on delete cascade,
  status text not null check (status in ('pending', 'paid')),
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null default 'USD',
  paid_at timestamptz,
  marked_paid_by_user_id uuid references public.users(id) on delete set null,
  payment_reference text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_payouts_status_created
  on public.payouts(status, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('email')),
  event_type text not null,
  template_code text not null,
  payload_json jsonb not null,
  delivery_status text not null check (delivery_status in ('queued', 'sent', 'failed', 'suppressed')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notifications_status_created
  on public.notifications(delivery_status, created_at);

alter table public.winner_verifications enable row level security;
alter table public.payouts enable row level security;
alter table public.notifications enable row level security;

drop policy if exists winner_verification_submitter_select on public.winner_verifications;
create policy winner_verification_submitter_select on public.winner_verifications
  for select to authenticated
  using (auth.uid() = submitted_by_user_id);

drop policy if exists winner_verification_submitter_insert on public.winner_verifications;
create policy winner_verification_submitter_insert on public.winner_verifications
  for insert to authenticated
  with check (auth.uid() = submitted_by_user_id);

drop policy if exists winner_verification_submitter_update on public.winner_verifications;
create policy winner_verification_submitter_update on public.winner_verifications
  for update to authenticated
  using (auth.uid() = submitted_by_user_id)
  with check (auth.uid() = submitted_by_user_id);

drop policy if exists payouts_winner_user_select on public.payouts;
create policy payouts_winner_user_select on public.payouts
  for select to authenticated
  using (
    exists (
      select 1
      from public.winners w
      where w.id = payouts.winner_id and w.user_id = auth.uid()
    )
  );

drop policy if exists notifications_user_select on public.notifications;
create policy notifications_user_select on public.notifications
  for select to authenticated
  using (auth.uid() = user_id);
