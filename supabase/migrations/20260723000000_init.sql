-- Recruiting OS — multi-tenant schema.
-- Replaces the old single-workspace Notion database as the app's data layer.
-- Every table is scoped by user_id + RLS, so each signed-in user only ever
-- sees their own rows. user_api_keys / google_calendar_tokens are deliberately
-- NOT exposed to PostgREST (no client-side access at all, RLS-denied by
-- default with no policies) — only the service-role key (server-side only,
-- inside Vercel functions) can read/write them, so a plaintext API key never
-- transits through the browser-facing anon-key client.

create extension if not exists pgcrypto;

-- ── Profiles ────────────────────────────────────────────────────────────────
-- One row per auth.users row (1:1), auto-created by the trigger below.
-- Replaces the hardcoded "UMich CS sophomore, Fall 2026" assumptions that used
-- to be baked into lib/discovery.js, lib/companyFinder.js, lib/drafting.js —
-- every other user's prompts/scoring now read these fields instead.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  school text,
  grad_year int,
  focus text default 'SWE',              -- 'SWE' | 'PM' | 'Both'
  ai_provider text default 'claude',      -- 'claude' | 'openai' — per-user replacement for VITE_AI_PROVIDER
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row (and seed a friendly default name) whenever a new
-- auth.users row is created — signup only, no manual provisioning step.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Contacts ────────────────────────────────────────────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  company text,
  role text,
  email text,
  linkedin text,
  source text,
  status text not null default '🟡 Cooling',
  urgency text not null default 'LOW',
  last_interaction date,
  follow_up_date date,
  notes text,
  what_they_did text,
  referred_by_id uuid references public.contacts(id) on delete set null,
  follow_up_draft text,
  follow_up_draft_tier int,
  follow_up_draft_kind text,
  is_school_alum boolean not null default false,
  affinity text[] not null default '{}',
  exa_enriched boolean not null default false,
  wants_to_schedule boolean not null default false,
  schedule_by date,
  schedule_note text,
  referral_status text not null default 'Not Asked',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_user_id_idx on public.contacts(user_id) where not archived;

alter table public.contacts enable row level security;
create policy "contacts: all own" on public.contacts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Calls ───────────────────────────────────────────────────────────────────
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  contact_id uuid references public.contacts(id) on delete set null,
  date date,
  duration int,
  summary text,
  key_insights text,
  my_commitments text,
  follow_up_draft text,
  granola_link text,
  full_transcript text,
  action_status text default 'Pending',
  created_at timestamptz not null default now()
);

create index calls_user_id_idx on public.calls(user_id);

alter table public.calls enable row level security;
create policy "calls: all own" on public.calls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Applications ────────────────────────────────────────────────────────────
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company text not null,
  role text,
  stage text not null default 'Wishlist',
  triage text not null default 'Needs Review',
  location text,
  source_repo text,
  applied_date date,
  closed_date date,
  last_activity date,
  jd_link text,
  resume_version text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications(user_id) where not archived;

alter table public.applications enable row level security;
create policy "applications: all own" on public.applications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Interactions ─────────────────────────────────────────────────────────────
create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  type text,
  direction text,
  date date,
  channel_ref text,
  summary text,
  body text,
  created_at timestamptz not null default now()
);

create index interactions_user_id_idx on public.interactions(user_id);

alter table public.interactions enable row level security;
create policy "interactions: all own" on public.interactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── BYOK API keys (server-only — no RLS policy means no client access at all) ─
-- Values are AES-256-GCM ciphertext (encrypted in app/api/_lib/crypto.js using a
-- server-only SECRET_ENCRYPTION_KEY env var), never plaintext, and this table
-- has zero RLS policies so PostgREST denies every request from the anon/authed
-- client key — only the service_role key (used exclusively inside Vercel
-- functions) bypasses RLS to read/write it.
create table public.user_api_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,              -- 'anthropic' | 'openai' | 'exa' | 'github'
  ciphertext text not null,
  last4 text,                          -- last 4 chars of the plaintext key, for display only
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.user_api_keys enable row level security;
-- Deliberately no policies — service_role only.

-- ── Google Calendar tokens (server-only, same reasoning as user_api_keys) ────
create table public.google_calendar_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token_ciphertext text not null,
  connected_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_tokens enable row level security;
-- Deliberately no policies — service_role only.

-- ── Generic per-user KV (small settings blobs; RLS'd, client can read/write
-- its own rows directly) ──────────────────────────────────────────────────────
create table public.user_settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_settings enable row level security;
create policy "user_settings: all own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at maintenance
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger contacts_set_updated_at before update on public.contacts
  for each row execute procedure public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
  for each row execute procedure public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger user_api_keys_set_updated_at before update on public.user_api_keys
  for each row execute procedure public.set_updated_at();
create trigger google_calendar_tokens_set_updated_at before update on public.google_calendar_tokens
  for each row execute procedure public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute procedure public.set_updated_at();
