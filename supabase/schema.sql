-- Run the whole file in Supabase SQL Editor.
create extension if not exists pg_cron;
create table public.profiles(id uuid primary key references auth.users on delete cascade,
  username text unique not null check(username ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check(char_length(display_name) between 1 and 40),
  public_key jsonb not null, created_at timestamptz default now());
create table public.key_backups(user_id uuid primary key references public.profiles on delete cascade, data jsonb not null);
create table public.chats(id uuid primary key default gen_random_uuid(), kind text not null check(kind in('dm','group')),
  title text, dm_key text unique, ttl_hours int not null default 0, created_by uuid references public.profiles, created_at timestamptz default now());
create table public.chat_members(chat_id uuid references public.chats on delete cascade, user_id uuid references public.profiles on delete cascade,
  is_admin boolean default false, primary key(chat_id,user_id));
create table public.messages(id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats on delete cascade,
  sender_id uuid not null references public.profiles, iv text not null, ciphertext text not null check(char_length(ciphertext)<20000),
  wraps jsonb not null, created_at timestamptz default now(), expires_at timestamptz);
create index on public.messages(chat_id,created_at);
create index on public.messages(expires_at);

create function public.is_member(c uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) $$;

-- rate limit + automatic expiry (default 60 days keeps you inside the 500 MB free database)
create function public.msg_guard() returns trigger language plpgsql as $$
declare t int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  select ttl_hours into t from chats where id=new.chat_id;
  new.expires_at:=now()+case when t>0 then make_interval(hours=>t) else interval '60 days' end;
  return new; end $$;
create trigger msg_guard before insert on public.messages for each row execute function public.msg_guard();

create function public.create_dm(other uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare k text; c uuid; begin
  if other=auth.uid() then raise exception 'Cannot message yourself'; end if;
  k:=least(auth.uid()::text,other::text)||':'||greatest(auth.uid()::text,other::text);
  select id into c from chats where dm_key=k; if c is not null then return c; end if;
  insert into chats(kind,dm_key,created_by) values('dm',k,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id) values(c,auth.uid()),(c,other); return c; end $$;

create function public.create_group(t text, members uuid[], ttl int default 0) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; begin
  if coalesce(array_length(members,1),0)>29 then raise exception 'Max 30 members'; end if;
  insert into chats(kind,title,ttl_hours,created_by) values('group',left(t,60),ttl,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id,is_admin) values(c,auth.uid(),true);
  insert into chat_members(chat_id,user_id) select c,u from unnest(members) u where u<>auth.uid() on conflict do nothing; return c; end $$;

create function public.leave_chat(c uuid) returns void language sql security definer set search_path=public as
$$ delete from chat_members where chat_id=c and user_id=auth.uid() $$;
create function public.set_ttl(c uuid, h int) returns void language sql security definer set search_path=public as
$$ update chats set ttl_hours=h where id=c and is_member(c) and h in(0,1,24,168) $$;

alter table public.profiles enable row level security; alter table public.key_backups enable row level security;
alter table public.chats enable row level security; alter table public.chat_members enable row level security; alter table public.messages enable row level security;
create policy p_sel on public.profiles for select to authenticated using(true);
create policy p_ins on public.profiles for insert to authenticated with check(id=auth.uid());
create policy p_upd on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy k_all on public.key_backups for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy c_sel on public.chats for select to authenticated using(public.is_member(id));
create policy m_sel on public.chat_members for select to authenticated using(public.is_member(chat_id));
create policy g_sel on public.messages for select to authenticated using(public.is_member(chat_id));
create policy g_ins on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.is_member(chat_id));
create policy g_del on public.messages for delete to authenticated using(sender_id=auth.uid());

alter publication supabase_realtime add table public.messages, public.chat_members;
select cron.schedule('purge-expired','*/15 * * * *','delete from public.messages where expires_at<now()');
-- Google-only login + temporary guest rooms (1-5 hours). Safe to run on top of the first schema.
alter table public.profiles add column if not exists is_guest boolean not null default false;
alter table public.chats add column if not exists code text unique, add column if not exists expires_at timestamptz,
  add column if not exists join_hash text, add column if not exists fails int not null default 0, add column if not exists locked_until timestamptz;
alter table public.chats drop constraint if exists chats_kind_check;
alter table public.chats add constraint chats_kind_check check(kind in('dm','group','temp'));

create or replace function public.is_guest() returns boolean language sql stable as
$$ select coalesce((auth.jwt()->>'is_anonymous')::boolean,false) $$;

create or replace function public.is_member(c uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from chat_members m join chats ch on ch.id=m.chat_id where m.chat_id=c and m.user_id=auth.uid() and (ch.expires_at is null or ch.expires_at>now())) $$;

create or replace function public.msg_guard() returns trigger language plpgsql as $$
declare t int; x timestamptz; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else interval '60 days' end);
  return new; end $$;

