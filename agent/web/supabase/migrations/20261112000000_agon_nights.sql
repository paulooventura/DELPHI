-- T497: Agon nights, no money yet (Homebase staging/delphi/AGON-MONEY.md §4, §11).
-- Shapes only. Nothing here moves money; Stripe ids stay empty until T499 (after the lawyer and Paulo's decisions).
-- Row level security on with no policies: only the server (service role) reads or writes these.

create table if not exists public.agon_nights (
  id uuid primary key default gen_random_uuid(),
  owner_email text not null,
  -- The night's steward (PM): records who showed up and reads incident disputes first.
  steward_email text,
  title text not null,
  night_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'budgeted', 'funded', 'live', 'ended', 'paid', 'closed', 'cancelled')),
  shares jsonb not null default '{}'::jsonb,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agon_bookings (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.agon_nights (id) on delete cascade,
  kind text not null check (kind in ('crew', 'venue', 'cost')),
  payee text not null,
  role text,
  agreed_cents integer not null check (agreed_cents >= 0),
  hours numeric,
  approved_overtime_cents integer not null default 0 check (approved_overtime_cents >= 0),
  accepted_at timestamptz,
  -- Dropped out before the night: not paid; the owner books a replacement.
  withdrawn_at timestamptz,
  -- Set by the steward only: false = no-show (not paid).
  attended boolean,
  -- Pre-event work (promo, marketing, design): paid for what was delivered even if the night is cancelled.
  pre_event boolean not null default false,
  delivered_cents integer check (delivered_cents >= 0),
  incident_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.agon_fundings (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.agon_nights (id) on delete cascade,
  funder text not null,
  cents integer not null check (cents > 0),
  backer boolean not null default false,
  -- Above $1,000 a funding must come by bank transfer (lib/agon/nights.ts CARD_LIMIT_CENTS).
  method text not null default 'card' check (method in ('card', 'bank')),
  stripe_payment_id text,
  cleared_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.agon_ledger (
  id uuid primary key default gen_random_uuid(),
  night_id uuid not null references public.agon_nights (id) on delete cascade,
  step smallint not null check (step between 1 and 6),
  label text not null,
  payee text not null,
  cents integer not null,
  -- One key per transfer so running Pay twice never pays twice.
  idempotency_key text not null unique,
  stripe_object_id text,
  created_at timestamptz not null default now()
);

alter table public.agon_fundings drop constraint if exists agon_fundings_card_limit;
alter table public.agon_fundings add constraint agon_fundings_card_limit check (method = 'bank' or cents <= 100000);

create index if not exists agon_bookings_night on public.agon_bookings (night_id);
create index if not exists agon_fundings_night on public.agon_fundings (night_id);
create index if not exists agon_ledger_night on public.agon_ledger (night_id);

alter table public.agon_nights enable row level security;
alter table public.agon_bookings enable row level security;
alter table public.agon_fundings enable row level security;
alter table public.agon_ledger enable row level security;
