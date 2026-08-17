
-- ============= Notificações de NCs =============

-- 1) Atribuição / reatribuição
CREATE OR REPLACE FUNCTION public.fn_nc_notify_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_nome text;
  v_should_notify boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_should_notify := NEW.quem IS NOT NULL AND NEW.status NOT IN ('resolvida','cancelada');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_notify := NEW.quem IS NOT NULL
      AND NEW.quem IS DISTINCT FROM OLD.quem
      AND NEW.status NOT IN ('resolvida','cancelada');
  END IF;

  IF NOT v_should_notify THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_obra_nome FROM public.obras WHERE id = NEW.obra_id;

  INSERT INTO public.notificacoes (user_id, tipo, card_id, texto, lida)
  VALUES (
    NEW.quem,
    'nc_atribuicao',
    NEW.card_id,
    format('NC %s atribuída a você: %s%s',
      coalesce(NEW.codigo, ''),
      NEW.titulo,
      CASE WHEN v_obra_nome IS NOT NULL THEN ' — ' || v_obra_nome ELSE '' END
    ),
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_notify_assign_ins ON public.nao_conformidades;
CREATE TRIGGER trg_nc_notify_assign_ins
  AFTER INSERT ON public.nao_conformidades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_nc_notify_assignment();

DROP TRIGGER IF EXISTS trg_nc_notify_assign_upd ON public.nao_conformidades;
CREATE TRIGGER trg_nc_notify_assign_upd
  AFTER UPDATE OF quem ON public.nao_conformidades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_nc_notify_assignment();

-- 2) Notificações de prazo (vencendo em <=2 dias ou vencido)
-- Idempotente: não duplica notificações de prazo da mesma NC no mesmo dia.
CREATE OR REPLACE FUNCTION public.fn_nc_notificar_prazos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_rec record;
  v_obra_nome text;
  v_dias integer;
  v_texto text;
BEGIN
  FOR v_rec IN
    SELECT n.id, n.codigo, n.titulo, n.obra_id, n.quem, n.quando_planejado
    FROM public.nao_conformidades n
    WHERE n.quem IS NOT NULL
      AND n.quando_planejado IS NOT NULL
      AND n.status NOT IN ('resolvida','cancelada')
      AND n.quando_planejado <= (current_date + interval '2 days')
  LOOP
    -- dedupe: já existe notificação de prazo desta NC criada hoje?
    IF EXISTS (
      SELECT 1 FROM public.notificacoes
      WHERE user_id = v_rec.quem
        AND tipo = 'nc_prazo'
        AND created_at::date = current_date
        AND texto LIKE '%[NC:' || v_rec.id::text || ']%'
    ) THEN
      CONTINUE;
    END IF;

    SELECT nome INTO v_obra_nome FROM public.obras WHERE id = v_rec.obra_id;
    v_dias := v_rec.quando_planejado - current_date;

    v_texto := format(
      '%s NC %s — %s%s [NC:%s]',
      CASE
        WHEN v_dias < 0 THEN format('Prazo VENCIDO há %s dia(s):', abs(v_dias))
        WHEN v_dias = 0 THEN 'Prazo vence HOJE:'
        ELSE format('Prazo em %s dia(s):', v_dias)
      END,
      coalesce(v_rec.codigo, ''),
      v_rec.titulo,
      CASE WHEN v_obra_nome IS NOT NULL THEN ' — ' || v_obra_nome ELSE '' END,
      v_rec.id
    );

    INSERT INTO public.notificacoes (user_id, tipo, card_id, texto, lida)
    VALUES (v_rec.quem, 'nc_prazo', NULL, v_texto, false);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_nc_notificar_prazos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_nc_notificar_prazos() TO authenticated, service_role;
