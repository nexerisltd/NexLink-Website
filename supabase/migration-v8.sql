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
