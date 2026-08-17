
-- Switch SECURITY DEFINER helper/RPC functions callable by authenticated to SECURITY INVOKER,
-- so they run under the caller's privileges and cannot be used to bypass RLS.

CREATE OR REPLACE FUNCTION public.current_player_has_access(_module text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.players pl ON pl.login = pr.login
    WHERE pr.id = auth.uid()
      AND (
        pl.is_gm = true
        OR COALESCE(pl.acessos->>_module, 'nenhum') IN ('editar','visualizar')
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_current_player_gm()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.players  pl ON pl.login = pr.login
    WHERE pr.id = auth.uid() AND pl.is_gm = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE r jsonb;
BEGIN
  IF p_resultados IS NULL OR jsonb_typeof(p_resultados) <> 'array' THEN RETURN; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_resultados) LOOP
    UPDATE public.cronograma_itens
       SET data_inicio_cpm = NULLIF(r->>'data_inicio_cpm','')::timestamptz,
           data_fim_cpm    = NULLIF(r->>'data_fim_cpm','')::timestamptz,
           folga_total     = NULLIF(r->>'folga_total','')::numeric,
           caminho_critico = COALESCE((r->>'caminho_critico')::boolean, false)
     WHERE obra_id = p_obra_id
       AND id = (r->>'item_id')::uuid;
  END LOOP;
END $function$;
