-- MyLabs • Endurecimento: remove EXECUTE de anon/public em funções internas e fixa search_path
alter function public.touch_updated_at() set search_path = public;
alter function public.today_br() set search_path = public;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_profile_update() from public, anon, authenticated;

-- helpers usados nas políticas RLS: somente usuários autenticados
revoke execute on function
  public.current_app_role(), public.is_admin(), public.can_manage_client(uuid), public.is_client_self(uuid),
  public.can_access_client(uuid), public.diet_plan_client(uuid), public.diet_meal_client(uuid),
  public.workout_plan_client(uuid), public.workout_day_client(uuid), public.workout_exercise_client(uuid)
  from public, anon;
grant execute on function
  public.current_app_role(), public.is_admin(), public.can_manage_client(uuid), public.is_client_self(uuid),
  public.can_access_client(uuid), public.diet_plan_client(uuid), public.diet_meal_client(uuid),
  public.workout_plan_client(uuid), public.workout_day_client(uuid), public.workout_exercise_client(uuid)
  to authenticated;
