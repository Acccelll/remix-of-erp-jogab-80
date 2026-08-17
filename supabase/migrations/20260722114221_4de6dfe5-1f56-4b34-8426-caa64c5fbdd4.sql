
-- ============================================================
-- Tabelas faltantes: Planejamento (LPS), Cronograma e Kanban
-- Padrão RLS: authenticated com policies permissivas (idem cards/cronograma_itens).
-- ============================================================

-- ============ CRONOGRAMA_DEPENDENCIAS: colunas ausentes ============
ALTER TABLE public.cronograma_dependencias
  ADD COLUMN IF NOT EXISTS predecessor_item_id uuid,
  ADD COLUMN IF NOT EXISTS lag_minutos integer;

-- ============ CRONOGRAMA_CALENDARIOS ============
CREATE TABLE IF NOT EXISTS public.cronograma_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  uid_mpp text,
  nome text,
  dias_uteis jsonb,
  horas_por_dia numeric,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cronograma_calendarios_obra ON public.cronograma_calendarios(obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_calendarios TO authenticated;
GRANT ALL ON public.cronograma_calendarios TO service_role;
ALTER TABLE public.cronograma_calendarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cronograma_calendarios" ON public.cronograma_calendarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cronograma_calendarios" ON public.cronograma_calendarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CRONOGRAMA_CALENDARIO_EXCECOES ============
CREATE TABLE IF NOT EXISTS public.cronograma_calendario_excecoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid NOT NULL REFERENCES public.cronograma_calendarios(id) ON DELETE CASCADE,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  trabalha boolean NOT NULL DEFAULT false,
  horas_disponiveis numeric,
  confirmada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_cal_excecoes_cal ON public.cronograma_calendario_excecoes(calendario_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_calendario_excecoes TO authenticated;
GRANT ALL ON public.cronograma_calendario_excecoes TO service_role;
ALTER TABLE public.cronograma_calendario_excecoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cronograma_calendario_excecoes" ON public.cronograma_calendario_excecoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cronograma_calendario_excecoes" ON public.cronograma_calendario_excecoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CRONOGRAMA_CENARIOS ============
CREATE TABLE IF NOT EXISTS public.cronograma_cenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_cenarios_obra ON public.cronograma_cenarios(obra_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_cenarios TO authenticated;
GRANT ALL ON public.cronograma_cenarios TO service_role;
ALTER TABLE public.cronograma_cenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cronograma_cenarios" ON public.cronograma_cenarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cronograma_cenarios" ON public.cronograma_cenarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CRONOGRAMA_CENARIO_ITENS ============
CREATE TABLE IF NOT EXISTS public.cronograma_cenario_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cenario_id uuid NOT NULL REFERENCES public.cronograma_cenarios(id) ON DELETE CASCADE,
  cronograma_item_id uuid,
  data_inicio date,
  data_fim date,
  custo numeric,
  percentual_previsto numeric,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cron_cenario_itens_cen ON public.cronograma_cenario_itens(cenario_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_cenario_itens TO authenticated;
GRANT ALL ON public.cronograma_cenario_itens TO service_role;
ALTER TABLE public.cronograma_cenario_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cronograma_cenario_itens" ON public.cronograma_cenario_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write cronograma_cenario_itens" ON public.cronograma_cenario_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PACOTES_TRABALHO (Last Planner) ============
CREATE TABLE IF NOT EXISTS public.pacotes_trabalho (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  cronograma_item_id uuid,
  descricao text NOT NULL,
  responsavel_id uuid,
  semana_inicio date,
  semana_fim date,
  status text NOT NULL DEFAULT 'planejado',
  tamanho_estimado numeric,
  unidade text,
  criterio_conclusao text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pacotes_trabalho_obra ON public.pacotes_trabalho(obra_id);
CREATE INDEX IF NOT EXISTS idx_pacotes_trabalho_semana ON public.pacotes_trabalho(semana_inicio, semana_fim);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacotes_trabalho TO authenticated;
GRANT ALL ON public.pacotes_trabalho TO service_role;
ALTER TABLE public.pacotes_trabalho ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pacotes_trabalho" ON public.pacotes_trabalho FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pacotes_trabalho" ON public.pacotes_trabalho FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ RESTRICOES ============
CREATE TABLE IF NOT EXISTS public.restricoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  tipo text NOT NULL,
  descricao text NOT NULL,
  responsavel_id uuid,
  prazo date,
  status text NOT NULL DEFAULT 'aberta',
  resolvida_em timestamptz,
  card_id uuid,
  requisicao_id uuid,
  observacao text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_restricoes_obra ON public.restricoes(obra_id);
CREATE INDEX IF NOT EXISTS idx_restricoes_card ON public.restricoes(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restricoes TO authenticated;
GRANT ALL ON public.restricoes TO service_role;
ALTER TABLE public.restricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read restricoes" ON public.restricoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write restricoes" ON public.restricoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ PACOTE_RESTRICOES ============
CREATE TABLE IF NOT EXISTS public.pacote_restricoes (
  pacote_id uuid NOT NULL REFERENCES public.pacotes_trabalho(id) ON DELETE CASCADE,
  restricao_id uuid NOT NULL REFERENCES public.restricoes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pacote_id, restricao_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacote_restricoes TO authenticated;
GRANT ALL ON public.pacote_restricoes TO service_role;
ALTER TABLE public.pacote_restricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read pacote_restricoes" ON public.pacote_restricoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write pacote_restricoes" ON public.pacote_restricoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ COMPROMISSOS_SEMANAIS ============
CREATE TABLE IF NOT EXISTS public.compromissos_semanais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id uuid NOT NULL,
  pacote_id uuid REFERENCES public.pacotes_trabalho(id) ON DELETE SET NULL,
  semana_ref date NOT NULL,
  responsavel_id uuid,
  status text,
  ppc numeric,
  causa_nao_conclusao text,
  observacao text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_compromissos_semanais_obra ON public.compromissos_semanais(obra_id, semana_ref);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compromissos_semanais TO authenticated;
GRANT ALL ON public.compromissos_semanais TO service_role;
ALTER TABLE public.compromissos_semanais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read compromissos_semanais" ON public.compromissos_semanais FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write compromissos_semanais" ON public.compromissos_semanais FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CAUSAS_NAO_CONCLUSAO ============
CREATE TABLE IF NOT EXISTS public.causas_nao_conclusao (
  chave text PRIMARY KEY,
  label text NOT NULL,
  ordem integer,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.causas_nao_conclusao TO authenticated;
GRANT ALL ON public.causas_nao_conclusao TO service_role;
ALTER TABLE public.causas_nao_conclusao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read causas_nao_conclusao" ON public.causas_nao_conclusao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write causas_nao_conclusao" ON public.causas_nao_conclusao FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.causas_nao_conclusao (chave, label, ordem) VALUES
  ('projeto', 'Projeto/Escopo indefinido', 1),
  ('material', 'Falta de material', 2),
  ('mao_de_obra', 'Falta de mão de obra', 3),
  ('equipamento', 'Falta de equipamento', 4),
  ('clima', 'Clima', 5),
  ('planejamento', 'Falha de planejamento', 6),
  ('predecessora', 'Atividade predecessora não concluída', 7),
  ('cliente', 'Pendência do cliente', 8),
  ('outro', 'Outro', 99)
ON CONFLICT (chave) DO NOTHING;

-- ============ LEAD_TIME_TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.lead_time_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_recurso text NOT NULL,
  obra_id uuid,
  dias_necessidade integer,
  dias_pedido integer,
  dias_notif_compras integer,
  dias_prod_iniciar integer,
  dias_notif_producao integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lead_time_templates_obra ON public.lead_time_templates(obra_id, tipo_recurso);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_time_templates TO authenticated;
GRANT ALL ON public.lead_time_templates TO service_role;
ALTER TABLE public.lead_time_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read lead_time_templates" ON public.lead_time_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write lead_time_templates" ON public.lead_time_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_ANEXOS ============
CREATE TABLE IF NOT EXISTS public.card_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  tamanho bigint,
  mime text,
  enviado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_anexos_card ON public.card_anexos(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_anexos TO authenticated;
GRANT ALL ON public.card_anexos TO service_role;
ALTER TABLE public.card_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_anexos" ON public.card_anexos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_anexos" ON public.card_anexos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_CHECKLIST_ITENS ============
CREATE TABLE IF NOT EXISTS public.card_checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  texto text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem integer NOT NULL DEFAULT 0,
  grupo text,
  responsavel_id uuid,
  prazo date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_checklist_card ON public.card_checklist_itens(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_checklist_itens TO authenticated;
GRANT ALL ON public.card_checklist_itens TO service_role;
ALTER TABLE public.card_checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_checklist_itens" ON public.card_checklist_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_checklist_itens" ON public.card_checklist_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_SETORES ============
CREATE TABLE IF NOT EXISTS public.card_setores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  setor text NOT NULL,
  subsetor text,
  status_setor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, setor)
);
CREATE INDEX IF NOT EXISTS idx_card_setores_setor ON public.card_setores(setor);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_setores TO authenticated;
GRANT ALL ON public.card_setores TO service_role;
ALTER TABLE public.card_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_setores" ON public.card_setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_setores" ON public.card_setores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_RECURSOS: adicionar coluna valor_estimado se ausente ============
ALTER TABLE public.card_recursos ADD COLUMN IF NOT EXISTS valor_estimado numeric;

-- ============ CARD_LABELS ============
CREATE TABLE IF NOT EXISTS public.card_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_labels TO authenticated;
GRANT ALL ON public.card_labels TO service_role;
ALTER TABLE public.card_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_labels" ON public.card_labels FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_labels" ON public.card_labels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_LABEL_LINKS ============
CREATE TABLE IF NOT EXISTS public.card_label_links (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.card_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, label_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_label_links TO authenticated;
GRANT ALL ON public.card_label_links TO service_role;
ALTER TABLE public.card_label_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_label_links" ON public.card_label_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_label_links" ON public.card_label_links FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_COMENTARIOS ============
CREATE TABLE IF NOT EXISTS public.card_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  texto text NOT NULL,
  autor text,
  autor_id uuid,
  autor_nome text,
  parent_id uuid,
  reply_to uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_comentarios_card ON public.card_comentarios(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_comentarios TO authenticated;
GRANT ALL ON public.card_comentarios TO service_role;
ALTER TABLE public.card_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_comentarios" ON public.card_comentarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_comentarios" ON public.card_comentarios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_ATIVIDADES ============
CREATE TABLE IF NOT EXISTS public.card_atividades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe jsonb,
  ator_id uuid,
  ator_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_atividades_card ON public.card_atividades(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_atividades TO authenticated;
GRANT ALL ON public.card_atividades TO service_role;
ALTER TABLE public.card_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_atividades" ON public.card_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_atividades" ON public.card_atividades FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_LOCAL ============
CREATE TABLE IF NOT EXISTS public.card_local (
  card_id uuid PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  endereco text,
  lat numeric,
  lng numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_local TO authenticated;
GRANT ALL ON public.card_local TO service_role;
ALTER TABLE public.card_local ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_local" ON public.card_local FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_local" ON public.card_local FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_CAMPOS_VALORES ============
CREATE TABLE IF NOT EXISTS public.card_campos_valores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL,
  valor jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, campo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_campos_valores TO authenticated;
GRANT ALL ON public.card_campos_valores TO service_role;
ALTER TABLE public.card_campos_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_campos_valores" ON public.card_campos_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_campos_valores" ON public.card_campos_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_CUSTOM_FIELD_VALORES ============
CREATE TABLE IF NOT EXISTS public.card_custom_field_valores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL,
  valor jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_card_cfv_card ON public.card_custom_field_valores(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_custom_field_valores TO authenticated;
GRANT ALL ON public.card_custom_field_valores TO service_role;
ALTER TABLE public.card_custom_field_valores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_custom_field_valores" ON public.card_custom_field_valores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_custom_field_valores" ON public.card_custom_field_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_BOARD_POSICAO ============
CREATE TABLE IF NOT EXISTS public.card_board_posicao (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  board_id uuid NOT NULL,
  lista_id uuid NOT NULL,
  posicao numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, board_id)
);
CREATE INDEX IF NOT EXISTS idx_card_board_posicao_lista ON public.card_board_posicao(lista_id, posicao);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_board_posicao TO authenticated;
GRANT ALL ON public.card_board_posicao TO service_role;
ALTER TABLE public.card_board_posicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_board_posicao" ON public.card_board_posicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_board_posicao" ON public.card_board_posicao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_GRUPOS_NEGOCIACAO ============
CREATE TABLE IF NOT EXISTS public.card_grupos_negociacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotulo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_grupos_negociacao TO authenticated;
GRANT ALL ON public.card_grupos_negociacao TO service_role;
ALTER TABLE public.card_grupos_negociacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_grupos_negociacao" ON public.card_grupos_negociacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_grupos_negociacao" ON public.card_grupos_negociacao FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_VIEWS_SALVAS ============
CREATE TABLE IF NOT EXISTS public.card_views_salvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor text,
  filtros jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_views_salvas TO authenticated;
GRANT ALL ON public.card_views_salvas TO service_role;
ALTER TABLE public.card_views_salvas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_views_salvas" ON public.card_views_salvas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_views_salvas" ON public.card_views_salvas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ CARD_SECOES_VISIVEIS ============
CREATE TABLE IF NOT EXISTS public.card_secoes_visiveis (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  secao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, secao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_secoes_visiveis TO authenticated;
GRANT ALL ON public.card_secoes_visiveis TO service_role;
ALTER TABLE public.card_secoes_visiveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read card_secoes_visiveis" ON public.card_secoes_visiveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write card_secoes_visiveis" ON public.card_secoes_visiveis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ Triggers de updated_at ============
CREATE TRIGGER trg_cron_calendarios_updated BEFORE UPDATE ON public.cronograma_calendarios FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_cron_cenarios_updated BEFORE UPDATE ON public.cronograma_cenarios FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_pacotes_trabalho_updated BEFORE UPDATE ON public.pacotes_trabalho FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_restricoes_updated BEFORE UPDATE ON public.restricoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_lead_time_templates_updated BEFORE UPDATE ON public.lead_time_templates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_checklist_updated BEFORE UPDATE ON public.card_checklist_itens FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_comentarios_updated BEFORE UPDATE ON public.card_comentarios FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_local_updated BEFORE UPDATE ON public.card_local FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_campos_valores_updated BEFORE UPDATE ON public.card_campos_valores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_card_board_posicao_updated BEFORE UPDATE ON public.card_board_posicao FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
