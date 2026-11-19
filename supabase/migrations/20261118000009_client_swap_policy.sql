-- MyLabs • Permite ao próprio cliente aplicar substituição equivalente nos itens da sua refeição
create policy diet_items_client_swap on public.diet_meal_items
  for update to authenticated
  using (public.is_client_self(public.diet_meal_client(meal_id)))
  with check (public.is_client_self(public.diet_meal_client(meal_id)));
