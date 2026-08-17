-- Sincroniza colunas de cronograma_itens que podem faltar em bancos que não
-- receberam as migrations anteriores (20260623121912 / 20260707165858).
-- Rode este SQL no Supabase → SQL Editor do projeto fsljgawsetjfrzgvrimr.
-- Idempotente — só cria coluna que não existe.

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS uid_mpp text,
  ADD COLUMN IF NOT EXISTS calendario_uid_mpp text,
  ADD COLUMN IF NOT EXISTS data_inicio_baseline date,
  ADD COLUMN IF NOT EXISTS data_fim_baseline date,
  ADD COLUMN IF NOT EXISTS custo_baseline numeric,
  ADD COLUMN IF NOT EXISTS folga_dias integer,
  ADD COLUMN IF NOT EXISTS folga_livre_dias integer,
  ADD COLUMN IF NOT EXISTS fanout_sucessoras integer,
  ADD COLUMN IF NOT EXISTS importancia_score numeric,
  ADD COLUMN IF NOT EXISTS importancia_classe text,
  ADD COLUMN IF NOT EXISTS critico boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS versao_otimista integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recursos_count integer,
  ADD COLUMN IF NOT EXISTS recursos_status text,
  ADD COLUMN IF NOT EXISTS servico_lob text,
  ADD COLUMN IF NOT EXISTS localizacao_id uuid;

-- Força o PostgREST a recarregar o schema cache
NOTIFY pgrst, 'reload schema';
