ALTER TABLE public.causas_nao_conclusao
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
UPDATE public.causas_nao_conclusao SET ativo = ativa;

ALTER TABLE public.compromissos_semanais
  ADD COLUMN IF NOT EXISTS semana_inicio date,
  ADD COLUMN IF NOT EXISTS concluido boolean NOT NULL DEFAULT false;
UPDATE public.compromissos_semanais
   SET semana_inicio = COALESCE(semana_inicio, semana_ref),
       concluido = COALESCE(status, '') IN ('concluido','concluído','done');

ALTER TABLE public.cronograma_cenarios
  ADD COLUMN IF NOT EXISTS criado_por uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'rascunho',
  ADD COLUMN IF NOT EXISTS aplicado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aplicado_por uuid;
UPDATE public.cronograma_cenarios SET criado_por = COALESCE(criado_por, created_by);

ALTER TABLE public.cronograma_cenario_itens
  ADD COLUMN IF NOT EXISTS item_id uuid,
  ADD COLUMN IF NOT EXISTS data_inicio_origem date,
  ADD COLUMN IF NOT EXISTS data_fim_origem date,
  ADD COLUMN IF NOT EXISTS data_inicio_sim date,
  ADD COLUMN IF NOT EXISTS data_fim_sim date,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.cronograma_cenario_itens
   SET item_id = COALESCE(item_id, cronograma_item_id),
       data_inicio_sim = COALESCE(data_inicio_sim, data_inicio),
       data_fim_sim = COALESCE(data_fim_sim, data_fim);

ALTER TABLE public.user_empresas
  ADD COLUMN IF NOT EXISTS papel text NOT NULL DEFAULT 'membro';

CREATE TRIGGER trg_cenario_itens_updated BEFORE UPDATE ON public.cronograma_cenario_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();