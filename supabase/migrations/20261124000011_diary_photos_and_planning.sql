-- MyLabs • Planejamento semanal/mensal de dieta + Diário de fotos de refeições e de dias de treino pelo cliente

-- 1. Planejamento Semanal / Mensal na Dieta
alter table public.diet_plans
  add column if not exists planning_scope text not null default 'weekly'
    check (planning_scope in ('daily', 'weekly', 'monthly')),
  add column if not exists weeks_count smallint not null default 4
    check (weeks_count between 1 and 12);

alter table public.diet_meals
  add column if not exists week_number smallint not null default 1
    check (week_number between 1 and 12),
  add column if not exists weekday smallint
    check (weekday is null or weekday between 0 and 6);

-- 2. Imagem ilustrativa opcional por alimento
alter table public.foods
  add column if not exists image_url text;

-- 3. Posts de fotos das refeições pelo cliente ao longo dos dias (1 por card de refeição / vários ao longo dos dias)
create table if not exists public.meal_photo_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  meal_id uuid not null references public.diet_meals (id) on delete cascade,
  log_date date not null default public.today_br(),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists meal_photo_posts_meal_idx on public.meal_photo_posts (meal_id, log_date desc);
create index if not exists meal_photo_posts_client_idx on public.meal_photo_posts (client_id, log_date desc);

alter table public.meal_photo_posts enable row level security;

create policy meal_photos_select on public.meal_photo_posts
  for select to authenticated
  using (public.can_access_client(client_id));

create policy meal_photos_insert on public.meal_photo_posts
  for insert to authenticated
  with check (
    (client_id = auth.uid() and public.is_client_self(client_id))
    or public.can_manage_client(client_id)
  );

create policy meal_photos_delete on public.meal_photo_posts
  for delete to authenticated
  using (
    (client_id = auth.uid() and public.is_client_self(client_id))
    or public.can_manage_client(client_id)
  );

-- 4. Posts de fotos por DIA DE TREINO pelo cliente (não por exercício)
create table if not exists public.workout_day_photos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  workout_day_id uuid not null references public.workout_days (id) on delete cascade,
  log_date date not null default public.today_br(),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);
create index if not exists workout_day_photos_day_idx on public.workout_day_photos (workout_day_id, log_date desc);
create index if not exists workout_day_photos_client_idx on public.workout_day_photos (client_id, log_date desc);

alter table public.workout_day_photos enable row level security;

create policy wday_photos_select on public.workout_day_photos
  for select to authenticated
  using (public.can_access_client(client_id));

create policy wday_photos_insert on public.workout_day_photos
  for insert to authenticated
  with check (
    (client_id = auth.uid() and public.is_client_self(client_id))
    or public.can_manage_client(client_id)
  );

create policy wday_photos_delete on public.workout_day_photos
  for delete to authenticated
  using (
    (client_id = auth.uid() and public.is_client_self(client_id))
    or public.can_manage_client(client_id)
  );

-- 5. Bucket público/autenticado para fotos postadas pelo cliente (refeições e dias de treino)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-diary-photos', 'client-diary-photos', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic'])
on conflict (id) do nothing;

create policy client_diary_select on storage.objects
  for select to authenticated
  using (bucket_id = 'client-diary-photos' and public.can_access_client(((storage.foldername(name))[1])::uuid));

create policy client_diary_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'client-diary-photos' and public.can_access_client(((storage.foldername(name))[1])::uuid));

create policy client_diary_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'client-diary-photos' and public.can_access_client(((storage.foldername(name))[1])::uuid));
