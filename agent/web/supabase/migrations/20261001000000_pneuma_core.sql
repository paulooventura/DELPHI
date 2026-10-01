-- Pneuma Mundi core schema.
-- Paste into Supabase → SQL Editor → Run (safe to re-run).
--
-- Access model
--   vaults            owner only (row-level security on auth.uid()). Holds
--                     ciphertext the server cannot read: birth data, held
--                     casts, and reading prefs are encrypted on the phone.
--   agon_enrollments  server only (service role). No anon/auth policies.
--   usage_sessions    server only. Anonymous beta telemetry.
--   usage_events      server only.
-- Admin access goes through the app's /api/admin routes, which check the
-- signed-in email against ADMIN_EMAILS and then use the service role.

create extension if not exists pgcrypto;

-- ── Vaults ──────────────────────────────────────────────────────────────────
create table if not exists public.vaults (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- AES-GCM data key wrapped by a key derived from the user's recovery key.
  wrapped_key text not null check (char_length(wrapped_key) between 40 and 200),
  -- AES-GCM ciphertext of the vault JSON (base64) + its 12-byte IV (base64).
  ciphertext  text not null check (char_length(ciphertext) <= 262144),
  iv          text not null check (char_length(iv) between 12 and 32),
  format      smallint not null default 1,
  revision    integer not null default 1,
  updated_at  timestamptz not null default now()
);

alter table public.vaults enable row level security;

drop policy if exists "vault owner reads" on public.vaults;
drop policy if exists "vault owner inserts" on public.vaults;
drop policy if exists "vault owner updates" on public.vaults;
drop policy if exists "vault owner deletes" on public.vaults;
create policy "vault owner reads" on public.vaults
  for select to authenticated using (auth.uid() = user_id);
create policy "vault owner inserts" on public.vaults
  for insert to authenticated with check (auth.uid() = user_id);
create policy "vault owner updates" on public.vaults
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "vault owner deletes" on public.vaults
  for delete to authenticated using (auth.uid() = user_id);

revoke all on public.vaults from anon;

-- ── Agon enrollments ────────────────────────────────────────────────────────
create table if not exists public.agon_enrollments (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_at   timestamptz,
  kind          text not null check (kind in ('venue', 'investor', 'promoter', 'role')),
  display_name  text not null check (char_length(display_name) <= 120),
  contact_email text not null check (char_length(contact_email) <= 254),
  phone         text not null default '' check (char_length(phone) <= 40),
  city          text not null check (char_length(city) <= 120),
  link          text not null default '' check (char_length(link) <= 240),
  headline      text not null default '' check (char_length(headline) <= 240),
  about         text not null default '' check (char_length(about) <= 800),
  details       text not null default '' check (char_length(details) <= 4000),
  source        text not null default 'agon' check (char_length(source) <= 60),
  notes         text not null default '' check (char_length(notes) <= 2000)
);
create index if not exists agon_enrollments_status_idx on public.agon_enrollments (status, created_at desc);
alter table public.agon_enrollments enable row level security;
revoke all on public.agon_enrollments from anon, authenticated;

-- ── Usage telemetry ─────────────────────────────────────────────────────────
create table if not exists public.usage_sessions (
  id                 bigint generated always as identity primary key,
  received_at        timestamptz not null default now(),
  session_id         text not null,
  visitor_id         text not null,
  segment            integer not null default 1,
  from_tag           text not null default '',
  visit_number       integer not null default 1,
  session_started_at timestamptz,
  segment_started_at timestamptz,
  segment_ended_at   timestamptz,
  active_s           integer not null default 0,
  taps               integer not null default 0,
  screens            jsonb not null default '{}'::jsonb,
  other_s            integer not null default 0,
  entry_path         text not null default '',
  exit_path          text not null default '',
  referrer           text not null default '',
  device             text not null default '',
  os                 text not null default '',
  browser            text not null default '',
  viewport           text not null default '',
  city               text not null default '',
  region             text not null default '',
  country            text not null default '',
  build              text not null default ''
);
create index if not exists usage_sessions_received_idx on public.usage_sessions (received_at desc);
create index if not exists usage_sessions_visitor_idx on public.usage_sessions (visitor_id);

create table if not exists public.usage_events (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  at          timestamptz,
  session_id  text not null,
  visitor_id  text not null,
  event       text not null,
  screen      text not null default '',
  detail      text not null default ''
);
create index if not exists usage_events_received_idx on public.usage_events (received_at desc);
create index if not exists usage_events_event_idx on public.usage_events (event);

alter table public.usage_sessions enable row level security;
alter table public.usage_events enable row level security;
revoke all on public.usage_sessions from anon, authenticated;
revoke all on public.usage_events from anon, authenticated;
