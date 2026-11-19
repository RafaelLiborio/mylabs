-- MyLabs • Nutrição: alimentos, planos alimentares, anexos e registros diários

create or replace function public.today_br() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  food_group text not null check (food_group in
    ('protein','carb','legume','vegetable','fruit','fat','dairy','other')),
  protein_g numeric(6,1) not null default 0 check (protein_g >= 0),
  carb_g numeric(6,1) not null default 0 check (carb_g >= 0),
  fat_g numeric(6,1) not null default 0 check (fat_g >= 0),
  fiber_g numeric(6,1) not null default 0 check (fiber_g >= 0),
  kcal numeric(6,0) generated always as (round(protein_g * 4 + carb_g * 4 + fat_g * 9)) stored,
  source text not null default 'taco',          -- valores por 100 g
  owner_id uuid references public.profiles (id) on delete cascade,  -- null = base global
  created_at timestamptz not null default now()
);
create index foods_name_idx on public.foods using gin (to_tsvector('portuguese', name));
create index foods_owner_idx on public.foods (owner_id);

create table public.diet_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id) default auth.uid(),
  name text not null,
  kind text not null default 'standard' check (kind in ('standard','training','rest')),
  kcal_target integer check (kcal_target is null or kcal_target between 500 and 10000),
  protein_target_g integer check (protein_target_g is null or protein_target_g between 0 and 600),
  carb_target_g integer check (carb_target_g is null or carb_target_g between 0 and 1500),
  fat_target_g integer check (fat_target_g is null or fat_target_g between 0 and 500),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index diet_plans_client_idx on public.diet_plans (client_id);
create trigger diet_plans_touch before update on public.diet_plans
  for each row execute function public.touch_updated_at();

create table public.diet_meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  name text not null,
  meal_time time,
  position integer not null default 0,
  notes text
);
create index diet_meals_plan_idx on public.diet_meals (plan_id);

create table public.diet_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.diet_meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  grams numeric(7,1) not null check (grams > 0 and grams <= 3000),
  position integer not null default 0
);
create index diet_meal_items_meal_idx on public.diet_meal_items (meal_id);

create table public.diet_attachments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.diet_plans (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  caption text,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now()
);
create index diet_attachments_plan_idx on public.diet_attachments (plan_id);

create table public.meal_logs (
  meal_id uuid not null references public.diet_meals (id) on delete cascade,
  log_date date not null default public.today_br(),
  client_id uuid not null references public.clients (id) on delete cascade,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (meal_id, log_date)
);
create index meal_logs_client_date_idx on public.meal_logs (client_id, log_date);

create table public.water_logs (
  client_id uuid not null references public.clients (id) on delete cascade,
  log_date date not null default public.today_br(),
  ml integer not null default 0 check (ml between 0 and 20000),
  primary key (client_id, log_date)
);

-- helpers de resolução de dono (security definer evita recursão de RLS)
create or replace function public.diet_plan_client(p_plan uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.diet_plans where id = p_plan
$$;
create or replace function public.diet_meal_client(p_meal uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.client_id from public.diet_meals m join public.diet_plans p on p.id = m.plan_id where m.id = p_meal
$$;

alter table public.foods enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_meals enable row level security;
alter table public.diet_meal_items enable row level security;
alter table public.diet_attachments enable row level security;
alter table public.meal_logs enable row level security;
alter table public.water_logs enable row level security;

create policy foods_select on public.foods for select to authenticated using (
  owner_id is null or owner_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.clients c where c.id = auth.uid() and c.nutritionist_id = foods.owner_id)
);
create policy foods_write on public.foods for all to authenticated
  using (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'))
  with check (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'));

create policy diet_plans_select on public.diet_plans for select to authenticated using (public.can_access_client(client_id));
create policy diet_plans_write on public.diet_plans for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy diet_meals_select on public.diet_meals for select to authenticated using (public.can_access_client(public.diet_plan_client(plan_id)));
create policy diet_meals_write on public.diet_meals for all to authenticated
  using (public.can_manage_client(public.diet_plan_client(plan_id))) with check (public.can_manage_client(public.diet_plan_client(plan_id)));

create policy diet_items_select on public.diet_meal_items for select to authenticated using (public.can_access_client(public.diet_meal_client(meal_id)));
create policy diet_items_write on public.diet_meal_items for all to authenticated
  using (public.can_manage_client(public.diet_meal_client(meal_id))) with check (public.can_manage_client(public.diet_meal_client(meal_id)));

create policy diet_att_select on public.diet_attachments for select to authenticated using (public.can_access_client(public.diet_plan_client(plan_id)));
create policy diet_att_write on public.diet_attachments for all to authenticated
  using (public.can_manage_client(public.diet_plan_client(plan_id))) with check (public.can_manage_client(public.diet_plan_client(plan_id)));

create policy meal_logs_select on public.meal_logs for select to authenticated using (public.can_access_client(client_id));
create policy meal_logs_write on public.meal_logs for all to authenticated
  using (client_id = auth.uid() and public.is_client_self(client_id))
  with check (client_id = auth.uid() and public.is_client_self(client_id) and public.diet_meal_client(meal_id) = auth.uid());

create policy water_logs_select on public.water_logs for select to authenticated using (public.can_access_client(client_id));
create policy water_logs_write on public.water_logs for all to authenticated
  using (client_id = auth.uid() and public.is_client_self(client_id))
  with check (client_id = auth.uid() and public.is_client_self(client_id));

-- Storage: anexos da dieta (privado) — caminho: {client_id}/{plan_id}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diet-attachments', 'diet-attachments', false, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy diet_att_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'diet-attachments' and public.can_access_client(((storage.foldername(name))[1])::uuid));
create policy diet_att_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'diet-attachments' and public.can_manage_client(((storage.foldername(name))[1])::uuid));
create policy diet_att_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'diet-attachments' and public.can_manage_client(((storage.foldername(name))[1])::uuid));
