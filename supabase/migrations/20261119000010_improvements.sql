-- MyLabs • Impede o mesmo alimento 2 vezes no mesmo card de refeição (permitindo em refeições diferentes)
create or replace function public.prevent_duplicate_meal_food() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.diet_meal_items
    where meal_id = new.meal_id
      and food_id = new.food_id
      and id is distinct from new.id
  ) then
    raise exception 'Este alimento já está incluído nesta refeição. Ajuste a gramatura existente ou adicione em outra refeição.';
  end if;
  return new;
end $$;

revoke execute on function public.prevent_duplicate_meal_food() from public, anon, authenticated;

create trigger diet_meal_items_no_duplicate
  before insert or update on public.diet_meal_items
  for each row execute function public.prevent_duplicate_meal_food();
