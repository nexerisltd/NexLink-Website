-- Background push notifications. Run once.
create table if not exists public.push_subs(id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
  endpoint text unique not null, sub jsonb not null, muted jsonb not null default '[]', created_at timestamptz default now());
alter table public.push_subs enable row level security;
drop policy if exists ps_own on public.push_subs;
create policy ps_own on public.push_subs for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
