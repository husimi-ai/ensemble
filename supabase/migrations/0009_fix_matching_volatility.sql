-- Fix: the 0008 matching functions were declared STABLE but execute
-- `set local hnsw.iterative_scan = 'relaxed_order'`. PostgreSQL rejects that at
-- runtime with:
--   0A000: SET is not allowed in a non-volatile function
-- which made every matching surface (feed, specialist finder, provider matching)
-- fail. Only reproducible against a live Postgres, so it slipped static review.
--
-- Marking them VOLATILE is the minimal correct fix: it permits the per-call SET
-- and only costs planner caching (these are per-request lookups, not inlined
-- predicates). `match_specialists_for_group` is promoted too so a stable wrapper
-- never calls a volatile body.

alter function public.match_problems_for_user(uuid, text, text, int, int, text) volatile;

alter function public._match_specialists(uuid, text, text, text, boolean, uuid, int, int) volatile;

alter function public.match_specialists_for_group(uuid, text, text, text, int, int) volatile;

alter function public.match_providers_for_request(uuid, text, text, int, int) volatile;
