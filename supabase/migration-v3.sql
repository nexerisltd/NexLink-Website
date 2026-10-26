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
