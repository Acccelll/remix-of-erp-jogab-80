
DO $$ BEGIN
  CREATE TYPE public.board_campo_tipo AS ENUM ('texto','numero','data','dropdown','checkbox');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.board_papel AS ENUM ('admin','membro','observador');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.board_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo public.board_campo_tipo NOT NULL,
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_board_campos_board ON public.board_campos(board_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_campos TO authenticated;
GRANT ALL ON public.board_campos TO service_role;
ALTER TABLE public.board_campos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_campos_select" ON public.board_campos;
CREATE POLICY "board_campos_select" ON public.board_campos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "board_campos_write" ON public.board_campos;
CREATE POLICY "board_campos_write" ON public.board_campos
  FOR ALL TO authenticated
  USING (public.is_gm_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()))
  WITH CHECK (public.is_gm_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.card_campos_valores (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  campo_id uuid NOT NULL REFERENCES public.board_campos(id) ON DELETE CASCADE,
  valor jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, campo_id)
);
CREATE INDEX IF NOT EXISTS idx_card_campos_valores_card ON public.card_campos_valores(card_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_campos_valores TO authenticated;
GRANT ALL ON public.card_campos_valores TO service_role;
ALTER TABLE public.card_campos_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "card_campos_valores_all" ON public.card_campos_valores;
CREATE POLICY "card_campos_valores_all" ON public.card_campos_valores FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.board_membros (
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.board_papel NOT NULL DEFAULT 'membro',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_board_membros_user ON public.board_membros(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_membros TO authenticated;
GRANT ALL ON public.board_membros TO service_role;
ALTER TABLE public.board_membros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_membros_select_self" ON public.board_membros;
CREATE POLICY "board_membros_select_self" ON public.board_membros
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gm_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()));
DROP POLICY IF EXISTS "board_membros_write_owner" ON public.board_membros;
CREATE POLICY "board_membros_write_owner" ON public.board_membros
  FOR ALL TO authenticated
  USING (public.is_gm_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()))
  WITH CHECK (public.is_gm_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.boards b WHERE b.id = board_id AND b.owner_id = auth.uid()));

-- notificacoes já existe (id, user_id, tipo, card_id, texto NOT NULL, mensagem, lida, created_at)
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS contexto jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_notif_user_lida ON public.notificacoes(user_id, lida, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notificacoes_self" ON public.notificacoes;
CREATE POLICY "notificacoes_self" ON public.notificacoes
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.trg_notificar_novo_comentario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_responsavel uuid;
  v_autor_profile uuid;
  v_login text;
  v_user_id uuid;
  v_resumo text;
BEGIN
  SELECT responsavel_id INTO v_responsavel FROM public.cards WHERE id = NEW.card_id;
  SELECT id INTO v_autor_profile FROM public.profiles WHERE login = NEW.autor LIMIT 1;
  v_resumo := left(coalesce(NEW.texto,''), 200);

  IF v_responsavel IS NOT NULL AND v_responsavel <> COALESCE(v_autor_profile, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notificacoes(user_id, card_id, tipo, texto, contexto)
    VALUES (v_responsavel, NEW.card_id, 'comentario', v_resumo,
      jsonb_build_object('autor', NEW.autor, 'comentario_id', NEW.id));
  END IF;

  FOR v_login IN
    SELECT DISTINCT lower(substring(m[1] FROM 2))
    FROM regexp_matches(COALESCE(NEW.texto,''), '(@[A-Za-z0-9_.-]+)', 'g') AS m
  LOOP
    SELECT id INTO v_user_id FROM public.profiles WHERE lower(login) = v_login LIMIT 1;
    IF v_user_id IS NOT NULL
       AND v_user_id <> COALESCE(v_autor_profile, '00000000-0000-0000-0000-000000000000'::uuid)
       AND v_user_id <> COALESCE(v_responsavel,    '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notificacoes(user_id, card_id, tipo, texto, contexto)
      VALUES (v_user_id, NEW.card_id, 'mencao', v_resumo,
        jsonb_build_object('autor', NEW.autor, 'comentario_id', NEW.id));
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notif_comentario ON public.card_comentarios;
CREATE TRIGGER trg_notif_comentario AFTER INSERT ON public.card_comentarios
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_novo_comentario();

CREATE OR REPLACE FUNCTION public.trg_notificar_responsavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.responsavel_id IS NOT NULL
     AND NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id
     AND NEW.responsavel_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notificacoes(user_id, card_id, tipo, texto, contexto)
    VALUES (NEW.responsavel_id, NEW.id, 'responsavel',
      'Você foi atribuído a um card.',
      jsonb_build_object('antigo', OLD.responsavel_id));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notif_responsavel ON public.cards;
CREATE TRIGGER trg_notif_responsavel AFTER UPDATE OF responsavel_id ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.trg_notificar_responsavel();
