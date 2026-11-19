-- MyLabs • Núcleo: perfis, clientes, configurações e helpers de RLS
-- Perfis: admin (dono/suporte do sistema), nutritionist, client.

create type public.app_role as enum ('admin', 'nutritionist', 'client');
create type public.crn_status as enum ('pending', 'approved', 'rejected');
create type public.sex_type as enum ('male', 'female');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'nutritionist',
  full_name text not null default '',
  email text not null default '',
  whatsapp text,                       -- apenas dígitos com DDI (ex.: 5511999998888)
  avatar_url text,
  crn text,                            -- somente nutricionistas
  crn_status public.crn_status not null default 'pending',
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_whatsapp_digits check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$')
);
create index profiles_role_idx on public.profiles (role);

-- ----------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key references public.profiles (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id) on delete restrict,
  birth_date date,
  sex public.sex_type,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 50 and 250),
  goal text,
  activity_level text not null default 'light'
    check (activity_level in ('sedentary','light','moderate','active','very_active')),
  restrictions text,
  clinical_notes text,
  water_goal_ml integer not null default 2500 check (water_goal_ml between 500 and 10000),
  plan text not null default 'standard',
  created_at timestamptz not null default now()
);
create index clients_nutritionist_idx on public.clients (nutritionist_id);

-- ---------------------------------------------------------- app_settings
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (key, value) values
  ('support_whatsapp', '""'::jsonb),
  ('support_whatsapp_message', '"Olá! Preciso de ajuda com o sistema MyLabs."'::jsonb);

-- ---------------------------------------------------------------- helpers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create or replace function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'admin', false)
$$;

-- nutricionista aprovada (ou admin) que atende o cliente
create or replace function public.can_manage_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.clients c
    join public.profiles n on n.id = c.nutritionist_id
    where c.id = p_client and c.nutritionist_id = auth.uid() and n.active
  )
$$;

create or replace function public.is_client_self(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_client = auth.uid() and public.current_app_role() = 'client'
$$;

create or replace function public.can_access_client(p_client uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_manage_client(p_client) or public.is_client_self(p_client)
$$;

-- ----------------------------------------------- criação do perfil no signup
-- Papel vem de raw_app_meta_data (só a API admin escreve); signup público => nutricionista pendente.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_role public.app_role;
begin
  v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.app_role, 'nutritionist');
  insert into public.profiles (id, role, full_name, email, crn, crn_status)
  values (
    new.id, v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    case when v_role = 'nutritionist' then nullif(new.raw_user_meta_data ->> 'crn', '') end,
    case when v_role = 'nutritionist' then 'pending'::public.crn_status else 'approved'::public.crn_status end
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- impede que usuários comuns escalem privilégios editando o próprio perfil
create or replace function public.guard_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then return new; end if;
  if new.role is distinct from old.role
     or new.crn_status is distinct from old.crn_status
     or new.active is distinct from old.active
     or new.created_by is distinct from old.created_by
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Alteração de campos protegidos não permitida';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- --------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.app_settings enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or exists (select 1 from public.clients c where c.id = profiles.id and c.nutritionist_id = auth.uid())
  or exists (select 1 from public.clients c where c.id = auth.uid() and c.nutritionist_id = profiles.id)
);
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy profiles_update_nutri_clients on public.profiles for update to authenticated
  using (exists (select 1 from public.clients c where c.id = profiles.id and c.nutritionist_id = auth.uid()))
  with check (exists (select 1 from public.clients c where c.id = profiles.id and c.nutritionist_id = auth.uid()));

-- clients
create policy clients_select on public.clients for select to authenticated using (
  public.can_access_client(id)
);
create policy clients_update on public.clients for update to authenticated
  using (public.can_manage_client(id)) with check (public.can_manage_client(id));
-- INSERT/DELETE somente via Edge Function (service role)

-- app_settings: todos autenticados leem; só admin escreve
create policy settings_select on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Realtime não é necessário no núcleo; privilégios padrão do Supabase se aplicam.
