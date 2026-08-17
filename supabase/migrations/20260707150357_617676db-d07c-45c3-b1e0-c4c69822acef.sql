ALTER TYPE public.card_status ADD VALUE IF NOT EXISTS 'aguardando';

ALTER TABLE public.card_checklist_itens ADD COLUMN IF NOT EXISTS grupo text;
ALTER TABLE public.card_checklist_itens ADD COLUMN IF NOT EXISTS responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.card_checklist_itens ADD COLUMN IF NOT EXISTS prazo date;
CREATE INDEX IF NOT EXISTS idx_card_checklist_itens_responsavel ON public.card_checklist_itens(responsavel_id);

ALTER TABLE public.card_comentarios ADD COLUMN IF NOT EXISTS autor text;
ALTER TABLE public.card_comentarios ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.card_comentarios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_card_comentarios_reply_to ON public.card_comentarios(reply_to);

ALTER TABLE public.card_anexos ADD COLUMN IF NOT EXISTS enviado_por text;

CREATE TABLE IF NOT EXISTS public.card_membros (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros TO authenticated;
GRANT ALL ON public.card_membros TO service_role;
ALTER TABLE public.card_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_membros_auth_all" ON public.card_membros;
CREATE POLICY "card_membros_auth_all" ON public.card_membros FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_secoes_visiveis (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  secao text NOT NULL,
  criado_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, secao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_secoes_visiveis TO authenticated;
GRANT ALL ON public.card_secoes_visiveis TO service_role;
ALTER TABLE public.card_secoes_visiveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_secoes_visiveis_auth_all" ON public.card_secoes_visiveis;
CREATE POLICY "card_secoes_visiveis_auth_all" ON public.card_secoes_visiveis FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_local (
  card_id uuid PRIMARY KEY REFERENCES public.cards(id) ON DELETE CASCADE,
  endereco text,
  lat numeric,
  lng numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_local TO authenticated;
GRANT ALL ON public.card_local TO service_role;
ALTER TABLE public.card_local ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_local_auth_all" ON public.card_local;
CREATE POLICY "card_local_auth_all" ON public.card_local FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_card_local_touch_updated_at ON public.card_local;
CREATE TRIGGER trg_card_local_touch_updated_at BEFORE UPDATE ON public.card_local FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.card_campos_valores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES public.board_campos(id) ON DELETE CASCADE,
  valor jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, campo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_campos_valores TO authenticated;
GRANT ALL ON public.card_campos_valores TO service_role;
ALTER TABLE public.card_campos_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_campos_valores_auth_all" ON public.card_campos_valores;
CREATE POLICY "card_campos_valores_auth_all" ON public.card_campos_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_card_campos_valores_touch_updated_at ON public.card_campos_valores;
CREATE TRIGGER trg_card_campos_valores_touch_updated_at BEFORE UPDATE ON public.card_campos_valores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();