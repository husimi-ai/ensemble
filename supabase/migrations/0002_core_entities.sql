-- 0002_core_entities.sql
-- Ensemble core entities: institutions, facilities, users, profiles,
-- profile_sources, problems (domain model — spec "Domain model", T1/T3/F5/F7).
--
-- TABLES & COLUMNS (snake_case; TS types in task 002 mirror these names):
--   institutions(id, name, ror_id, city, country, lat, long, created_at)
--     — proximity-tier lookup (T3 step 2); referenced by profiles.institution_id.
--   facilities(id, institution_id, name, lat, long, created_at)
--     — finest proximity tier ("same facility 1.0"); referenced by profiles.facility_id.
--   users(id -> auth.users, email, name, profession, city, is_operator,
--         created_at, updated_at)
--     — account/auth mirror; is_operator = founder/operator review-queue access (RLS).
--   profiles(id, user_id 1:1, headline, bio, research_topics[], skills[],
--         publications jsonb, data_resources jsonb, orcid, openalex_id,
--         institution_id, facility_id, city, country, lat, long,
--         role profile_role, role_confidence, confirmed,
--         provenance jsonb, confidence jsonb, embedding halfvec(1024),
--         created_at, updated_at)  — fts tsvector + HNSW index added in 0005.
--   profile_sources(id, profile_id, user_id, kind, source_url, external_id,
--         raw jsonb, status, fetched_at, created_at)  — provenance / re-ingest (F5).
--   problems(id, title, description, subfield, tags[], required_roles[],
--         required_skills[], origin, submitted_by, status,
--         embedding halfvec(1024), created_at, updated_at)  — fts + HNSW in 0005.
--
-- Notes: institutions/facilities are not named as core entities in the spec but
-- are implied by profiles.institution_id / facility_id and the T3 proximity tiers;
-- added here as minimal lookup tables (task stop-condition: sensible inferred cols).

set search_path = public, extensions;

-- Shared updated_at trigger: stamps updated_at = now() on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums -------------------------------------------------------------------------
-- Assigned role (problem-identifier / builder / researcher); reused by applications.
create type public.profile_role as enum ('problem_identifier', 'builder', 'researcher');
-- Which scholarly source / upload produced a ProfileSource row (F5, T1).
create type public.profile_source_kind as enum (
  'openalex', 'orcid', 'europepmc', 'crossref', 'cv', 'linkedin_oidc',
  'linkedin_export', 'url');
create type public.profile_source_status as enum ('pending', 'fetched', 'failed');
-- Problem lifecycle + provenance (draft -> review -> published).
create type public.problem_origin as enum ('founder_seeded', 'user_submitted');
create type public.problem_status as enum ('draft', 'review', 'published');

-- institutions ------------------------------------------------------------------
create table public.institutions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  ror_id     text,                       -- Research Organization Registry id
  city       text,
  country    text,
  lat        double precision,
  long       double precision,
  created_at timestamptz not null default now()
);

-- facilities --------------------------------------------------------------------
create table public.facilities (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete set null,
  name           text not null,
  lat            double precision,
  long           double precision,
  created_at     timestamptz not null default now()
);
create index facilities_institution_id_idx on public.facilities (institution_id);

-- users (app mirror of auth.users) ---------------------------------------------
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  name        text,
  profession  text,
  city        text,
  is_operator boolean not null default false,  -- founder/operator (review queues)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- profiles (1:1 users) — the investigated, provenance-tagged picture ------------
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users (id) on delete cascade,
  headline        text,
  bio             text,
  research_topics text[] not null default '{}',
  skills          text[] not null default '{}',
  publications    jsonb  not null default '[]'::jsonb,
  data_resources  jsonb  not null default '[]'::jsonb,  -- data/resources they control
  orcid           text,
  openalex_id     text,
  institution_id  uuid references public.institutions (id) on delete set null,
  facility_id     uuid references public.facilities (id) on delete set null,
  city            text,
  country         text,
  lat             double precision,
  long            double precision,
  role            public.profile_role,
  role_confidence double precision,                     -- 0..1 confidence in role
  confirmed       boolean not null default false,       -- show-and-correct (GDPR)
  provenance      jsonb not null default '{}'::jsonb,   -- per-field: which source
  confidence      jsonb not null default '{}'::jsonb,   -- per-field: 0..1 confidence
  embedding       halfvec(1024),                        -- Voyage-3.5 (F7); HNSW in 0005
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index profiles_institution_id_idx on public.profiles (institution_id);
create index profiles_facility_id_idx on public.profiles (facility_id);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- profile_sources — one row per fetched link/CV, for provenance + re-ingest ------
create table public.profile_sources (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  user_id     uuid not null references public.users (id) on delete cascade,  -- RLS
  kind        public.profile_source_kind not null,
  source_url  text,
  external_id text,                                       -- ORCID iD, OpenAlex id...
  raw         jsonb,                                       -- exactly what was fetched
  status      public.profile_source_status not null default 'pending',
  fetched_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index profile_sources_profile_id_idx on public.profile_sources (profile_id);
create index profile_sources_user_id_idx on public.profile_sources (user_id);

-- problems — the listings ranked in the person->problem feed (T3 surface a) -----
create table public.problems (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  subfield       text,                                    -- medical subfield
  tags           text[] not null default '{}',
  required_roles text[] not null default '{}',
  required_skills text[] not null default '{}',
  origin         public.problem_origin not null default 'user_submitted',
  submitted_by   uuid references public.users (id) on delete set null,
  status         public.problem_status not null default 'draft',
  embedding      halfvec(1024),                            -- HNSW in 0005
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index problems_status_idx on public.problems (status);
create index problems_submitted_by_idx on public.problems (submitted_by);
create index problems_tags_idx on public.problems using gin (tags);
create trigger problems_set_updated_at
  before update on public.problems
  for each row execute function public.set_updated_at();
