-- Culture Labs PCX — persistencia de progreso de onboarding
-- Correr este script completo en Supabase → SQL Editor.
-- Identidad: por ahora NO hay login (se agrega más adelante). Cada dispositivo/
-- navegador genera un UUID propio (device_id) la primera vez que entra, guardado
-- en localStorage, y ese id es la clave con la que se guarda y actualiza su fila.

create extension if not exists pgcrypto;

-- 1) Snapshot vivo del progreso de cada persona (se actualiza a cada rato,
--    reemplaza lo que hoy vive solo en localStorage).
create table if not exists public.onboarding_profiles (
  device_id uuid primary key,
  name text,
  area text,
  country text,
  start_date date,
  current_module text,
  completed jsonb default '{}'::jsonb,
  quiz_passed jsonb default '{}'::jsonb,
  quiz_selections jsonb default '{}'::jsonb,
  exam_attempts jsonb default '{}'::jsonb,
  dia1_tasks jsonb default '{}'::jsonb,
  avatar_config jsonb default '{}'::jsonb,
  music_on boolean default false,
  started_at timestamptz,
  celebrated boolean default false,
  progress_pct int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Log append-only de cada intento de examen por módulo (no se pisa,
--    sirve para ver el historial completo de intentos).
create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references public.onboarding_profiles(device_id) on delete set null,
  name text,
  module_id text not null,
  attempt_number int,
  correct_count int,
  total int,
  all_correct boolean,
  answers jsonb,
  created_at timestamptz default now()
);

-- 3) Vincular ai_diagnostics (ya existente) con el mismo device_id, para poder
--    cruzar el diagnóstico de IA con el resto del progreso de la misma persona.
alter table public.ai_diagnostics add column if not exists device_id uuid;

-- RLS: sin login todavía, así que se permite acceso completo con la anon key
-- (mismo nivel de confianza que ya tenía ai_diagnostics). Cuando se agregue el
-- login con Google, estas policies se reemplazan por unas que validen auth.uid()
-- y el dominio @picallex.com.
alter table public.onboarding_profiles enable row level security;
alter table public.quiz_attempts enable row level security;

drop policy if exists "anon full access" on public.onboarding_profiles;
create policy "anon full access" on public.onboarding_profiles
  for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.quiz_attempts;
create policy "anon full access" on public.quiz_attempts
  for all to anon using (true) with check (true);

create index if not exists quiz_attempts_device_id_idx on public.quiz_attempts(device_id);
create index if not exists onboarding_profiles_updated_at_idx on public.onboarding_profiles(updated_at);