create or replace function public.create_dm(other uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare k text; c uuid; begin
  if public.is_guest() or exists(select 1 from profiles where id=other and is_guest) then raise exception 'Sign in with Google to message people'; end if;
  if other=auth.uid() then raise exception 'Cannot message yourself'; end if;
  k:=least(auth.uid()::text,other::text)||':'||greatest(auth.uid()::text,other::text);
  select id into c from chats where dm_key=k; if c is not null then return c; end if;
  insert into chats(kind,dm_key,created_by) values('dm',k,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id) values(c,auth.uid()),(c,other); return c; end $$;

create or replace function public.create_group(t text, members uuid[], ttl int default 0) returns uuid language plpgsql security definer set search_path=public as $$
declare c uuid; begin
  if public.is_guest() then raise exception 'Sign in with Google to create groups'; end if;
  if coalesce(array_length(members,1),0)>29 then raise exception 'Max 30 members'; end if;
  insert into chats(kind,title,ttl_hours,created_by) values('group',left(t,60),ttl,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id,is_admin) values(c,auth.uid(),true);
  insert into chat_members(chat_id,user_id) select c,u from unnest(members) u where u<>auth.uid() and not exists(select 1 from profiles p where p.id=u and p.is_guest) on conflict do nothing; return c; end $$;

create or replace function public.ensure_profile(nick text) returns void language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from profiles where id=auth.uid()) then return; end if;
  insert into profiles(id,username,display_name,public_key,is_guest) values(auth.uid(),'g_'||substr(replace(auth.uid()::text,'-',''),1,12),left(coalesce(nullif(trim(nick),''),'Guest'),40),'{}'::jsonb,true);
end $$;

