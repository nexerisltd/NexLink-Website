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
