-- ============================================================
-- ByFinance — Setup do banco de dados no Supabase
-- ============================================================
-- Como usar:
-- 1. Crie um projeto gratuito em https://supabase.com
-- 2. No menu lateral, vá em "SQL Editor"
-- 3. Cole este arquivo inteiro e clique em "Run"
-- 4. Pronto — a tabela e as regras de segurança já estarão criadas
-- ============================================================

-- Tabela única com todos os dados do usuário, em formato JSON
-- (mesmo formato que já era usado no localStorage, só que na nuvem)
create table if not exists dados_usuario (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  kraken     jsonb default '{}'::jsonb,
  proventos  jsonb default '{}'::jsonb,
  aportes    jsonb default '{}'::jsonb,
  ativos     jsonb default '[]'::jsonb,
  calc       jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Ativa a Row Level Security (RLS): por padrão, ninguém acessa nada.
-- As políticas abaixo liberam cada usuário a mexer SÓ na própria linha.
alter table dados_usuario enable row level security;

create policy "Usuário lê os próprios dados"
  on dados_usuario for select
  using (auth.uid() = user_id);

create policy "Usuário insere os próprios dados"
  on dados_usuario for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza os próprios dados"
  on dados_usuario for update
  using (auth.uid() = user_id);

-- Atualiza automaticamente o campo updated_at a cada alteração
create or replace function atualizar_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trigger_atualizar_updated_at
  before update on dados_usuario
  for each row
  execute function atualizar_updated_at();
