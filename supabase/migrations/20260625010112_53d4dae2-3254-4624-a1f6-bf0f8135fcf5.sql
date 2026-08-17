
-- =====================================================================
-- Passo 1.8 — Automação de domínio: triggers de atividade, notificação
-- de checklist 100% e auto-arquivar.
-- =====================================================================

-- 1) Trigger em cards: registra atividades automáticas + notifica novo responsável
CREATE OR REPLACE FUNCTION public.fn_cards_automacoes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ator uuid := auth.uid();
  v_nome text;
BEGIN
  SELECT nome INTO v_nome FROM public.profiles WHERE id = v_ator;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.card_atividades(card_id, ator_id, ator_nome, evento, detalhe)
    VALUES (NEW.id, v_ator, v_nome, 'status_alterado',
            jsonb_build_object('de', OLD.status, 'para', NEW.status));
  END IF;

  IF NEW.prazo IS DISTINCT FROM OLD.prazo THEN
    INSERT INTO public.card_atividades(card_id, ator_id, ator_nome, evento, detalhe)
    VALUES (NEW.id, v_ator, v_nome, 'prazo_alterado',
            jsonb_build_object('de', OLD.prazo, 'para', NEW.prazo));
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.card_atividades(card_id, ator_id, ator_nome, evento, detalhe)
    VALUES (NEW.id, v_ator, v_nome, 'responsavel_alterado',
            jsonb_build_object('de', OLD.responsavel_id, 'para', NEW.responsavel_id));

    IF NEW.responsavel_id IS NOT NULL AND NEW.responsavel_id <> COALESCE(v_ator, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notificacoes(user_id, tipo, card_id, mensagem)
      VALUES (NEW.responsavel_id, 'card_atribuido', NEW.id,
              'Você foi atribuído ao card "' || COALESCE(NEW.titulo,'(sem título)') || '"');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cards_automacoes ON public.cards;
CREATE TRIGGER trg_cards_automacoes
AFTER UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.fn_cards_automacoes();

-- 2) Trigger em card_checklist_itens: notifica quando checklist fica 100%
CREATE OR REPLACE FUNCTION public.fn_checklist_completo_notifica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_card_id uuid := COALESCE(NEW.card_id, OLD.card_id);
  v_total int;
  v_feitos int;
  v_resp uuid;
  v_titulo text;
  v_ator uuid := auth.uid();
BEGIN
  SELECT count(*), count(*) FILTER (WHERE concluido)
    INTO v_total, v_feitos
    FROM public.card_checklist_itens
   WHERE card_id = v_card_id;

  IF v_total = 0 OR v_feitos < v_total THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT responsavel_id, titulo INTO v_resp, v_titulo
    FROM public.cards WHERE id = v_card_id;

  IF v_resp IS NULL OR v_resp = COALESCE(v_ator, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Dedup: não notificar se já houver notificação 'checklist_completo' não lida para este card+usuário
  IF EXISTS (
    SELECT 1 FROM public.notificacoes
     WHERE user_id = v_resp AND card_id = v_card_id
       AND tipo = 'checklist_completo' AND lida = false
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.notificacoes(user_id, tipo, card_id, mensagem)
  VALUES (v_resp, 'checklist_completo', v_card_id,
          'Checklist 100% concluído no card "' || COALESCE(v_titulo,'(sem título)') || '"');

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_completo ON public.card_checklist_itens;
CREATE TRIGGER trg_checklist_completo
AFTER INSERT OR UPDATE OR DELETE ON public.card_checklist_itens
FOR EACH ROW EXECUTE FUNCTION public.fn_checklist_completo_notifica();

-- 3) Função de auto-arquivar cards concluídos há mais de 30 dias
CREATE OR REPLACE FUNCTION public.fn_auto_arquivar_concluidos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_count int;
BEGIN
  WITH ult AS (
    SELECT card_id, max(created_at) AS quando
      FROM public.card_atividades
     WHERE evento = 'status_alterado'
       AND (detalhe->>'para') = 'concluido'
     GROUP BY card_id
  ),
  upd AS (
    UPDATE public.cards c
       SET arquivado = true
      FROM ult
     WHERE c.id = ult.card_id
       AND c.status = 'concluido'
       AND c.arquivado = false
       AND ult.quando < now() - interval '30 days'
     RETURNING c.id
  )
  SELECT count(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_auto_arquivar_concluidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_auto_arquivar_concluidos() TO service_role;
