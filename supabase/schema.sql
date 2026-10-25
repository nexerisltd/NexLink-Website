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
