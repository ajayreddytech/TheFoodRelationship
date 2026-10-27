-- TheFoodRelationship schema. Run in the Supabase SQL editor.
create table if not exists public.users_profile (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dob date,
  gender text check (gender in ('male','female','other')),
  height_cm numeric,
  weight_kg numeric,
  activity_level text,
  unit_system text default 'metric',
  expenditure_goal numeric default 500,
  hydration_goal_l numeric default 2.5,
  fasting_goal_h numeric default 16,
  target_weight_kg numeric,
  updated_at timestamptz default now()
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  intake numeric default 0,
  expenditure numeric default 0,
  hydration_l numeric default 0,
  gyr text check (gyr in ('green','yellow','red')),
  nibbles boolean,
  first_meal_at timestamptz,
  last_meal_at timestamptz,
  fasting_hours numeric,
  fasted boolean default false,
  nutrients jsonb default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (user_id, log_date)
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.daily_logs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null,
  unique (user_id, log_date)
);

alter table public.daily_logs add column if not exists fasted boolean default false;

create table if not exists public.cooked_batches (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

alter table public.users_profile enable row level security;
alter table public.cooked_batches enable row level security;
drop policy if exists "own batches" on public.cooked_batches;
create policy "own batches" on public.cooked_batches for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter table public.daily_logs enable row level security;
alter table public.meal_entries enable row level security;
alter table public.weight_logs enable row level security;

drop policy if exists "own profile" on public.users_profile;
create policy "own profile" on public.users_profile for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own logs" on public.daily_logs;
create policy "own logs" on public.daily_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own meals" on public.meal_entries;
create policy "own meals" on public.meal_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own weights" on public.weight_logs;
create policy "own weights" on public.weight_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Plans, recipes, guide and FAQs (one row per user) so they follow you across devices.
create table if not exists public.user_content (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plans jsonb default '{}'::jsonb,
  recipes jsonb,
  guide jsonb,
  faqs jsonb,
  updated_at timestamptz default now()
);
alter table public.user_content enable row level security;
drop policy if exists "own content" on public.user_content;
drop policy if exists "own content" on public.user_content;
create policy "own content" on public.user_content for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Live drafts of each day's form (submitted or not) so every device stays in sync.
create table if not exists public.daily_drafts (
  user_id uuid references auth.users(id) on delete cascade,
  log_date date,
  data jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, log_date)
);
alter table public.daily_drafts enable row level security;
drop policy if exists "own drafts" on public.daily_drafts;
drop policy if exists "own drafts" on public.daily_drafts;
create policy "own drafts" on public.daily_drafts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Some projects don't auto-grant API roles on new tables; RLS still limits rows to the owner.
grant select, insert, update, delete on public.users_profile, public.daily_logs, public.meal_entries, public.weight_logs, public.user_content, public.daily_drafts, public.cooked_batches to authenticated;

-- Theme/palette preferences synced across devices
alter table public.users_profile add column if not exists prefs jsonb default '{}'::jsonb;
