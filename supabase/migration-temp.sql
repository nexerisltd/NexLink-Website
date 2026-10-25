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
