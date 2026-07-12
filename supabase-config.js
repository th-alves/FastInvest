/**
 * Configuração do Supabase
 *
 * Como preencher:
 * 1. Crie um projeto gratuito em https://supabase.com
 * 2. No painel do projeto, vá em "Project Settings" > "API"
 * 3. Copie a "Project URL" e cole em SUPABASE_URL abaixo
 * 4. Copie a chave "anon public" e cole em SUPABASE_ANON_KEY abaixo
 *
 * Essas chaves NÃO são secretas — a chave "anon" é feita pra ficar
 * no código do navegador. Quem protege os dados de verdade são as
 * políticas de Row Level Security configuradas no supabase-setup.sql.
 */
const SUPABASE_URL = "https://crdrregdkdvvbmqjsyvg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyZHJyZWdka2R2dmJtcWpzeXZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzQxOTcsImV4cCI6MjA5OTQ1MDE5N30.QDbJJMieYcDmklO1vaiG6LtanUz5vVndNStOOccLfwU";

const supabaseClient = SUPABASE_URL.startsWith("http")
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabaseClient) {
  console.warn(
    "⚠️ Supabase não configurado. Preencha supabase-config.js com as " +
      "chaves do seu projeto (veja as instruções no topo do arquivo).",
  );
}
