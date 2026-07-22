-- 0005_indexes_hnsw.sql
-- Ensemble matching indexes: pgvector HNSW on every embedding column + generated
-- FTS tsvector columns with GIN, for the 3-stage hybrid retrieval (T3, F7).
--
-- OBJECTS ADDED:
--   profiles.fts, problems.fts              — generated tsvector (english) + GIN.
--   *_embedding_hnsw_idx (profiles/problems/data_request_listings)
--                                            — HNSW over halfvec(1024) columns.
--   immutable_array_to_string(text[],text)  — IMMUTABLE wrapper (see note below).
--
-- HNSW opclass: the columns are halfvec(1024), so the correct cosine opclass is
-- `halfvec_cosine_ops` (the halfvec variant of vector_cosine_ops named in the task).
-- Cosine distance operator is `<=>`. m/ef_construction left at pgvector defaults,
-- stated explicitly for the record.
--
-- pgvector 0.8 ITERATIVE INDEX SCANS (the reason no dedicated vector DB is needed,
-- T3/F7) are a *query-time* GUC, not an index property — the matching RPC should
-- `set hnsw.iterative_scan = relaxed_order` (or strict) so post-filtering by
-- role/city/institution can't overfilter the HNSW result set.
--
-- IMMUTABLE wrapper: to_tsvector over array columns needs array_to_string, but
-- array_to_string is only STABLE (its volatility follows the element output fn),
-- so Postgres rejects it inside a GENERATED ... STORED expression. Wrapping it in
-- an IMMUTABLE SQL function is the standard, safe fix for text[] (text output is
-- deterministic); the planner trusts the declared volatility.

set search_path = public, extensions;

create or replace function public.immutable_array_to_string(arr text[], sep text)
returns text
language sql
immutable
parallel safe
as $$ select array_to_string(arr, sep) $$;

-- Full-text search columns (generated, stored) + GIN -----------------------------
-- Profiles: headline + bio + research topics + skills (surface b: group->specialist).
alter table public.profiles
  add column fts tsvector generated always as (
    to_tsvector('english',
      coalesce(headline, '') || ' ' ||
      coalesce(bio, '') || ' ' ||
      public.immutable_array_to_string(research_topics, ' ') || ' ' ||
      public.immutable_array_to_string(skills, ' ')
    )
  ) stored;
create index profiles_fts_idx on public.profiles using gin (fts);

-- Problems: title + description + subfield + tags + required skills (surface a).
alter table public.problems
  add column fts tsvector generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(subfield, '') || ' ' ||
      public.immutable_array_to_string(tags, ' ') || ' ' ||
      public.immutable_array_to_string(required_skills, ' ')
    )
  ) stored;
create index problems_fts_idx on public.problems using gin (fts);

-- HNSW ANN indexes over the halfvec(1024) embedding columns (cosine) -------------
create index profiles_embedding_hnsw_idx on public.profiles
  using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64);

create index problems_embedding_hnsw_idx on public.problems
  using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64);

create index data_request_listings_embedding_hnsw_idx on public.data_request_listings
  using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64);
