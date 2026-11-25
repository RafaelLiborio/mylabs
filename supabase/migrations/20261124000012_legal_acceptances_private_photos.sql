-- Políticas de Uso & Privacidade (LGPD)
-- 1. Fotos do diário (refeições / treino) são dados de saúde: bucket passa a ser PRIVADO.
--    O acesso continua garantido pelas policies client_diary_* (cliente dono + nutricionista responsável)
--    e o front-end passa a usar URLs assinadas temporárias.
update storage.buckets set public = false where id = 'client-diary-photos';

-- 2. Registro versionado de aceite dos documentos legais (prova do consentimento — LGPD art. 8º §2º)
create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  document text not null check (document in ('terms', 'privacy', 'health_data', 'professional_duties')),
  version text not null check (char_length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400),
  unique (user_id, document, version)
);

create index if not exists legal_acceptances_user_idx on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

-- Cada usuário lê apenas os próprios aceites; o suporte/admin pode auditar.
create policy legal_acceptances_select on public.legal_acceptances
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Cada usuário registra apenas o próprio aceite. Sem UPDATE/DELETE: o histórico é imutável.
create policy legal_acceptances_insert on public.legal_acceptances
  for insert to authenticated
  with check (user_id = auth.uid());
