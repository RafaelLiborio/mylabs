-- MyLabs • Antropometria, fórmulas personalizadas, relatórios, suporte (WhatsApp) e agendamento

create table public.anthropometry_assessments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  assessed_by uuid references public.profiles (id) default auth.uid(),
  assessed_at date not null default public.today_br(),
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 20 and 400),
  height_cm numeric(5,1) check (height_cm is null or height_cm between 50 and 250),
  protocol text,                                   -- ex.: jackson_pollock_7, durnin_womersley, us_navy, bioimpedance
  skinfolds jsonb not null default '{}'::jsonb,    -- mm
  circumferences jsonb not null default '{}'::jsonb, -- cm
  bioimpedance jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,      -- IMC, %G, massas, RCQ, TMB...
  photo_paths text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);
create index assessments_client_date_idx on public.anthropometry_assessments (client_id, assessed_at desc);

create table public.weight_checkins (
  client_id uuid not null references public.clients (id) on delete cascade,
  log_date date not null default public.today_br(),
  weight_kg numeric(5,1) not null check (weight_kg between 20 and 400),
  note text,
  primary key (client_id, log_date)
);

create table public.custom_formulas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name text not null,
  category text not null default 'energy' check (category in ('energy','body_composition','other')),
  expression text not null check (char_length(expression) <= 500),
  unit text not null default '',
  description text,
  reference text,
  created_at timestamptz not null default now()
);
create index custom_formulas_owner_idx on public.custom_formulas (owner_id);

create table public.report_schedules (
  client_id uuid primary key references public.clients (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id) default auth.uid(),
  interval_days integer not null default 15 check (interval_days between 1 and 365),
  enabled boolean not null default true,
  last_run_on date,
  next_run_on date not null default (public.today_br() + 15)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  nutritionist_id uuid not null references public.profiles (id),
  period_start date not null,
  period_end date not null,
  data jsonb not null,
  generated_by text not null default 'manual' check (generated_by in ('manual','schedule')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_nutri_idx on public.reports (nutritionist_id, created_at desc);
create index reports_client_idx on public.reports (client_id, created_at desc);

create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('nutritionist','system')),
  from_user uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  to_user uuid references public.profiles (id) on delete set null,
  category text not null,
  message text not null check (char_length(message) between 3 and 2000),
  whatsapp_to text,
  status text not null default 'sent' check (status in ('sent','resolved')),
  created_at timestamptz not null default now()
);
create index support_requests_to_idx on public.support_requests (to_user, created_at desc);
create index support_requests_from_idx on public.support_requests (from_user, created_at desc);

-- ---------------------------------------------------------------- RLS
alter table public.anthropometry_assessments enable row level security;
alter table public.weight_checkins enable row level security;
alter table public.custom_formulas enable row level security;
alter table public.report_schedules enable row level security;
alter table public.reports enable row level security;
alter table public.support_requests enable row level security;

create policy assess_select on public.anthropometry_assessments for select to authenticated using (public.can_access_client(client_id));
create policy assess_write on public.anthropometry_assessments for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy checkins_select on public.weight_checkins for select to authenticated using (public.can_access_client(client_id));
create policy checkins_write on public.weight_checkins for all to authenticated
  using (client_id = auth.uid() and public.is_client_self(client_id))
  with check (client_id = auth.uid() and public.is_client_self(client_id));

create policy formulas_all on public.custom_formulas for all to authenticated
  using (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'))
  with check (owner_id = auth.uid() and public.current_app_role() in ('nutritionist','admin'));

create policy schedules_all on public.report_schedules for all to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));

create policy reports_select on public.reports for select to authenticated using (public.can_manage_client(client_id));
create policy reports_update on public.reports for update to authenticated
  using (public.can_manage_client(client_id)) with check (public.can_manage_client(client_id));
create policy reports_delete on public.reports for delete to authenticated using (public.can_manage_client(client_id));

create policy support_insert on public.support_requests for insert to authenticated
  with check (from_user = auth.uid());
create policy support_select on public.support_requests for select to authenticated
  using (from_user = auth.uid() or to_user = auth.uid() or public.is_admin());
create policy support_update on public.support_requests for update to authenticated
  using (to_user = auth.uid() or public.is_admin()) with check (to_user = auth.uid() or public.is_admin());

-- Storage: fotos de evolução (privado) — caminho: {client_id}/{arquivo}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;
create policy progress_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and public.can_access_client(((storage.foldername(name))[1])::uuid));
create policy progress_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and public.can_manage_client(((storage.foldername(name))[1])::uuid));
create policy progress_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and public.can_manage_client(((storage.foldername(name))[1])::uuid));

