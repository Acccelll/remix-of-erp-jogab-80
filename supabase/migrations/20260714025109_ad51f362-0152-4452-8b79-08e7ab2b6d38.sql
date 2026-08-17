CREATE OR REPLACE FUNCTION public.medicao_status_transition_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'enviada' THEN
      IF OLD.status NOT IN ('rascunho', 'em_revisao', 'rejeitada') THEN
        RAISE EXCEPTION 'Transição inválida para medição enviada';
      END IF;
      IF NOT public.user_pode_editar_obra(NEW.obra_id) THEN
        RAISE EXCEPTION 'Sem permissão para enviar medição desta obra';
      END IF;
    ELSIF NEW.status IN ('aprovada', 'rejeitada') THEN
      IF OLD.status <> 'enviada' THEN
        RAISE EXCEPTION 'Medição precisa estar enviada para aprovação/rejeição';
      END IF;
      IF NOT public.user_pode_aprovar_medicao(NEW.obra_id) THEN
        RAISE EXCEPTION 'Apenas fiscalização/qualidade/engenharia pode aprovar ou rejeitar medição';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicao_status_transition_guard ON public.medicoes;
CREATE TRIGGER trg_medicao_status_transition_guard
BEFORE UPDATE OF status ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.medicao_status_transition_guard();

CREATE OR REPLACE FUNCTION public.medicao_status_history_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao text;
  v_login text;
  v_motivo text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'enviada' THEN
      v_acao := 'enviar';
      v_login := NEW.enviada_por;
      v_motivo := NULL;
    ELSIF NEW.status = 'aprovada' THEN
      v_acao := 'aprovar';
      v_login := NEW.aprovada_por;
      v_motivo := NULL;
    ELSIF NEW.status = 'rejeitada' THEN
      v_acao := 'rejeitar';
      v_login := NEW.rejeitada_por;
      v_motivo := NEW.rejeicao_motivo;
    ELSE
      RETURN NEW;
    END IF;

    INSERT INTO public.historico_medicao (
      medicao_id,
      obra_id,
      status_anterior,
      status_novo,
      acao,
      responsavel_id,
      responsavel_login,
      motivo
    ) VALUES (
      NEW.id,
      NEW.obra_id,
      OLD.status,
      NEW.status,
      v_acao,
      auth.uid(),
      NULLIF(v_login, ''),
      NULLIF(v_motivo, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_medicao_status_history_after_update ON public.medicoes;
CREATE TRIGGER trg_medicao_status_history_after_update
AFTER UPDATE OF status ON public.medicoes
FOR EACH ROW EXECUTE FUNCTION public.medicao_status_history_after_update();