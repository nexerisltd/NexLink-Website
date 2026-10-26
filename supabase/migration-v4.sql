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
