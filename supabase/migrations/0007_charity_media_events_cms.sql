create table if not exists public.charity_media (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  media_url text not null,
  alt_text text not null default '',
  caption text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(charity_id, media_url)
);

create index if not exists idx_charity_media_charity_sort
  on public.charity_media(charity_id, sort_order, created_at desc)
  where is_active = true;

create table if not exists public.charity_events (
  id uuid primary key default gen_random_uuid(),
  charity_id uuid not null references public.charities(id) on delete cascade,
  title text not null,
  description text not null,
  event_image_url text,
  location text,
  event_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_charity_events_charity_starts
  on public.charity_events(charity_id, starts_at desc);

create index if not exists idx_charity_events_published_starts
  on public.charity_events(is_published, starts_at desc);
