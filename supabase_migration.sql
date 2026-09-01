-- ============================================================================
-- Culture Labs PCX — schema `onboarding` + login con Google (Supabase Auth)
--
-- Proyecto: qzcdwtdmcpcakebfkwkm (compartido con interno-talent,
-- interno-leads-talents, interno-pulse-studio). Por eso la app deja de vivir en
-- `public` y pasa a su propio schema, igual que `talent` y `leads_talents`.
--
-- Correr entero en Supabase → SQL Editor. Es idempotente: se puede repetir.
-- Las tablas se MUEVEN (alter table ... set schema), no se recrean: la data que
-- ya está cargada se conserva.
--
-- ⚠️ PASO MANUAL, ANTES DE CORRER ESTO:
--    Supabase → Settings → API → Exposed schemas → agregar `onboarding`.
--    Sin eso PostgREST devuelve 404 en todas las tablas.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1 · Schema
-- ────────────────────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create schema if not exists onboarding;

grant usage on schema onboarding to authenticated, service_role;


-- ────────────────────────────────────────────────────────────────────────────
-- 2 · Mover las tablas existentes de public → onboarding
--     (si ya están movidas, no hace nada)
-- ────────────────────────────────────────────────────────────────────────────

do $$
declare t text;
begin
  foreach t in array array['onboarding_profiles', 'quiz_attempts', 'ai_diagnostics'] loop
    if to_regclass('public.' || t) is not null and to_regclass('onboarding.' || t) is null then
      execute format('alter table public.%I set schema onboarding', t);
    end if;
  end loop;
end $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 3 · Tablas (create if not exists — solo aplica en un proyecto limpio;
--     en el actual ya existen y vienen del paso 2)
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists onboarding.onboarding_profiles (
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

create table if not exists onboarding.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  device_id uuid references onboarding.onboarding_profiles(device_id) on delete set null,
  name text,
  module_id text not null,
  attempt_number int,
  correct_count int,
  total int,
  all_correct boolean,
  answers jsonb,
  created_at timestamptz default now()
);

create table if not exists onboarding.ai_diagnostics (
  id uuid primary key default gen_random_uuid(),
  device_id uuid,
  score_n numeric,
  n_level text,
  profile_label text,
  tooltip_text text,
  responses jsonb,
  avatar_config jsonb,
  created_at timestamptz default now()
);


-- ────────────────────────────────────────────────────────────────────────────
-- 4 · Columnas de identidad (las trae el login con Google)
-- ────────────────────────────────────────────────────────────────────────────

alter table onboarding.onboarding_profiles add column if not exists user_id uuid;
alter table onboarding.onboarding_profiles add column if not exists email text;

alter table onboarding.quiz_attempts add column if not exists user_id uuid;
alter table onboarding.quiz_attempts add column if not exists email text;

alter table onboarding.ai_diagnostics add column if not exists user_id uuid;
alter table onboarding.ai_diagnostics add column if not exists email text;
alter table onboarding.ai_diagnostics add column if not exists person_name text;

-- ai_diagnostics.user_id venía guardando el NOMBRE tipeado a mano. Ahora user_id
-- es el uuid de auth.users y el nombre pasa a person_name.
do $$
begin
  if (select data_type from information_schema.columns
       where table_schema = 'onboarding'
         and table_name   = 'ai_diagnostics'
         and column_name  = 'user_id') <> 'uuid' then
    update onboarding.ai_diagnostics
       set person_name = user_id
     where person_name is null
       and user_id is not null
       and user_id !~ '^[0-9a-f-]{36}$';
    update onboarding.ai_diagnostics
       set user_id = null
     where user_id is not null
       and user_id !~ '^[0-9a-f-]{36}$';
    alter table onboarding.ai_diagnostics alter column user_id type uuid using user_id::uuid;
  end if;
end $$;

create index if not exists onboarding_profiles_email_idx      on onboarding.onboarding_profiles(email);
create index if not exists onboarding_profiles_user_id_idx    on onboarding.onboarding_profiles(user_id);
create index if not exists onboarding_profiles_updated_at_idx on onboarding.onboarding_profiles(updated_at);
create index if not exists quiz_attempts_device_id_idx        on onboarding.quiz_attempts(device_id);
create index if not exists quiz_attempts_email_idx            on onboarding.quiz_attempts(email);
create index if not exists ai_diagnostics_email_idx           on onboarding.ai_diagnostics(email);


