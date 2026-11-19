-- MyLabs • Treinos: biblioteca de exercícios, fichas por semana/dia e registros de execução

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name_pt text not null,
  muscle_group text not null check (muscle_group in
    ('peito','costas','ombros','biceps','triceps','antebraco','abdomen',
     'quadriceps','posterior','gluteos','panturrilha','cardio','corpo_inteiro')),
  secondary_muscles text[] not null default '{}',
  equipment text not null default 'Peso corporal',
  level text not null default 'intermediario' check (level in ('iniciante','intermediario','avancado')),
  instructions_pt text[] not null default '{}',
  frame_urls text[] not null default '{}',   -- quadros que alternam como animação
  gif_url text,                               -- GIF próprio (opcional, prioridade sobre frames)
  owner_id uuid references public.profiles (id) on delete cascade, -- null = catálogo global
  created_at timestamptz not null default now()
);
create index exercises_group_idx on public.exercises (muscle_group);
create index exercises_owner_idx on public.exercises (owner_id);

create table public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id) default auth.uid(),
  name text not null,
  weeks smallint not null default 4 check (weeks between 1 and 52),
  start_date date not null default public.today_br(),
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index workout_plans_client_idx on public.workout_plans (client_id);

create table public.workout_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.workout_plans (id) on delete cascade,
  week smallint not null check (week between 1 and 52),
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = domingo
  title text not null,
  muscle_groups text[] not null default '{}',
  notes text,
  unique (plan_id, week, weekday)
);
create index workout_days_plan_idx on public.workout_days (plan_id);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.workout_days (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position integer not null default 0,
  sets smallint not null default 3 check (sets between 1 and 20),
  reps text not null default '10',
  rest_sec smallint not null default 60 check (rest_sec between 0 and 600),
  load_kg numeric(6,1) check (load_kg is null or load_kg >= 0),
  notes text
);
create index workout_exercises_day_idx on public.workout_exercises (day_id);

create table public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  log_date date not null default public.today_br(),
  load_kg numeric(6,1) check (load_kg is null or load_kg >= 0),
  reps smallint check (reps is null or reps >= 0),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, log_date)
);
create index workout_logs_client_date_idx on public.workout_logs (client_id, log_date);

create or replace function public.workout_plan_client(p_plan uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.workout_plans where id = p_plan $$;
create or replace function public.workout_day_client(p_day uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.client_id from public.workout_days d join public.workout_plans p on p.id = d.plan_id where d.id = p_day $$;
create or replace function public.workout_exercise_client(p_we uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select p.client_id from public.workout_exercises e
  join public.workout_days d on d.id = e.day_id
  join public.workout_plans p on p.id = d.plan_id where e.id = p_we $$;

alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_logs enable row level security;

create policy exercises_select on public.exercises for select to authenticated using (
  owner_id is null or owner_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.clients c where c.id = auth.uid() and c.nutritionist_id = exercises.owner_id));
create policy exercises_write on public.exercises for all to authenticated
  using (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'))
  with check (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'));

create policy wplans_select on public.workout_plans for select to authenticated using (public.can_access_client(client_id));
create policy wplans_write on public.workout_plans for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy wdays_select on public.workout_days for select to authenticated using (public.can_access_client(public.workout_plan_client(plan_id)));
create policy wdays_write on public.workout_days for all to authenticated
  using (public.can_manage_client(public.workout_plan_client(plan_id))) with check (public.can_manage_client(public.workout_plan_client(plan_id)));

create policy wex_select on public.workout_exercises for select to authenticated using (public.can_access_client(public.workout_day_client(day_id)));
create policy wex_write on public.workout_exercises for all to authenticated
  using (public.can_manage_client(public.workout_day_client(day_id))) with check (public.can_manage_client(public.workout_day_client(day_id)));

create policy wlogs_select on public.workout_logs for select to authenticated using (public.can_access_client(client_id));
create policy wlogs_write on public.workout_logs for all to authenticated
  using (client_id = auth.uid() and public.is_client_self(client_id))
  with check (client_id = auth.uid() and public.is_client_self(client_id) and public.workout_exercise_client(workout_exercise_id) = auth.uid());

-- Mídia própria dos exercícios (GIFs/imagens enviados pelo nutricionista) — público p/ leitura
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exercise-media', 'exercise-media', true, 8388608, array['image/gif','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy exercise_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exercise-media'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() in ('nutritionist','admin'));
create policy exercise_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exercise-media' and (storage.foldername(name))[1] = auth.uid()::text);
