-- 0006_rls_policies.sql
-- Row Level Security for every Ensemble table + the two authorization helpers.
-- Model (task): users read/write own rows; room members read/write that room's
-- messages (membership check); operator (founder) reads the review queues. The
-- service_role key bypasses RLS entirely (BYPASSRLS) and is server-only, so
-- worker/assembly/AI inserts (ai/system messages, proposed memberships, job
-- progress, precomputed connections) need no policy here.
--
-- Helpers are SECURITY DEFINER so their internal reads bypass RLS — this both
-- lets them see the rows they must check and prevents policy recursion (e.g. a
-- memberships policy that itself calls is_member_of over memberships).

set search_path = public, extensions;

-- Authorization helpers ---------------------------------------------------------
create or replace function public.is_operator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select u.is_operator from public.users u where u.id = auth.uid()), false);
$$;

create or replace function public.is_member_of(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  );
$$;

grant execute on function public.is_operator() to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;

-- Enable RLS on every table -----------------------------------------------------
alter table public.institutions          enable row level security;
alter table public.facilities            enable row level security;
alter table public.users                 enable row level security;
alter table public.profiles              enable row level security;
alter table public.profile_sources       enable row level security;
alter table public.problems              enable row level security;
alter table public.applications          enable row level security;
alter table public.groups                enable row level security;
alter table public.memberships           enable row level security;
alter table public.messages              enable row level security;
alter table public.resource_requests     enable row level security;
alter table public.data_request_listings enable row level security;
alter table public.provider_applications enable row level security;
alter table public.versions              enable row level security;
alter table public.research_jobs         enable row level security;
alter table public.connections           enable row level security;

-- institutions / facilities: readable by all authenticated; operator-writable ----
create policy institutions_read on public.institutions
  for select to authenticated using (true);
create policy institutions_write on public.institutions
  for all to authenticated using (public.is_operator()) with check (public.is_operator());
create policy facilities_read on public.facilities
  for select to authenticated using (true);
create policy facilities_write on public.facilities
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- users: own row full access; operator may read all (matching / console) ---------
create policy users_self on public.users
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy users_op_read on public.users
  for select to authenticated using (public.is_operator());

-- profiles: own row; operator read ----------------------------------------------
create policy profiles_self on public.profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_op_read on public.profiles
  for select to authenticated using (public.is_operator());

-- profile_sources: own row; operator read (provenance review) --------------------
create policy profile_sources_self on public.profile_sources
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profile_sources_op_read on public.profile_sources
  for select to authenticated using (public.is_operator());

-- problems: published visible to all; own drafts + operator (review queue) -------
create policy problems_select on public.problems
  for select to authenticated
  using (status = 'published' or submitted_by = auth.uid() or public.is_operator());
create policy problems_insert on public.problems
  for insert to authenticated with check (submitted_by = auth.uid());
create policy problems_update on public.problems
  for update to authenticated
  using (submitted_by = auth.uid() or public.is_operator())
  with check (submitted_by = auth.uid() or public.is_operator());

-- applications: own row; operator read (assembly / queue) ------------------------
create policy applications_self on public.applications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy applications_op_read on public.applications
  for select to authenticated using (public.is_operator());

-- groups: members + operator read; operator creates; members/operator update -----
create policy groups_select on public.groups
  for select to authenticated using (public.is_member_of(id) or public.is_operator());
create policy groups_insert on public.groups
  for insert to authenticated with check (public.is_operator());
create policy groups_update on public.groups
  for update to authenticated
  using (public.is_member_of(id) or public.is_operator())
  with check (public.is_member_of(id) or public.is_operator());

-- memberships: self or co-members + operator read; operator proposes; accept own -
create policy memberships_select on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_member_of(group_id) or public.is_operator());
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.is_operator());
create policy memberships_update on public.memberships
  for update to authenticated
  using (user_id = auth.uid() or public.is_operator())
  with check (user_id = auth.uid() or public.is_operator());

-- messages: room members + operator read; members send own; edit own -------------
create policy messages_select on public.messages
  for select to authenticated using (public.is_member_of(room_id) or public.is_operator());
create policy messages_insert on public.messages
  for insert to authenticated
  with check (public.is_member_of(room_id) and sender_id = auth.uid());
create policy messages_update on public.messages
  for update to authenticated using (sender_id = auth.uid()) with check (sender_id = auth.uid());

-- resource_requests: room members + operator; member creates own; operator fulfil-
create policy resource_requests_select on public.resource_requests
  for select to authenticated using (public.is_member_of(group_id) or public.is_operator());
create policy resource_requests_insert on public.resource_requests
  for insert to authenticated
  with check (public.is_member_of(group_id) and requested_by = auth.uid());
create policy resource_requests_update on public.resource_requests
  for update to authenticated
  using (public.is_member_of(group_id) or public.is_operator())
  with check (public.is_member_of(group_id) or public.is_operator());

-- data_request_listings: open listings visible to all; operator manages ----------
create policy data_request_listings_read on public.data_request_listings
  for select to authenticated using (status <> 'closed' or public.is_operator());
create policy data_request_listings_write on public.data_request_listings
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- provider_applications: own row; operator manages (accept/reject) ---------------
create policy provider_applications_self on public.provider_applications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy provider_applications_op on public.provider_applications
  for all to authenticated using (public.is_operator()) with check (public.is_operator());

-- versions: room members + operator read; members submit; operator/members update-
create policy versions_select on public.versions
  for select to authenticated using (public.is_member_of(group_id) or public.is_operator());
create policy versions_insert on public.versions
  for insert to authenticated with check (public.is_member_of(group_id));
create policy versions_update on public.versions
  for update to authenticated
  using (public.is_member_of(group_id) or public.is_operator())
  with check (public.is_member_of(group_id) or public.is_operator());

-- research_jobs: room members + operator read; member launches; operator updates -
create policy research_jobs_select on public.research_jobs
  for select to authenticated using (public.is_member_of(room_id) or public.is_operator());
create policy research_jobs_insert on public.research_jobs
  for insert to authenticated
  with check (public.is_member_of(room_id) and requested_by = auth.uid());
create policy research_jobs_update on public.research_jobs
  for update to authenticated using (public.is_operator()) with check (public.is_operator());

-- connections: an endpoint user or operator may read; operator/service writes -----
create policy connections_select on public.connections
  for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid() or public.is_operator());
create policy connections_write on public.connections
  for all to authenticated using (public.is_operator()) with check (public.is_operator());
