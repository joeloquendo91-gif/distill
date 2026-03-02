-- Run this in your Supabase SQL editor

-- User tiers (auto-created on signup via trigger)
create table if not exists public.user_tiers (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  tier text not null default 'free' check (tier in ('free', 'pro', 'agency')),
  row_limit integer not null default 1000,
  ai_calls_this_month integer not null default 0,
  ai_calls_reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  shares_created integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Shared dashboards (stores aggregated summaries — never raw CSV data)
create table if not exists public.shared_dashboards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default 'Untitled Dashboard',
  description text,
  summary_json jsonb not null,
  narrative text,
  is_public boolean not null default true,
  view_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.user_tiers enable row level security;
alter table public.shared_dashboards enable row level security;

-- user_tiers policies
create policy "Users can view own tier"
  on public.user_tiers for select
  using (auth.uid() = user_id);

create policy "Users can update own tier"
  on public.user_tiers for update
  using (auth.uid() = user_id);

-- shared_dashboards policies
create policy "Anyone can view public dashboards"
  on public.shared_dashboards for select
  using (is_public = true);

create policy "Authenticated users can insert"
  on public.shared_dashboards for insert
  with check (auth.uid() = user_id);

create policy "Users can manage own dashboards"
  on public.shared_dashboards for all
  using (auth.uid() = user_id);

-- Auto-increment view_count function
create or replace function increment_view_count(dashboard_id uuid)
returns void as $$
  update public.shared_dashboards
  set view_count = view_count + 1
  where id = dashboard_id;
$$ language sql security definer;

-- Auto-create tier row on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_tiers (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