-- ------------------------------------------------- RELATÓRIO PROFISSIONAL
create or replace function public._build_client_report(p_client uuid, p_start date, p_end date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_days int := greatest(p_end - p_start + 1, 1);
  v_client jsonb; v_weights jsonb; v_w_start numeric; v_w_end numeric;
  v_diet numeric; v_water_avg numeric; v_water_goal int; v_water_days int;
  v_w_planned int; v_w_ratio numeric; v_active_days int; v_last_assess jsonb; v_loads jsonb;
  v_alerts jsonb := '[]'::jsonb; v_workout numeric;
begin
  select jsonb_build_object(
      'id', c.id, 'name', p.full_name, 'goal', c.goal, 'sex', c.sex,
      'height_cm', c.height_cm, 'age', case when c.birth_date is null then null else date_part('year', age(c.birth_date))::int end,
      'water_goal_ml', c.water_goal_ml), c.water_goal_ml
    into v_client, v_water_goal
  from public.clients c join public.profiles p on p.id = c.id where c.id = p_client;

  -- série de peso (avaliações + pesagens do cliente)
  with w as (
    select assessed_at as d, weight_kg as kg from public.anthropometry_assessments
      where client_id = p_client and weight_kg is not null and assessed_at between p_start and p_end
    union all
    select log_date, weight_kg from public.weight_checkins
      where client_id = p_client and log_date between p_start and p_end
  ) select coalesce(jsonb_agg(jsonb_build_object('date', d, 'kg', kg) order by d), '[]'::jsonb) into v_weights from w;

  select kg into v_w_start from (
    select assessed_at d, weight_kg kg from public.anthropometry_assessments where client_id = p_client and weight_kg is not null and assessed_at <= p_start
    union all select log_date, weight_kg from public.weight_checkins where client_id = p_client and log_date <= p_start
  ) s order by d desc limit 1;
  if v_w_start is null and jsonb_array_length(v_weights) > 0 then v_w_start := (v_weights -> 0 ->> 'kg')::numeric; end if;
  if jsonb_array_length(v_weights) > 0 then v_w_end := (v_weights -> (jsonb_array_length(v_weights) - 1) ->> 'kg')::numeric; end if;

  -- adesão à dieta: média diária de (refeições concluídas / refeições do plano)
  with plan_meals as (
    select m.plan_id, count(*) total from public.diet_meals m join public.diet_plans dp on dp.id = m.plan_id
    where dp.client_id = p_client and dp.active group by m.plan_id),
  day_ratio as (
    select l.log_date, (count(*) filter (where l.completed))::numeric / max(pm.total) r
    from public.meal_logs l join public.diet_meals m on m.id = l.meal_id join plan_meals pm on pm.plan_id = m.plan_id
    where l.client_id = p_client and l.log_date between p_start and p_end group by l.log_date, m.plan_id)
  select coalesce(sum(r), 0) / v_days * 100 into v_diet from (select log_date, max(r) r from day_ratio group by log_date) x;

  -- hidratação
  select coalesce(sum(ml), 0)::numeric / v_days, count(*) filter (where ml >= v_water_goal)
    into v_water_avg, v_water_days from public.water_logs
    where client_id = p_client and log_date between p_start and p_end;

  -- treinos planejados x concluídos (ficha cíclica por semana/dia)
  with planned as (
    select d::date as dt, wd.id as day_id
    from generate_series(p_start, p_end, interval '1 day') d
    join public.workout_plans wp on wp.client_id = p_client and wp.active and d::date >= wp.start_date
    join public.workout_days wd on wd.plan_id = wp.id
      and wd.weekday = extract(dow from d)::int
      and wd.week = (((d::date - wp.start_date) / 7) % wp.weeks) + 1),
  ratio as (
    select pl.dt, pl.day_id,
      coalesce((select (count(*) filter (where wl.completed))::numeric / nullif(count(we.id), 0)
        from public.workout_exercises we
        left join public.workout_logs wl on wl.workout_exercise_id = we.id and wl.log_date = pl.dt
        where we.day_id = pl.day_id), 0) r
    from planned pl)
  select count(*), coalesce(avg(r), 0) * 100 into v_w_planned, v_workout from ratio;
  v_w_ratio := v_workout;

  -- dias com qualquer registro
  select count(distinct d) into v_active_days from (
    select log_date d from public.meal_logs where client_id = p_client and log_date between p_start and p_end
    union select log_date from public.water_logs where client_id = p_client and log_date between p_start and p_end
    union select log_date from public.workout_logs where client_id = p_client and log_date between p_start and p_end
    union select log_date from public.weight_checkins where client_id = p_client and log_date between p_start and p_end
  ) a;

  -- última avaliação antropométrica do período e a anterior
  select jsonb_build_object('assessed_at', a.assessed_at, 'weight_kg', a.weight_kg, 'results', a.results,
      'previous', (select jsonb_build_object('assessed_at', b.assessed_at, 'weight_kg', b.weight_kg, 'results', b.results)
                   from public.anthropometry_assessments b
                   where b.client_id = p_client and b.assessed_at < a.assessed_at order by b.assessed_at desc limit 1))
    into v_last_assess
  from public.anthropometry_assessments a where a.client_id = p_client and a.assessed_at <= p_end
  order by a.assessed_at desc limit 1;

  -- evolução de carga nos exercícios (primeiro x último registro do período)
  select coalesce(jsonb_agg(to_jsonb(t) order by t.delta desc), '[]'::jsonb) into v_loads from (
    select e.name_pt as exercise,
      (array_agg(wl.load_kg order by wl.log_date asc))[1] as first_kg,
      (array_agg(wl.load_kg order by wl.log_date desc))[1] as last_kg,
      (array_agg(wl.load_kg order by wl.log_date desc))[1] - (array_agg(wl.load_kg order by wl.log_date asc))[1] as delta
    from public.workout_logs wl
    join public.workout_exercises we on we.id = wl.workout_exercise_id
    join public.exercises e on e.id = we.exercise_id
    where wl.client_id = p_client and wl.completed and wl.load_kg is not null and wl.log_date between p_start and p_end
    group by e.name_pt having count(*) >= 2 limit 8) t;

  if v_active_days::numeric / v_days < 0.5 then
    v_alerts := v_alerts || to_jsonb('Baixo engajamento: registros em menos de 50% dos dias do período.'::text); end if;
  if v_diet < 60 then v_alerts := v_alerts || to_jsonb('Adesão à dieta abaixo de 60%.'::text); end if;
  if v_w_planned > 0 and v_workout < 60 then v_alerts := v_alerts || to_jsonb('Execução dos treinos abaixo de 60%.'::text); end if;
  if v_water_avg < v_water_goal * 0.6 then v_alerts := v_alerts || to_jsonb('Hidratação média abaixo de 60% da meta.'::text); end if;

  return jsonb_build_object(
    'client', v_client, 'period', jsonb_build_object('start', p_start, 'end', p_end, 'days', v_days),
    'weight', jsonb_build_object('series', v_weights, 'start', v_w_start, 'end', v_w_end,
        'delta', case when v_w_start is not null and v_w_end is not null then round(v_w_end - v_w_start, 1) end),
    'diet', jsonb_build_object('adherence_pct', round(v_diet, 0)),
    'workout', jsonb_build_object('planned_sessions', v_w_planned, 'completion_pct', round(coalesce(v_w_ratio, 0), 0), 'load_progress', v_loads),
    'water', jsonb_build_object('avg_ml', round(coalesce(v_water_avg, 0), 0), 'goal_ml', v_water_goal, 'days_goal_met', coalesce(v_water_days, 0)),
    'engagement', jsonb_build_object('active_days', v_active_days, 'pct', round(v_active_days::numeric / v_days * 100, 0)),
    'assessment', v_last_assess, 'alerts', v_alerts, 'generated_at', now());
end $$;

revoke all on function public._build_client_report(uuid, date, date) from public, anon, authenticated;

create or replace function public.generate_client_report(p_client uuid, p_days int default 15)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_nutri uuid; v_id uuid; v_end date := public.today_br();
begin
  if not public.can_manage_client(p_client) then raise exception 'Sem permissão para este cliente'; end if;
  select nutritionist_id into v_nutri from public.clients where id = p_client;
  insert into public.reports (client_id, nutritionist_id, period_start, period_end, data, generated_by)
  values (p_client, v_nutri, v_end - (greatest(p_days, 1) - 1), v_end,
          public._build_client_report(p_client, v_end - (greatest(p_days, 1) - 1), v_end), 'manual')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.generate_client_report(uuid, int) from public, anon;
grant execute on function public.generate_client_report(uuid, int) to authenticated;

create or replace function public.run_due_reports() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_count int := 0; v_end date := public.today_br();
begin
  for r in select s.* , c.nutritionist_id as nutri from public.report_schedules s
           join public.clients c on c.id = s.client_id
           where s.enabled and s.next_run_on <= v_end loop
    insert into public.reports (client_id, nutritionist_id, period_start, period_end, data, generated_by)
    values (r.client_id, r.nutri, v_end - (r.interval_days - 1), v_end,
            public._build_client_report(r.client_id, v_end - (r.interval_days - 1), v_end), 'schedule');
    update public.report_schedules set last_run_on = v_end, next_run_on = v_end + r.interval_days
      where client_id = r.client_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.run_due_reports() from public, anon, authenticated;

-- agendamento diário (06:00 em Brasília = 09:00 UTC)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('mylabs-due-reports', '0 9 * * *', $$select public.run_due_reports()$$);
