-- ETAPA 6 — Correção semântica da auditoria de status.
-- Reabertura é somente cancelado -> ativo; alterações causadas pelo ledger continuam status_alterado.

CREATE OR REPLACE FUNCTION private.fn_auditar_financeiro_canonico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_titulo_id uuid;
  v_baixa_id uuid;
  v_entidade text;
  v_entidade_id uuid;
  v_evento text;
  v_ator_id uuid := auth.uid();
  v_ator_login text;
  v_origem text;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  IF v_ator_id IS NOT NULL THEN
    SELECT pr.login INTO v_ator_login
    FROM public.profiles pr
    WHERE pr.id = v_ator_id;
  END IF;

  v_origem := CASE WHEN v_ator_id IS NULL THEN 'sistema' ELSE 'app' END;

  IF TG_TABLE_NAME = 'financeiro_titulos' THEN
    v_titulo_id := COALESCE(NEW.id, OLD.id);
    v_entidade := 'titulo';
    v_entidade_id := v_titulo_id;
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;

    IF TG_OP = 'INSERT' THEN
      v_evento := 'titulo_criado';
    ELSIF TG_OP = 'DELETE' THEN
      v_evento := 'titulo_excluido';
    ELSIF OLD.status IS DISTINCT FROM NEW.status
       AND (to_jsonb(OLD) - 'status' - 'atualizado_em' - 'atualizado_por' - 'cancelado_em' - 'cancelado_por')
         = (to_jsonb(NEW) - 'status' - 'atualizado_em' - 'atualizado_por' - 'cancelado_em' - 'cancelado_por') THEN
      v_evento := CASE
        WHEN NEW.status = 'cancelado' THEN 'titulo_cancelado'
        WHEN OLD.status = 'cancelado' AND NEW.status <> 'cancelado' THEN 'titulo_reaberto'
        ELSE 'status_alterado'
      END;
    ELSIF (to_jsonb(OLD) - 'atualizado_em' - 'atualizado_por')
          = (to_jsonb(NEW) - 'atualizado_em' - 'atualizado_por') THEN
      RETURN NEW;
    ELSE
      v_evento := 'titulo_alterado';
    END IF;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_rateios' THEN
    v_titulo_id := COALESCE(NEW.titulo_id, OLD.titulo_id);
    v_entidade := 'rateio';
    v_entidade_id := COALESCE(NEW.id, OLD.id);
    v_antes := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
    v_depois := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
    v_evento := CASE TG_OP
      WHEN 'INSERT' THEN 'rateio_criado'
      WHEN 'UPDATE' THEN 'rateio_alterado'
      ELSE 'rateio_removido'
    END;

  ELSIF TG_TABLE_NAME = 'financeiro_titulo_baixas' THEN
    v_titulo_id := NEW.titulo_id;
    v_baixa_id := NEW.id;
    v_entidade := 'baixa';
    v_entidade_id := NEW.id;
    v_antes := NULL;
    v_depois := to_jsonb(NEW);
    v_evento := CASE WHEN NEW.tipo_movimento = 'estorno' THEN 'baixa_estornada' ELSE 'baixa_registrada' END;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.financeiro_titulo_eventos (
    titulo_id, baixa_id, entidade, entidade_id, evento,
    ator_id, ator_login, origem, dados_antes, dados_depois,
    metadata
  ) VALUES (
    v_titulo_id, v_baixa_id, v_entidade, v_entidade_id, v_evento,
    v_ator_id, v_ator_login, v_origem, v_antes, v_depois,
    jsonb_build_object('operacao_sql', TG_OP, 'tabela', TG_TABLE_NAME)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION private.fn_auditar_financeiro_canonico() FROM PUBLIC;