-- v = client-derived verifier (never the password). Room key is derived separately, so the server cannot read messages.
create or replace function public.create_temp(c text, v text, h int, t text, nick text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare r uuid; begin
  if h<1 or h>5 then raise exception 'Duration must be 1-5 hours'; end if;
  if c !~ '^[A-Z0-9]{6,12}$' then raise exception 'Bad room code'; end if;
  if (select count(*) from chats where created_by=auth.uid() and kind='temp' and expires_at>now())>=3 then raise exception 'Too many active rooms'; end if;
  perform public.ensure_profile(nick);
  insert into chats(kind,title,code,join_hash,expires_at,created_by) values('temp',left(coalesce(nullif(t,''),'Temp room'),40),c,encode(sha256(convert_to(v,'utf8')),'hex'),now()+make_interval(hours=>h),auth.uid()) returning id into r;
  insert into chat_members(chat_id,user_id,is_admin) values(r,auth.uid(),true); return r; end $$;

create or replace function public.join_temp(c text, v text, nick text default null) returns uuid language plpgsql security definer set search_path=public as $$
declare r chats; begin
  select * into r from chats where code=c and kind='temp' and expires_at>now();
  if not found then return null; end if;
  if r.locked_until>now() then raise exception 'Room is locked for a few minutes'; end if;
  if r.join_hash<>encode(sha256(convert_to(v,'utf8')),'hex') then
    update chats set fails=case when fails>=7 then 0 else fails+1 end, locked_until=case when fails>=7 then now()+interval '10 minutes' else locked_until end where id=r.id;
    return null; end if;
  perform public.ensure_profile(nick);
  if (select count(*) from chat_members where chat_id=r.id)>=30 and not exists(select 1 from chat_members where chat_id=r.id and user_id=auth.uid()) then raise exception 'Room is full'; end if;
  insert into chat_members(chat_id,user_id) values(r.id,auth.uid()) on conflict do nothing;
  update chats set fails=0 where id=r.id;
  return r.id; end $$;

drop policy if exists p_sel on public.profiles; drop policy if exists p_ins on public.profiles;
create policy p_sel on public.profiles for select to authenticated using(not public.is_guest() or id=auth.uid() or exists(select 1 from chat_members a join chat_members b on a.chat_id=b.chat_id where a.user_id=auth.uid() and b.user_id=profiles.id));
create policy p_ins on public.profiles for insert to authenticated with check(id=auth.uid() and not is_guest and not public.is_guest());

select cron.schedule('purge-temp','*/15 * * * *','delete from public.chats where kind=''temp'' and expires_at<now()');
select cron.schedule('purge-guests','0 4 * * *','delete from auth.users where is_anonymous and created_at<now()-interval ''2 days''');
-- Adjustable server cache. History lives on devices + Drive backups; the server only keeps a rolling cache.
create table if not exists public.app_settings(key text primary key, val text not null);
alter table public.app_settings enable row level security;
insert into public.app_settings values('retention_days','60') on conflict do nothing;
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare t int; x timestamptz; d int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  select coalesce((select val::int from app_settings where key='retention_days'),60) into d;
  new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  return new; end $$;
-- change retention any time:  update public.app_settings set val='180' where key='retention_days';
-- Profile/group photos, encrypted file sharing (10 MB, any format), daily file quota. Run once.
alter table public.profiles add column if not exists avatar text check(char_length(avatar)<40000);
alter table public.chats add column if not exists avatar text check(char_length(avatar)<40000);
alter table public.messages add column if not exists file_path text;
create or replace function public.set_chat_avatar(c uuid,a text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and is_admin) then raise exception 'Only the group admin can change the photo'; end if;
  update chats set avatar=a where id=c; end $$;
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare t int; x timestamptz; d int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  if new.file_path is not null and (select count(*) from messages where sender_id=new.sender_id and file_path is not null and created_at>now()-interval '1 day')>=30 then raise exception 'Daily file limit reached'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  select coalesce((select val::int from app_settings where key='retention_days'),60) into d;
  new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  return new; end $$;
insert into storage.buckets(id,name,public,file_size_limit) values('files','files',false,10485760) on conflict(id) do update set file_size_limit=10485760;
drop policy if exists files_ins on storage.objects; drop policy if exists files_sel on storage.objects;
create policy files_ins on storage.objects for insert to authenticated with check(bucket_id='files' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy files_sel on storage.objects for select to authenticated using(bucket_id='files' and public.is_member(((storage.foldername(name))[1])::uuid));
-- file messages/rooms are cleaned by the daily /api/keepalive route (it must delete the Storage objects too)
select cron.schedule('purge-expired','*/15 * * * *','delete from public.messages where expires_at<now() and file_path is null');
select cron.schedule('purge-temp','*/15 * * * *','delete from public.chats c where kind=''temp'' and expires_at<now() and not exists(select 1 from public.messages m where m.chat_id=c.id and m.file_path is not null)');
-- Files now live in Cloudflare R2. Files expire after 7 days by default (change below). Run once.
drop policy if exists files_ins on storage.objects; drop policy if exists files_sel on storage.objects;
insert into public.app_settings values('file_retention_days','7') on conflict do nothing;
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare t int; x timestamptz; d int; fd int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  if new.file_path is not null and (select count(*) from messages where sender_id=new.sender_id and file_path is not null and created_at>now()-interval '1 day')>=30 then raise exception 'Daily file limit reached'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  select coalesce((select val::int from app_settings where key='retention_days'),60) into d;
  new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  if new.file_path is not null then
    select coalesce((select val::int from app_settings where key='file_retention_days'),7) into fd;
    new.expires_at:=least(new.expires_at,now()+make_interval(days=>fd));
  end if;
  return new; end $$;
-- change:  update public.app_settings set val='14' where key='file_retention_days';
-- No-card option: files stay in Supabase Storage (1 GB free). Cap per encrypted file = 20 MB. Run once.
insert into storage.buckets(id,name,public,file_size_limit) values('files','files',false,20972544) on conflict(id) do update set file_size_limit=20972544;
-- Group management: add / remove members, rename. Run once.
create or replace function public.chat_admin(c uuid) returns boolean language sql stable security definer set search_path=public as
$$ select exists(select 1 from chat_members where chat_id=c and user_id=auth.uid() and is_admin) $$;
create or replace function public.add_member(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.chat_admin(c) then raise exception 'Only the group admin can add people'; end if;
  if (select kind from chats where id=c)<>'group' then raise exception 'Only groups can have members added'; end if;
  if exists(select 1 from profiles where id=u and is_guest) then raise exception 'Guests cannot join groups'; end if;
  if (select count(*) from chat_members where chat_id=c)>=30 then raise exception 'Max 30 members'; end if;
  insert into chat_members(chat_id,user_id) values(c,u) on conflict do nothing; end $$;
create or replace function public.remove_member(c uuid,u uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.chat_admin(c) then raise exception 'Only the group admin can remove people'; end if;
  if u=auth.uid() then raise exception 'Use Leave to remove yourself'; end if;
  delete from chat_members where chat_id=c and user_id=u; end $$;
create or replace function public.rename_chat(c uuid,t text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not public.chat_admin(c) then raise exception 'Only the group admin can rename the group'; end if;
  update chats set title=left(t,60) where id=c and kind='group'; end $$;
-- Background push notifications. Run once.
create table if not exists public.push_subs(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
  endpoint text unique not null, sub jsonb not null, muted jsonb not null default '[]', created_at timestamptz default now());
alter table public.push_subs enable row level security;
drop policy if exists ps_own on public.push_subs;
create policy ps_own on public.push_subs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
-- Clear chat (per user) + chat history requests/grants. Run once.
alter table public.chat_members add column if not exists cleared_at timestamptz;
create table if not exists public.history_grants(id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats on delete cascade, user_id uuid not null references public.profiles on delete cascade,
  granted_by uuid references public.profiles, from_ts timestamptz not null, to_ts timestamptz not null, created_at timestamptz default now());
alter table public.history_grants enable row level security;
drop policy if exists hg_sel on public.history_grants;
create policy hg_sel on public.history_grants for select to authenticated using(user_id=auth.uid() or granted_by=auth.uid());
-- a member sees messages newer than their own "clear" time, plus any range someone shared with them
drop policy if exists g_sel on public.messages;
create policy g_sel on public.messages for select to authenticated using(
  public.is_member(chat_id) and (
    created_at > coalesce((select m.cleared_at from public.chat_members m where m.chat_id=messages.chat_id and m.user_id=auth.uid()),'-infinity'::timestamptz)
    or exists(select 1 from public.history_grants g where g.chat_id=messages.chat_id and g.user_id=auth.uid() and messages.created_at between g.from_ts and g.to_ts)));
create or replace function public.clear_chat(c uuid) returns void language plpgsql security definer set search_path=public as $$
declare lim timestamptz; begin
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) then raise exception 'Not a member'; end if;
  update chat_members set cleared_at=now() where chat_id=c and user_id=auth.uid();
  -- when EVERY member has cleared, everything up to the earliest clear time is deleted for good
  if (select bool_and(cleared_at is not null) from chat_members where chat_id=c) then
    select min(cleared_at) into lim from chat_members where chat_id=c;
    delete from messages where chat_id=c and created_at<=lim;
  end if; end $$;
create or replace function public.grant_history(c uuid,u uuid,from_id uuid,to_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare a timestamptz; b timestamptz; mine timestamptz; begin
  if u=auth.uid() then raise exception 'Not allowed'; end if;
  if not exists(select 1 from chat_members where chat_id=c and user_id=auth.uid()) or not exists(select 1 from chat_members where chat_id=c and user_id=u) then raise exception 'Not allowed'; end if;
  if (select kind from chats where id=c)='temp' then raise exception 'Not available in temp rooms'; end if;
  select created_at into a from messages where id=from_id and chat_id=c;
  select created_at into b from messages where id=to_id and chat_id=c;
  if a is null or b is null then raise exception 'Messages not found'; end if;
  if a>b then select b,a into a,b; end if;
  select coalesce(cleared_at,'-infinity'::timestamptz) into mine from chat_members where chat_id=c and user_id=auth.uid();
  if a<=mine then raise exception 'You can only share messages you can see'; end if;
  insert into history_grants(chat_id,user_id,granted_by,from_ts,to_ts) values(c,u,auth.uid(),a,b); end $$;
-- Profile links, "who can message me", guest-to-user chats, Google Drive refresh tokens. Run once.
alter table public.profiles add column if not exists msg_policy text not null default 'everyone' check(msg_policy in('everyone','signed','temp','none'));
create or replace function public.get_public_profile(uname text) returns table(id uuid,username text,display_name text,avatar text,msg_policy text) language sql stable security definer set search_path=public as
$$ select p.id,p.username,p.display_name,p.avatar,p.msg_policy from profiles p where p.username=lower(uname) and not p.is_guest $$;
grant execute on function public.get_public_profile(text) to anon,authenticated;
create or replace function public.guest_set_key(pub jsonb) returns void language sql security definer set search_path=public as
$$ update profiles set public_key=pub where id=auth.uid() and is_guest $$;
create or replace function public.create_dm(other uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare k text; c uuid; tg boolean; tp text; g boolean; begin
  g:=public.is_guest();
  if other=auth.uid() then raise exception 'Cannot message yourself'; end if;
  select is_guest,msg_policy into tg,tp from profiles where id=other;
  if not found then raise exception 'User not found'; end if;
  k:=least(auth.uid()::text,other::text)||':'||greatest(auth.uid()::text,other::text);
  select id into c from chats where dm_key=k; if c is not null then return c; end if;
  if tg then raise exception 'You cannot start a chat with a guest'; end if;
  if tp='none' then raise exception 'This person is not accepting messages'; end if;
  if tp='signed' and g then raise exception 'This person only accepts messages from signed-in users'; end if;
  if tp='temp' and not g then raise exception 'This person only accepts messages from temporary guests'; end if;
  if g then
    if coalesce((select public_key->>'x' from profiles where id=auth.uid()),'')='' then raise exception 'Guest key missing'; end if;
    if (select count(*) from chats where created_by=auth.uid() and kind='dm')>=3 then raise exception 'Guests can start up to 3 chats'; end if;
  end if;
  insert into chats(kind,dm_key,created_by) values('dm',k,auth.uid()) returning id into c;
  insert into chat_members(chat_id,user_id) values(c,auth.uid()),(c,other); return c; end $$;
create or replace function public.msg_guard() returns trigger language plpgsql security definer set search_path=public as $$
declare t int; x timestamptz; d int; fd int; begin
  if (select count(*) from messages where sender_id=new.sender_id and created_at>now()-interval '10 seconds')>=15 then raise exception 'Slow down'; end if;
  if exists(select 1 from chats ch join chat_members cm on cm.chat_id=ch.id join profiles p on p.id=cm.user_id where ch.id=new.chat_id and ch.kind='dm' and cm.user_id<>new.sender_id and p.msg_policy='none') then raise exception 'This account is not accepting messages'; end if;
  if new.file_path is not null and (select count(*) from messages where sender_id=new.sender_id and file_path is not null and created_at>now()-interval '1 day')>=30 then raise exception 'Daily file limit reached'; end if;
  select ttl_hours,expires_at into t,x from chats where id=new.chat_id;
  select coalesce((select val::int from app_settings where key='retention_days'),60) into d;
  new.expires_at:=coalesce(x,now()+case when t>0 then make_interval(hours=>t) else make_interval(days=>d) end);
  if new.file_path is not null then
    select coalesce((select val::int from app_settings where key='file_retention_days'),7) into fd;
    new.expires_at:=least(new.expires_at,now()+make_interval(days=>fd));
  end if;
  return new; end $$;
-- guest accounts are purged after 2 days: let that cascade cleanly
alter table public.chats drop constraint if exists chats_created_by_fkey;
alter table public.chats add constraint chats_created_by_fkey foreign key(created_by) references public.profiles(id) on delete set null;
alter table public.messages drop constraint if exists messages_sender_id_fkey;
alter table public.messages add constraint messages_sender_id_fkey foreign key(sender_id) references public.profiles(id) on delete cascade;
select cron.schedule('purge-lonely-dms','30 4 * * *','delete from public.chats c where kind=''dm'' and (select count(*) from public.chat_members m where m.chat_id=c.id)<2');
create table if not exists public.google_tokens(user_id uuid primary key references auth.users on delete cascade, enc text not null, updated_at timestamptz default now());
alter table public.google_tokens enable row level security; -- no policies: only the server (service role) can touch it
