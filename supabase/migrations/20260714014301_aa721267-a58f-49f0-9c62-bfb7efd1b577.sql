
CREATE OR REPLACE FUNCTION public.dp_assert_competencia_aberta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_comp text;
  v_fech public.dp_fechamento_competencia;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_comp := OLD.competencia;
  ELSE
    v_comp := NEW.competencia;
    IF TG_OP = 'UPDATE' AND OLD.competencia IS DISTINCT FROM NEW.competencia THEN
      -- também checa a competência antiga
      SELECT * INTO v_fech FROM public.dp_fechamento_competencia
       WHERE competencia = OLD.competencia AND reaberto_em IS NULL
       ORDER BY fechado_em DESC LIMIT 1;
      IF FOUND AND NOT public.current_is_gm() THEN
        RAISE EXCEPTION 'Competência % está fechada (desde %). Reabra antes de alterar.',
          OLD.competencia, to_char(v_fech.fechado_em, 'YYYY-MM-DD')
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_fech FROM public.dp_fechamento_competencia
   WHERE competencia = v_comp AND reaberto_em IS NULL
   ORDER BY fechado_em DESC LIMIT 1;

  IF FOUND AND NOT public.current_is_gm() THEN
    RAISE EXCEPTION 'Competência % está fechada (desde %). Reabra antes de alterar.',
      v_comp, to_char(v_fech.fechado_em, 'YYYY-MM-DD')
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dp_holerite_comp_aberta ON public.dp_holerite;
CREATE TRIGGER trg_dp_holerite_comp_aberta
BEFORE INSERT OR UPDATE OR DELETE ON public.dp_holerite
FOR EACH ROW EXECUTE FUNCTION public.dp_assert_competencia_aberta();

DROP TRIGGER IF EXISTS trg_horas_extras_comp_aberta ON public.horas_extras;
CREATE TRIGGER trg_horas_extras_comp_aberta
BEFORE INSERT OR UPDATE OR DELETE ON public.horas_extras
FOR EACH ROW EXECUTE FUNCTION public.dp_assert_competencia_aberta();
