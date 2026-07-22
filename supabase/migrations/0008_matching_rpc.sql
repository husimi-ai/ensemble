-- 0008_matching_rpc.sql
-- Ensemble matching engine (T3, F7): the 3-stage hybrid — SQL WHERE filter ->
-- vector (HNSW, halfvec) + FTS (tsvector) merged by Reciprocal Rank Fusion ->
-- bounded multiplicative proximity boost — as Postgres functions reused across
-- three surfaces: person->problem (feed), group->specialist, data->provider.
--
-- INVARIANTS (spec C8 / F7): proximity is a BOUNDED MULTIPLICATIVE BOOST, never a
-- filter (score = fit * (1 + lambda*proximity), lambda 0.15 — it only re-orders
-- near-ties); the cheap WHERE filter is NEVER on proximity; no LLM in the hot path
-- (the "why this match" string is the API's job).
--
-- OBJECTS: proximity_tier / network_closeness (the two boost terms); feed_problems
-- (materialized published-problem corpus + each submitter's proximity anchor,
-- refreshed via refresh_feed()); match_problems_for_user (surface a);
-- match_specialists_for_group + match_providers_for_request (b / c) over the shared
-- _match_specialists core. SECURITY DEFINER so matching sees the full corpus; the
-- functions return only ids + scores (no PII) — the TS layer hydrates under RLS.
--
-- SCALE NOTE: the arms read a multiply-referenced `elig` CTE (DRY), which Postgres
-- materializes — fine at people-scale. At ~100k+ rows, inline the filter into the
-- vector arm over the base relation so the HNSW index + iterative scan accelerate
-- the ANN top-K instead of a seq scan + sort.

set search_path = public, extensions;

-- Tunable constants are inlined (Postgres has no compile-time consts): lambda=0.15
-- (boost weight), beta=0.3 (network term), RRF k=60 (vector/fts) / 1000 (recency
-- fallback, negligible when the real arms fire), geo scale 300 km, proximity cap 1.3.

-- proximity_tier — max over the discrete tiers + a great-circle decay, all in ----
-- [0,1]; the decay is capped at the city tier (0.5) so the ordering never inverts.
create or replace function public.proximity_tier(
  c_facility uuid, c_institution uuid, c_city text,
  c_lat double precision, c_long double precision,
  a_facility uuid, a_institution uuid, a_city text,
  a_lat double precision, a_long double precision
) returns double precision
language sql immutable parallel safe
as $$
  select greatest(
    case when c_facility is not null and c_facility = a_facility then 1.0 else 0 end,
    case when c_institution is not null and c_institution = a_institution then 0.8 else 0 end,
    case when c_city is not null and a_city is not null
              and lower(c_city) = lower(a_city) then 0.5 else 0 end,
    case when c_lat is not null and c_long is not null
              and a_lat is not null and a_long is not null
         then 0.5 * exp( - earth_distance(ll_to_earth(c_lat, c_long),
                                          ll_to_earth(a_lat, a_long)) / 300000.0 )
         else 0 end
  );
$$;

-- network_closeness — the precomputed undirected shared-rooms edge (user_a<user_b),
-- squashed to [0,1) so an arbitrarily heavy edge can't dominate the boost.
create or replace function public.network_closeness(a uuid, b uuid)
returns double precision
language sql stable parallel safe
as $$
  select coalesce((
    select w.weight / (1 + w.weight)
    from public.connections w
    where w.user_a = least(a, b) and w.user_b = greatest(a, b)
  ), 0);
$$;

-- feed_problems — the person->problem corpus (surface a). Denormalizes each
-- published problem with its submitter's proximity anchor so the feed RPC never
-- re-joins live; embedding + fts carry over for the hybrid arms. WITH DATA on
-- create; refresh_feed() re-materializes it periodically.
drop materialized view if exists public.feed_problems;
create materialized view public.feed_problems as
  select
    p.id, p.title, p.description, p.subfield, p.tags,
    p.required_roles, p.required_skills, p.submitted_by, p.created_at,
    p.embedding, p.fts,
    sub.user_id        as sub_user_id,
    sub.facility_id    as sub_facility,
    sub.institution_id as sub_institution,
    coalesce(sub.city, su.city) as sub_city,
    sub.lat            as sub_lat,
    sub.long           as sub_long
  from public.problems p
  left join public.users su    on su.id = p.submitted_by
  left join public.profiles sub on sub.user_id = p.submitted_by
  where p.status = 'published';

-- Unique id index enables REFRESH ... CONCURRENTLY; HNSW + GIN make the MV a
-- self-contained fast matching surface (same opclasses as 0005).
create unique index feed_problems_id_uidx on public.feed_problems (id);
create index feed_problems_embedding_hnsw_idx on public.feed_problems
  using hnsw (embedding halfvec_cosine_ops) with (m = 16, ef_construction = 64);
create index feed_problems_fts_idx on public.feed_problems using gin (fts);

create or replace function public.refresh_feed() returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  refresh materialized view concurrently public.feed_problems;
end;
$$;

-- surface a: person -> problem (the feed) ---------------------------------------
-- Query = the user's own profile embedding + text (override via p_query_*). The
-- cheap filter drops the user's own submissions and anything already applied to
-- (never proximity). Candidate anchor = the problem submitter's profile.
create or replace function public.match_problems_for_user(
  p_user_id uuid,
  p_query_embedding text default null,
  p_query_text text default null,
  p_limit int default 50,
  p_pool int default 200,
  p_subfield text default null
) returns table(problem_id uuid, fit double precision,
                proximity double precision, score double precision, doc text)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  qv halfvec(1024); tq tsquery; qtext text;
  a_fac uuid; a_inst uuid; a_city text; a_lat double precision; a_long double precision;
begin
  set local hnsw.iterative_scan = 'relaxed_order';

  select
    coalesce(case when nullif(p_query_embedding, '') is null then null
                  else p_query_embedding::halfvec(1024) end, pr.embedding),
    coalesce(nullif(p_query_text, ''),
      concat_ws(' ', pr.headline,
        immutable_array_to_string(pr.research_topics, ' '),
        immutable_array_to_string(pr.skills, ' '))),
    pr.facility_id, pr.institution_id, coalesce(pr.city, u.city), pr.lat, pr.long
    into qv, qtext, a_fac, a_inst, a_city, a_lat, a_long
    from public.users u
    left join public.profiles pr on pr.user_id = u.id
    where u.id = p_user_id;
  tq := case when coalesce(qtext, '') = '' then null
             else plainto_tsquery('english', qtext) end;

  return query
  with elig as (  -- cheap WHERE filter (never proximity)
    select f.id, f.embedding, f.fts, f.created_at, f.sub_user_id,
           f.sub_facility, f.sub_institution, f.sub_city, f.sub_lat, f.sub_long
    from public.feed_problems f
    where (f.submitted_by is distinct from p_user_id)
      and (p_subfield is null or f.subfield = p_subfield)
      and not exists (select 1 from public.applications a
                      where a.problem_id = f.id and a.user_id = p_user_id)
  ),
  vec as (  -- ANN arm (halfvec cosine)
    select id, row_number() over (order by dist) as rnk from (
      select e.id, (e.embedding <=> qv) as dist
      from elig e where qv is not null and e.embedding is not null
      order by e.embedding <=> qv limit p_pool
    ) s
  ),
  fts as (  -- lexical arm
    select id, row_number() over (order by rank desc) as rnk from (
      select e.id, ts_rank(e.fts, tq) as rank
      from elig e where tq is not null and e.fts @@ tq
      order by ts_rank(e.fts, tq) desc limit p_pool
    ) s
  ),
  rec as (  -- recency fallback (tiny RRF weight; guarantees a non-empty feed)
    select id, row_number() over (order by created_at desc) as rnk from (
      select e.id, e.created_at from elig e order by e.created_at desc limit p_pool
    ) s
  ),
  fused as (  -- Reciprocal Rank Fusion
    select c.id,
      coalesce(1.0/(60 + v.rnk), 0) + coalesce(1.0/(60 + f.rnk), 0)
        + coalesce(1.0/(1000 + r.rnk), 0) as fit_raw
    from (select id from vec union select id from fts union select id from rec) c
    left join vec v on v.id = c.id
    left join fts f on f.id = c.id
    left join rec r on r.id = c.id
  ),
  scored as (
    select fu.id,
      (fu.fit_raw / nullif(max(fu.fit_raw) over (), 0))::double precision as fit,
      least(
        public.proximity_tier(e.sub_facility, e.sub_institution, e.sub_city,
                              e.sub_lat, e.sub_long,
                              a_fac, a_inst, a_city, a_lat, a_long)
        + 0.3 * public.network_closeness(p_user_id, e.sub_user_id), 1.3) as proximity
    from fused fu join elig e on e.id = fu.id
  )
  select s.id, s.fit, s.proximity,
         (s.fit * (1 + 0.15 * s.proximity))::double precision as score,
         concat_ws(' ', m.title, m.description) as doc
  from scored s
  join public.feed_problems m on m.id = s.id
  order by score desc
  limit p_limit;
end;
$$;

-- surfaces b + c core: match data-controlling / role-matching specialists over ---
-- `profiles`, anchored to a group's members. Query defaults to the group's
-- problem (override via p_query_*). p_require_data gates to resource holders
-- (surface c); p_exclude_listing drops providers who already applied.
create or replace function public._match_specialists(
  p_group_id uuid,
  p_query_embedding text,
  p_query_text text,
  p_role text,
  p_require_data boolean,
  p_exclude_listing uuid,
  p_limit int,
  p_pool int
) returns table(profile_id uuid, user_id uuid, fit double precision,
                proximity double precision, score double precision, doc text)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare qv halfvec(1024); tq tsquery; qtext text;
begin
  set local hnsw.iterative_scan = 'relaxed_order';

  select
    coalesce(case when nullif(p_query_embedding, '') is null then null
                  else p_query_embedding::halfvec(1024) end, pr.embedding),
    coalesce(nullif(p_query_text, ''),
      concat_ws(' ', pr.title, pr.description,
        immutable_array_to_string(pr.required_skills, ' '),
        immutable_array_to_string(pr.tags, ' ')))
    into qv, qtext
    from public.groups g
    join public.problems pr on pr.id = g.problem_id
    where g.id = p_group_id;
  tq := case when coalesce(qtext, '') = '' then null
             else plainto_tsquery('english', qtext) end;

  return query
  with gm as (  -- the anchoring group's members' proximity anchors
    select p.user_id, p.facility_id, p.institution_id, p.city, p.lat, p.long
    from public.memberships m
    join public.profiles p on p.user_id = m.user_id
    where m.group_id = p_group_id
  ),
  elig as (  -- cheap WHERE filter (never proximity)
    select p.id, p.user_id, p.embedding, p.fts, p.created_at,
           p.facility_id, p.institution_id, p.city, p.lat, p.long
    from public.profiles p
    where p.user_id not in (select user_id from gm)
      and (p_role is null or p.role = p_role::public.profile_role)
      and (not p_require_data
           or jsonb_array_length(coalesce(p.data_resources, '[]'::jsonb)) > 0)
      and (p_exclude_listing is null
           or not exists (select 1 from public.provider_applications pa
                          where pa.listing_id = p_exclude_listing
                            and pa.user_id = p.user_id))
  ),
  vec as (
    select id, row_number() over (order by dist) as rnk from (
      select e.id, (e.embedding <=> qv) as dist
      from elig e where qv is not null and e.embedding is not null
      order by e.embedding <=> qv limit p_pool
    ) s
  ),
  fts as (
    select id, row_number() over (order by rank desc) as rnk from (
      select e.id, ts_rank(e.fts, tq) as rank
      from elig e where tq is not null and e.fts @@ tq
      order by ts_rank(e.fts, tq) desc limit p_pool
    ) s
  ),
  rec as (
    select id, row_number() over (order by created_at desc) as rnk from (
      select e.id, e.created_at from elig e order by e.created_at desc limit p_pool
    ) s
  ),
  fused as (
    select c.id,
      coalesce(1.0/(60 + v.rnk), 0) + coalesce(1.0/(60 + f.rnk), 0)
        + coalesce(1.0/(1000 + r.rnk), 0) as fit_raw
    from (select id from vec union select id from fts union select id from rec) c
    left join vec v on v.id = c.id
    left join fts f on f.id = c.id
    left join rec r on r.id = c.id
  ),
  scored as (
    select fu.id, e.user_id,
      (fu.fit_raw / nullif(max(fu.fit_raw) over (), 0))::double precision as fit,
      least(
        coalesce((select max(public.proximity_tier(
             e.facility_id, e.institution_id, e.city, e.lat, e.long,
             gm.facility_id, gm.institution_id, gm.city, gm.lat, gm.long)) from gm), 0)
        + 0.3 * coalesce((select max(public.network_closeness(e.user_id, gm.user_id))
                          from gm), 0), 1.3) as proximity
    from fused fu join elig e on e.id = fu.id
  )
  select s.id, s.user_id, s.fit, s.proximity,
         (s.fit * (1 + 0.15 * s.proximity))::double precision as score
  from scored s
  order by score desc
  limit p_limit;
end;
$$;

-- surface b: group -> specialist (widen a thin pool / recruit a missing role) ----
create or replace function public.match_specialists_for_group(
  p_group_id uuid,
  p_query_embedding text default null,
  p_query_text text default null,
  p_role text default null,
  p_limit int default 50,
  p_pool int default 200
) returns table(profile_id uuid, user_id uuid, fit double precision,
                proximity double precision, score double precision)
language sql stable security definer set search_path = public, extensions
as $$
  select * from public._match_specialists(
    p_group_id, p_query_embedding, p_query_text, p_role, false, null, p_limit, p_pool);
$$;

-- surface c: data-request -> provider (rank likely data holders for a listing) ---
create or replace function public.match_providers_for_request(
  p_listing_id uuid,
  p_query_embedding text default null,
  p_query_text text default null,
  p_limit int default 50,
  p_pool int default 200
) returns table(profile_id uuid, user_id uuid, fit double precision,
                proximity double precision, score double precision)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare v_group uuid; v_emb text; v_text text;
begin
  select rr.group_id,
         coalesce(nullif(p_query_embedding, ''), dl.embedding::text),
         coalesce(nullif(p_query_text, ''),
           concat_ws(' ', dl.title, dl.description,
             immutable_array_to_string(dl.tags, ' ')))
    into v_group, v_emb, v_text
    from public.data_request_listings dl
    join public.resource_requests rr on rr.id = dl.resource_request_id
    where dl.id = p_listing_id;

  return query select * from public._match_specialists(
    v_group, v_emb, v_text, null, true, p_listing_id, p_limit, p_pool);
end;
$$;

-- Grants: matching runs for signed-in callers + the server (service_role);
-- refresh is server/worker-only. _match_specialists stays internal (called only
-- by the SECURITY DEFINER wrappers, which execute as the function owner).
grant select on public.feed_problems to authenticated, service_role;
grant execute on function
  public.match_problems_for_user(uuid, text, text, int, int, text)
  to authenticated, service_role;
grant execute on function
  public.match_specialists_for_group(uuid, text, text, text, int, int)
  to authenticated, service_role;
grant execute on function
  public.match_providers_for_request(uuid, text, text, int, int)
  to authenticated, service_role;
grant execute on function public.refresh_feed() to service_role;
