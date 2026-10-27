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
