-- NexLink.Chat migration v10 — Telegram-grade features (run once in Supabase SQL Editor).
-- Adds: presence/last-seen, read receipts, Saved Messages, pinned messages,
-- group roles & permissions, channels, scheduled messages.
-- Everything below is metadata-only: message bodies stay encrypted in the browser.

-- ================= profiles: presence + privacy =================
alter table public.profiles add column if not exists last_seen timestamptz;
alter table public.profiles add column if not exists show_online text not null default 'everyone' check(show_online in('everyone','nobody'));

create or replace function public.touch_presence() returns void language sql security definer set search_path=public as
$$ update profiles set last_seen=now() where id=auth.uid() $$;
grant execute on function public.touch_presence() to authenticated;

-- ================= chat_members: read receipts + roles =================
alter table public.chat_members add column if not exists last_read_at timestamptz;
alter table public.chat_members add column if not exists role text not null default 'member' check(role in('owner','admin','member'));
-- keep the legacy is_admin flag in sync
update public.chat_members set role='admin' where is_admin and role='member';
update public.chat_members set is_admin=true where role in('owner','admin');

create or replace function public.set_read(c uuid) returns void language sql security definer set search_path=public as
$$ update chat_members set last_read_at=now() where chat_id=c and user_id=auth.uid() $$;
grant execute on function public.set_read(uuid) to authenticated;

-- ================= Saved Messages (a DM with yourself) =================
create or replace function public.create_saved() returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; begin
  if public.is_guest() then raise exception 'Guests cannot use Saved Messages'; end if;
  select id into c from chats where dm_key='saved:'||auth.uid();
  if c is not null then return c; end if;
  insert into chats(kind,dm_key,created_by) values('dm','saved:'||auth.uid(),auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id,is_admin,role) values(c,auth.uid(),true,'owner');
  return c; end $$;
grant execute on function public.create_saved() to authenticated;
-- Saved chats have a single member: stop the lonely-DM purge from deleting them
select cron.unschedule('purge-lonely-dms') where exists(select 1 from cron.job where jobname='purge-lonely-dms');
select cron.schedule('purge-lonely-dms','30 4 * * *','delete from public.chats c where kind=''dm'' and dm_key not like ''saved:%'' and (select count(*) from public.chat_members m where m.chat_id=c.id)<2');

-- ================= pinned messages =================
create table if not exists public.pinned_messages(id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats on delete cascade, message_id uuid not null references public.messages on delete cascade,
  pinned_by uuid references public.profiles on delete set null, pinned_at timestamptz default now(), unique(chat_id,message_id));
alter table public.pinned_messages enable row level security;
drop policy if exists pm_all on public.pinned_messages;
create policy pm_all on public.pinned_messages for all to authenticated using(public.is_member(chat_id)) with check(public.is_member(chat_id));

create or replace function public.pin_msg(c uuid,m uuid) returns void language plpgsql security definer set search_path=public as $$
declare k text; pp jsonb; begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) then raise exception 'Not a member'; end if;
  if not exists(select 1 from messages where id=m and chat_id=c) then raise exception 'Message not found'; end if;
  select kind,perms into k,pp from chats where id=c;
  if k='channel' then
    if not public.chat_admin(c) then raise exception 'Only channel admins can pin'; end if;
  elsif k='group' then
    if not public.chat_admin(c) and coalesce(pp->>'pin','admins')<>'members' then raise exception 'Only admins can pin'; end if;
  end if;
  -- one pinned message per chat (Telegram-style banner)
  delete from pinned_messages where chat_id=c;
  insert into pinned_messages(chat_id,message_id,pinned_by) values(c,m,auth.uid()); end $$;
create or replace function public.unpin_msg(c uuid,m uuid) returns void language plpgsql security definer set search_path=public as $$
declare k text; begin
  select kind into k from chats where id=c;
  if k in('group','channel') and not public.chat_admin(c) then raise exception 'Only admins can unpin'; end if;
  delete from pinned_messages where chat_id=c and message_id=m; end $$;
grant execute on function public.pin_msg(uuid,uuid) to authenticated;
grant execute on function public.unpin_msg(uuid,uuid) to authenticated;

-- ================= group roles & permissions =================
alter table public.chats add column if not exists perms jsonb not null default '{}'::jsonb;
-- perms: {"send":"members"|"admins","info":"members"|"admins","pin":"members"|"admins"} (default = admins)

create or replace function public.promote(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and role='owner') then raise exception 'Only the owner can promote'; end if;
  if not exists(select 1 from chat_members where chat_id=c and user_id=u) then raise exception 'Not a member'; end if;
  update chat_members set role='admin',is_admin=true where chat_id=c and user_id=u and role='member'; end $$;
create or replace function public.demote(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and role='owner') then raise exception 'Only the owner can demote'; end if;
  update chat_members set role='member',is_admin=false where chat_id=c and user_id=u and role='admin'; end $$;
create or replace function public.transfer_owner(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and role='owner') then raise exception 'Only the owner can transfer ownership'; end if;
  if not exists(select 1 from chat_members where chat_id=c and user_id=u) or u=auth.uid() then raise exception 'Pick another member'; end if;
  update chat_members set role='owner',is_admin=true where chat_id=c and user_id=u;
  update chat_members set role='admin',is_admin=true where chat_id=c and user_id=auth.uid();
  update chats set created_by=u where id=c; end $$;