-- ────────────────────────────────────────────────────────────────────────────
-- 5 · Helpers de identidad para las policies
-- ────────────────────────────────────────────────────────────────────────────

create or replace function onboarding.pcx_email() returns text
  language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- El dominio también lo fuerza Google (hd=picallex.com sobre la app "RRHH - Auth"),
-- pero el chequeo del front es cosmético: esto es lo que protege la data.
create or replace function onboarding.pcx_is_pcx() returns boolean
  language sql stable as $$ select onboarding.pcx_email() like '%@picallex.com' $$;

create or replace function onboarding.pcx_is_hr() returns boolean
  language sql stable as $$
    select onboarding.pcx_email() in ('georgina@picallex.com', 'zoe@picallex.com')
  $$;


-- ────────────────────────────────────────────────────────────────────────────
-- 6 · RLS — cada persona ve lo suyo, HR ve todo, anon no ve nada
-- ────────────────────────────────────────────────────────────────────────────

alter table onboarding.onboarding_profiles enable row level security;
alter table onboarding.quiz_attempts       enable row level security;
alter table onboarding.ai_diagnostics      enable row level security;

drop policy if exists "anon full access" on onboarding.onboarding_profiles;
drop policy if exists "anon full access" on onboarding.quiz_attempts;
drop policy if exists "anon full access" on onboarding.ai_diagnostics;

drop policy if exists "own or hr"   on onboarding.onboarding_profiles;
drop policy if exists "insert own"  on onboarding.onboarding_profiles;
drop policy if exists "update own"  on onboarding.onboarding_profiles;
drop policy if exists "own or hr"   on onboarding.quiz_attempts;
drop policy if exists "insert own"  on onboarding.quiz_attempts;
drop policy if exists "own or hr"   on onboarding.ai_diagnostics;
drop policy if exists "insert own"  on onboarding.ai_diagnostics;

-- Las filas viejas se crearon sin login: user_id y email quedaron en null. La
-- cláusula de "fila huérfana" deja que la persona la reclame la primera vez que
-- entra con Google desde ese mismo navegador (el device_id vive en localStorage).
-- Se puede sacar una vez que no queden filas con email null.
create policy "own or hr" on onboarding.onboarding_profiles
  for select to authenticated
  using (
    onboarding.pcx_is_hr()
    or user_id = auth.uid()
    or email = onboarding.pcx_email()
    or (user_id is null and email is null)
  );

create policy "insert own" on onboarding.onboarding_profiles
  for insert to authenticated
  with check (onboarding.pcx_is_pcx() and email = onboarding.pcx_email());

create policy "update own" on onboarding.onboarding_profiles
  for update to authenticated
  using (
    user_id = auth.uid()
    or email = onboarding.pcx_email()
    or (user_id is null and email is null)
  )
  with check (email = onboarding.pcx_email());

create policy "own or hr" on onboarding.quiz_attempts
  for select to authenticated
  using (onboarding.pcx_is_hr() or user_id = auth.uid() or email = onboarding.pcx_email());

create policy "insert own" on onboarding.quiz_attempts
  for insert to authenticated
  with check (onboarding.pcx_is_pcx() and email = onboarding.pcx_email());

create policy "own or hr" on onboarding.ai_diagnostics
  for select to authenticated
  using (onboarding.pcx_is_hr() or user_id = auth.uid() or email = onboarding.pcx_email());

create policy "insert own" on onboarding.ai_diagnostics
  for insert to authenticated
  with check (onboarding.pcx_is_pcx() and email = onboarding.pcx_email());


-- ────────────────────────────────────────────────────────────────────────────
-- 7 · Grants — el rol anon nunca toca estas tablas
-- ────────────────────────────────────────────────────────────────────────────

grant select, insert, update on onboarding.onboarding_profiles to authenticated;
grant select, insert         on onboarding.quiz_attempts        to authenticated;
grant select, insert         on onboarding.ai_diagnostics       to authenticated;

revoke all on onboarding.onboarding_profiles from anon;
revoke all on onboarding.quiz_attempts       from anon;
revoke all on onboarding.ai_diagnostics      from anon;
revoke usage on schema onboarding from anon;

alter default privileges in schema onboarding
  grant select, insert, update on tables to authenticated;
