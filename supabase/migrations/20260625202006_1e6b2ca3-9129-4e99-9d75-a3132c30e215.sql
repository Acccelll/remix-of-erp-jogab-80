
-- Normalização de título sem depender de unaccent: lower + translate dos acentos comuns
CREATE OR REPLACE FUNCTION public.fn_nc_normalize_titulo(p_titulo text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT trim(regexp_replace(
           lower(translate(
             coalesce(p_titulo, ''),
             'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
             'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
           )),
           '[^a-z0-9]+', ' ', 'g'
         ));
$$;

CREATE INDEX IF NOT EXISTS idx_nc_obra_titulo_norm
  ON public.nao_conformidades (obra_id, (public.fn_nc_normalize_titulo(titulo)));

CREATE OR REPLACE FUNCTION public.fn_nc_detect_reincidencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anterior uuid;
  v_titulo_norm text;
BEGIN
  IF NEW.reincidencia_de IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_titulo_norm := public.fn_nc_normalize_titulo(NEW.titulo);

  IF NEW.resposta_id IS NOT NULL THEN
    SELECT id INTO v_anterior
    FROM public.nao_conformidades
    WHERE resposta_id = NEW.resposta_id
      AND id <> NEW.id
      AND created_at >= now() - interval '180 days'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_anterior IS NULL AND NEW.obra_id IS NOT NULL AND length(v_titulo_norm) >= 4 THEN
    SELECT id INTO v_anterior
    FROM public.nao_conformidades
    WHERE obra_id = NEW.obra_id
      AND id <> NEW.id
      AND public.fn_nc_normalize_titulo(titulo) = v_titulo_norm
      AND created_at >= now() - interval '180 days'
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_anterior IS NOT NULL THEN
    NEW.reincidencia_de := v_anterior;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nc_reincidencia ON public.nao_conformidades;
CREATE TRIGGER trg_nc_reincidencia
  BEFORE INSERT ON public.nao_conformidades
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_nc_detect_reincidencia();
