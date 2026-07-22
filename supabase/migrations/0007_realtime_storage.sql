-- 0007_realtime_storage.sql
-- Realtime (publication + Broadcast Authorization) and Storage (buckets + RLS).
--
-- REALTIME (F3): one multiplexed channel per room. The AI's token stream and
-- human<->human messages are relayed as Broadcast on a *private* channel named
-- `room:<group_id>`; Broadcast Authorization = RLS policies on realtime.messages
-- gating SELECT (receive) and INSERT (send) to accepted room members. Domain
-- tables are also added to the supabase_realtime publication so Postgres Changes
-- can drive live membership/job/request updates.
--
-- STORAGE (private buckets, RLS on storage.objects):
--   cvs         — <user_id>/...   owner-only (onboarding CV upload).
--   attachments — <group_id>/...  room members (in-room file sharing).
--   versions    — <group_id>/...  room members write/read; operator reads all
--                                  (paper + codebase submission, C13/C14).

set search_path = public, extensions;

-- safe_uuid: parse a path/topic segment to uuid, or null (never raises on a
-- non-uuid segment, so a crafted channel/object path fails closed as "not a member").
create or replace function public.safe_uuid(txt text)
returns uuid
language sql immutable
as $$
  select case when txt ~ '^[0-9a-fA-F-]{36}$' then txt::uuid else null end;
$$;
grant execute on function public.safe_uuid(text) to authenticated;

-- Realtime publication ----------------------------------------------------------
-- Ensure the publication exists (Supabase ships it; guard covers a bare Postgres).
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.memberships;
alter publication supabase_realtime add table public.groups;
alter publication supabase_realtime add table public.resource_requests;
alter publication supabase_realtime add table public.research_jobs;

-- Realtime Broadcast Authorization on realtime.messages -------------------------
-- Topic convention: 'room:<group_id>'. Only accepted members of that group may
-- receive (select) or send (insert) on the channel. RLS is pre-enabled on
-- realtime.messages by Supabase; we add the policies.
create policy room_broadcast_receive on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and public.is_member_of(public.safe_uuid(split_part(realtime.topic(), ':', 2)))
  );

create policy room_broadcast_send on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and public.is_member_of(public.safe_uuid(split_part(realtime.topic(), ':', 2)))
  );

-- Storage buckets (private) -----------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('attachments', 'attachments', false),
  ('cvs', 'cvs', false),
  ('versions', 'versions', false)
on conflict (id) do nothing;

-- Storage RLS (bucket-scoped; first path folder = owner user_id or room group_id)
-- cvs: owner-only, all operations.
create policy cvs_owner_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);

-- attachments: room members, all operations.
create policy attachments_member_rw on storage.objects
  for all to authenticated
  using (
    bucket_id = 'attachments'
    and public.is_member_of(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'attachments'
    and public.is_member_of(public.safe_uuid((storage.foldername(name))[1]))
  );

-- versions: room members write + read; operator reads all.
create policy versions_member_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'versions'
    and public.is_member_of(public.safe_uuid((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'versions'
    and public.is_member_of(public.safe_uuid((storage.foldername(name))[1]))
  );
create policy versions_operator_read on storage.objects
  for select to authenticated
  using (bucket_id = 'versions' and public.is_operator());