create or replace function public.set_group_perms(c uuid,p jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and role='owner') then raise exception 'Only the owner can change permissions'; end if;
  update chats set perms=p where id=c and kind in('group','channel'); end $$;
grant execute on function public.promote(uuid,uuid) to authenticated;
grant execute on function public.demote(uuid,uuid) to authenticated;
grant execute on function public.transfer_owner(uuid,uuid) to authenticated;
grant execute on function public.set_group_perms(uuid,jsonb) to authenticated;

-- ================= channels (admin-only broadcast chats) =================
alter table public.chats drop constraint if exists chats_kind_check;
alter table public.chats add constraint chats_kind_check check(kind in('dm','group','temp','channel'));

create or replace function public.create_channel(t text) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; k text; begin
  if public.is_guest() then raise exception 'Guests cannot create channels'; end if;
  for i in 1..5 loop
    k:=upper(substr(translate(encode(gen_random_bytes(12),'base64'),'+/=','AEIOU2468'),1,10));
    exit when not exists(select 1 from chats where code=k);
  end loop;
  insert into chats(kind,title,code,created_by) values('channel',left(t,60),k,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id,is_admin,role) values(c,auth.uid(),true,'owner');
  return c; end $$;
create or replace function public.join_channel(code text) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; begin
  select id into c from chats where code=upper(code) and kind='channel' and expires_at is null;
  if c is null then raise exception 'Channel not found'; end if;
  if exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) then return c; end if;
  if (select count(*) from chat_members where chat_id=c)>=500 then raise exception 'Channel is full'; end if;
  insert into chat_members(chat_id,user_id) values(c,auth.uid());
  return c; end $$;
grant execute on function public.create_channel(text) to authenticated;
grant execute on function public.join_channel(text) to authenticated;

-- ================= scheduled messages =================
alter table public.messages add column if not exists deliver_at timestamptz;

-- ================= message guard: channels + scheduling =================
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare t int; x timestamptz; d int; fd int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  if exists(select 1 from chats ch join chat_members cm on cm.chat_id=ch.id join profiles p on p.id=cm.user_id where ch.id=new.chat_id and ch.kind='dm' and cm.user_id<>new.sender_id and p.msg_policy='none') then raise exception 'This account is not accepting messages'; end if;
  if new.file_path is not null and (select count(*) from messages where sender_id=new.sender_id and file_path is not null and created_at>now()-interval '1 day')>=30 then raise exception 'Daily file limit reached'; end if;
  -- channels: only admins can post (ciphertext hides payload types, so this is enforced by membership)
  if exists(select 1 from chats where id=new.chat_id and kind='channel') and not public.chat_admin(new.chat_id) then raise exception 'Only channel admins can post'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  select coalesce((select val::int from app_settings where key='retention_days'),60) into d;
  if new.deliver_at is not null then
    -- scheduled: stay hidden until deliver_at, then keep for the normal retention window
    new.expires_at:=coalesce(x,new.deliver_at+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  else
    new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  end if;
  if new.file_path is not null then
    select coalesce((select val::int from app_settings where key='file_retention_days'),7) into fd;
    new.expires_at:=least(new.expires_at,now()+make_interval(days=>fd));
  end if;
  return new; end $$;

-- ================= RLS: scheduled visibility + channel posting =================
drop policy if exists g_sel on public.messages;
create policy g_sel on public.messages for select to authenticated using(
  public.is_member(chat_id)
  and (deliver_at is null or deliver_at<=now() or sender_id=auth.uid())
  and (
    created_at > coalesce((select m.cleared_at from public.chat_members m where m.chat_id=messages.chat_id and m.user_id=auth.uid()),'-infinity'::timestamptz)
    or exists(select 1 from public.history_grants g where g.chat_id=messages.chat_id and g.user_id=auth.uid() and messages.created_at between g.from_ts and g.to_ts)));
drop policy if exists g_ins on public.messages;
create policy g_ins on public.messages for insert to authenticated with check(
  sender_id=auth.uid() and public.is_member(chat_id)
  and ((select kind from public.chats where id=chat_id) is distinct from 'channel' or public.chat_admin(chat_id)));

-- channels can be renamed like groups (refreshes the base rename_chat for existing deployments)
create or replace function public.rename_chat(c uuid,t text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.chat_admin(c) then raise exception 'Only the group admin can rename the group'; end if;
  update chats set title=left(t,60) where id=c and kind in('group','channel'); end $$;

-- channels can also have members added (cap 500; groups stay at 30)
create or replace function public.add_member(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
declare k text; begin
  if not public.chat_admin(c) then raise exception 'Only the group admin can add people'; end if;
  select kind into k from chats where id=c;
  if k not in('group','channel') then raise exception 'Only groups and channels can have members added'; end if;
  if exists(select 1 from profiles where id=u and is_guest) then raise exception 'Guests cannot join groups'; end if;
  if (select count(*) from chat_members where chat_id=c)>=(case when k='channel' then 500 else 30 end) then raise exception 'Chat is full'; end if;
  insert into chat_members(chat_id,user_id) values(c,u) on conflict do nothing;
  update chat_members set role='member',is_admin=false where chat_id=c and user_id=u and role='owner' and u<>auth.uid(); end $$;
