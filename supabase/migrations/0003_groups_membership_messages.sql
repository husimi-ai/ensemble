-- 0003_groups_membership_messages.sql
-- Ensemble group-formation + room cluster: applications, groups, memberships,
-- messages (spec "Domain model"; multi-author room model from rules.md / F1/F3).
--
-- TABLES & COLUMNS (snake_case):
--   applications(id, problem_id, user_id, role profile_role, status, feedback,
--         created_at, updated_at)  — User -> Problem apply; status fuels the
--         unmatched-retry loop (C16). Lives here as the pre-assembly step that
--         becomes a membership (apply -> assemble -> membership).
--   groups(id, problem_id, name, status, created_at, updated_at)
--         — a formed team on a Problem (a.k.a. Project/Ensemble); many per problem.
--   memberships(id, group_id, user_id, role membership_role, accepted,
--         created_at, updated_at)  — User <-> Group; unanimous accept (C10);
--         founder is a member of every group (C17); providers join as members (C15).
--   messages(id, room_id, sender_id, sender_kind, kind, content,
--         attachments jsonb, created_at)  — a room == a group; realtime-delivered
--         (F3). sender_id null for ai/system turns.
--
-- Enum note: membership_role uses the domain's own labels
-- ('problem'/'builder'/'researcher'/'provider'/'founder'); applications.role reuses
-- profile_role ('problem_identifier'/'builder'/'researcher') — the classified role.

set search_path = public, extensions;

-- Enums -------------------------------------------------------------------------
create type public.application_status as enum ('pending', 'assembled', 'unmatched');
create type public.group_status as enum (
  'proposed', 'confirming', 'active', 'submitted', 'handed_over');
create type public.membership_role as enum (
  'problem', 'builder', 'researcher', 'provider', 'founder');
create type public.sender_kind as enum ('human', 'ai', 'system');
create type public.message_kind as enum (
  'chat', 'research_result', 'work_guide', 'system');

-- applications — User -> Problem (T3 surface a apply; C16 retry loop) ------------
create table public.applications (
  id         uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       public.profile_role,                 -- as classified at apply time
  status     public.application_status not null default 'pending',
  feedback   text,                                 -- fuels unmatched -> widen -> retry
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (problem_id, user_id)                     -- one application per person/problem
);
create index applications_problem_id_idx on public.applications (problem_id);
create index applications_user_id_idx on public.applications (user_id);
create index applications_status_idx on public.applications (status);
create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- groups — a formed team on a Problem (many groups may tackle one problem) -------
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  problem_id uuid not null references public.problems (id) on delete cascade,
  name       text,
  status     public.group_status not null default 'proposed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index groups_problem_id_idx on public.groups (problem_id);
create index groups_status_idx on public.groups (status);
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

-- memberships — User <-> Group with role + unanimous accept (C10/C15/C17) --------
create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       public.membership_role not null,
  accepted   boolean not null default false,       -- team-accept screen flips this
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)                        -- one membership per person/group
);
create index memberships_group_id_idx on public.memberships (group_id);
create index memberships_user_id_idx on public.memberships (user_id);
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- messages — realtime room thread; room_id == groups.id (F3) --------------------
create table public.messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.groups (id) on delete cascade,
  sender_id   uuid references public.users (id) on delete set null,  -- null: ai/system
  sender_kind public.sender_kind not null default 'human',
  kind        public.message_kind not null default 'chat',
  content     text,
  attachments jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
-- Thread load = messages of a room in time order.
create index messages_room_created_idx on public.messages (room_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);
