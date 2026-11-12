-- Agon enrollment v2 (T475, Paulo 2026-11-11): structured answers, automatic checks, certificate files.
-- Run after 20261001000000_pneuma_core.sql (SQL Editor → paste → Run). Safe to run twice.

alter table public.agon_enrollments
  add column if not exists data   jsonb not null default '{}'::jsonb,  -- departments, roles, gear, availability...
  add column if not exists checks jsonb not null default '{}'::jsonb,  -- email domain, phone, duplicate, files, link
  add column if not exists files  jsonb not null default '[]'::jsonb;  -- [{cert, path, type, size}]

-- Certificates: private bucket, no policies, so only the server (service role) reads or writes it.
-- /admin opens files through signed links that expire after 10 minutes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'agon-certs', 'agon-certs', false, 4194304,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;
