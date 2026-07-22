-- 0001_extensions.sql
-- Ensemble — Postgres extensions (Supabase / eu-central-1).
--
-- Enables the four extensions the platform's matching + proximity engine needs
-- (T3, T7, F7). All are installed into the dedicated `extensions` schema per the
-- Supabase convention; that schema is on the search_path of the postgres /
-- authenticator / authenticated / anon / service_role roles, so the halfvec type,
-- pg_trgm operators and earthdistance functions resolve unqualified at runtime.
--
--   vector        — pgvector 0.8: halfvec(1024) columns + HNSW ANN index (F7).
--   pg_trgm       — trigram similarity, backs fuzzy name/topic lookups + GIN FTS aid.
--   cube          — n-dimensional cube type; REQUIRED dependency of earthdistance.
--   earthdistance — great-circle distance for the bounded proximity boost (T3 step 2).
--
-- `create extension if not exists` is idempotent; safe to re-run.

create schema if not exists extensions;

-- pgvector 0.8 — vector / halfvec types + HNSW / ivfflat index access methods.
create extension if not exists vector with schema extensions;

-- Trigram matching (fuzzy text) — used alongside FTS for candidate generation.
create extension if not exists pg_trgm with schema extensions;

-- cube MUST precede earthdistance (earthdistance is built on the cube type).
create extension if not exists cube with schema extensions;

-- Great-circle distance (earth_distance / ll_to_earth) for geo proximity decay.
create extension if not exists earthdistance with schema extensions;
