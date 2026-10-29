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
