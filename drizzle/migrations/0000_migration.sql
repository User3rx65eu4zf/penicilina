create table public.inventory_state (
  id int primary key default 1 check (id = 1),
  data jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.inventory_state to anon, authenticated;
grant all on public.inventory_state to service_role;
alter table public.inventory_state enable row level security;
create policy "shared state readable" on public.inventory_state for select to anon, authenticated using (true);
insert into public.inventory_state (id, data, version) values (1, null, 0);

create or replace function public.save_inventory_state(_expected bigint, _data jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if _data is null or jsonb_typeof(_data) <> 'object' then raise exception 'invalid data'; end if;
  update public.inventory_state set data = _data, version = version + 1, updated_at = now()
   where id = 1 and version = _expected returning version into v;
  return v; -- null = conflict
end $$;
grant execute on function public.save_inventory_state(bigint, jsonb) to anon, authenticated;

create table public.operation_log (
  id uuid primary key default gen_random_uuid(),
  action text not null check (length(action) <= 80),
  ok boolean not null,
  duration_ms int not null check (duration_ms >= 0 and duration_ms < 600000),
  user_name text not null check (length(user_name) <= 80),
  role text not null check (length(role) <= 40),
  error text check (length(error) <= 300),
  created_at timestamptz not null default now()
);
grant select, insert on public.operation_log to anon, authenticated;
grant all on public.operation_log to service_role;
alter table public.operation_log enable row level security;
create policy "log readable" on public.operation_log for select to anon, authenticated using (true);
create policy "log insertable" on public.operation_log for insert to anon, authenticated with check (true);

alter publication supabase_realtime add table public.inventory_state;
alter publication supabase_realtime add table public.operation_log;