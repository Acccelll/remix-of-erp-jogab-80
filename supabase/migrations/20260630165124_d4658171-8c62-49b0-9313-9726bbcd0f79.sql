CREATE OR REPLACE FUNCTION public.fn_cards_automacoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ator uuid := auth.uid();
  v_nome text;
BEGIN
  SELECT login INTO v_nome FROM public.profiles WHERE id = v_ator;

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
$function$;