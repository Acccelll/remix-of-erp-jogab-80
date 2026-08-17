
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
      INSERT INTO public.notificacoes(user_id, tipo, card_id, texto)
      VALUES (NEW.responsavel_id, 'card_atribuido', NEW.id,
              'Você foi atribuído ao card "' || COALESCE(NEW.titulo,'(sem título)') || '"');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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

  IF EXISTS (
    SELECT 1 FROM public.notificacoes
     WHERE user_id = v_resp AND card_id = v_card_id
       AND tipo = 'checklist_completo' AND lida = false
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.notificacoes(user_id, tipo, card_id, texto)
  VALUES (v_resp, 'checklist_completo', v_card_id,
          'Checklist 100% concluído no card "' || COALESCE(v_titulo,'(sem título)') || '"');

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fn_cards_automacoes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_checklist_completo_notifica() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_cards_automacoes() TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_checklist_completo_notifica() TO service_role;
