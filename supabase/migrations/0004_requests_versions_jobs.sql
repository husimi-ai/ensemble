-- 0004_requests_versions_jobs.sql
-- Ensemble operator / endgame / AI-job cluster: resource_requests,
-- data_request_listings, provider_applications, versions, research_jobs,
-- connections (spec "Domain model", T4/T5/T6/F7; Build Plan P4/P5).
--
-- TABLES & COLUMNS (snake_case):
--   resource_requests(id, group_id, kind resource_kind, description, status,
--         requested_by, created_at, updated_at)  — compute|data ask from a Group;
--         routes to the operator console (requested -> fulfilled -> published).
--   data_request_listings(id, resource_request_id, title, description, tags[],
--         embedding halfvec(1024), status, created_at, updated_at)  — a published
--         data need ranked to likely providers (T3 surface c); HNSW in 0005.
--   provider_applications(id, listing_id, user_id, message, status,
--         created_at, updated_at)  — a provider "applies to help"; on accept the
--         provider becomes a Membership (C15).
--   versions(id, group_id, version_no, paper_ref, repo_ref, status, feedback,
--         created_at, updated_at)  — a Group's submitted paper+codebase (C13/C14).
--   research_jobs(id, room_id, requested_by, prompt, status, progress jsonb,
--         cost_usd, result jsonb, result_message_id, pgboss_job_id,
--         created_at, updated_at)  — launch_research background job (T5); worker
--         writes progress/cost, posts a cited synthesis back as a message.
--   connections(user_a, user_b, weight, created_at, updated_at)  — precomputed
--         shared-rooms closeness graph feeding the T3 network-closeness term.

set search_path = public, extensions;

-- Enums -------------------------------------------------------------------------
create type public.resource_kind as enum ('compute', 'data');
create type public.resource_request_status as enum (
  'requested', 'fulfilled', 'published');
create type public.data_listing_status as enum ('open', 'matched', 'closed');
create type public.provider_application_status as enum (
  'pending', 'accepted', 'rejected');
create type public.version_status as enum (
  'submitted', 'feedback', 'taken_over', 'published');
create type public.research_job_status as enum (
  'queued', 'running', 'done', 'failed', 'cancelled');

-- resource_requests — compute|data ask from a Group -> operator queue -----------
create table public.resource_requests (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete cascade,
  kind         public.resource_kind not null,
  description  text,
  status       public.resource_request_status not null default 'requested',
  requested_by uuid references public.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index resource_requests_group_id_idx on public.resource_requests (group_id);
create index resource_requests_status_idx on public.resource_requests (status);
create trigger resource_requests_set_updated_at
  before update on public.resource_requests
  for each row execute function public.set_updated_at();

-- data_request_listings — a published data need matched to providers (surface c) -
create table public.data_request_listings (
  id                  uuid primary key default gen_random_uuid(),
  resource_request_id uuid references public.resource_requests (id) on delete cascade,
  title               text not null,
  description         text,
  tags                text[] not null default '{}',
  embedding           halfvec(1024),                 -- query vector (T3c); HNSW in 0005
  status              public.data_listing_status not null default 'open',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index data_request_listings_status_idx on public.data_request_listings (status);
create index data_request_listings_tags_idx
  on public.data_request_listings using gin (tags);
create trigger data_request_listings_set_updated_at
  before update on public.data_request_listings
  for each row execute function public.set_updated_at();

-- provider_applications — a provider applies to help with a data listing (C15) ---
create table public.provider_applications (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.data_request_listings (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  message    text,
  status     public.provider_application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, user_id)
);
create index provider_applications_listing_id_idx
  on public.provider_applications (listing_id);
create index provider_applications_user_id_idx
  on public.provider_applications (user_id);
create trigger provider_applications_set_updated_at
  before update on public.provider_applications
  for each row execute function public.set_updated_at();

-- versions — a Group's submitted paper + codebase, iterative (C13/C14) ----------
create table public.versions (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  version_no integer not null default 1,
  paper_ref  text,                                   -- storage path / DOI
  repo_ref   text,                                   -- repo url / storage path
  status     public.version_status not null default 'submitted',
  feedback   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, version_no)
);
create index versions_group_id_idx on public.versions (group_id);
create index versions_status_idx on public.versions (status);
create trigger versions_set_updated_at
  before update on public.versions
  for each row execute function public.set_updated_at();

-- research_jobs — launch_research background job state (T5, pg-boss worker) ------
create table public.research_jobs (
  id                uuid primary key default gen_random_uuid(),
  room_id           uuid not null references public.groups (id) on delete cascade,
  requested_by      uuid references public.users (id) on delete set null,
  prompt            text,
  status            public.research_job_status not null default 'queued',
  progress          jsonb not null default '{}'::jsonb,      -- streamed progress
  cost_usd          numeric(12, 6) not null default 0,       -- maxBudgetUsd accounting
  result            jsonb,                                    -- cited synthesis
  result_message_id uuid references public.messages (id) on delete set null,
  pgboss_job_id     uuid,                                     -- link to pg-boss job
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index research_jobs_room_id_idx on public.research_jobs (room_id);
create index research_jobs_status_idx on public.research_jobs (status);
create trigger research_jobs_set_updated_at
  before update on public.research_jobs
  for each row execute function public.set_updated_at();

-- connections — precomputed shared-rooms closeness graph (T3 network term) ------
-- Canonical ordering (user_a < user_b) keeps the undirected edge unique.
create table public.connections (
  user_a     uuid not null references public.users (id) on delete cascade,
  user_b     uuid not null references public.users (id) on delete cascade,
  weight     double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint connections_ordered check (user_a < user_b)
);
create index connections_user_b_idx on public.connections (user_b);
create trigger connections_set_updated_at
  before update on public.connections
  for each row execute function public.set_updated_at();
