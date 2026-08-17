CREATE OR REPLACE FUNCTION public.fn_notificar_prazos_proximos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inseridos int := 0;
BEGIN
  WITH alvos AS (
    -- responsável
    SELECT c.id AS card_id, c.titulo, c.prazo, c.responsavel_id AS user_id
      FROM public.cards c
     WHERE c.tipo = 'generico'
       AND c.arquivado = false
       AND c.status <> 'concluido'
       AND c.prazo IS NOT NULL
       AND c.prazo <= CURRENT_DATE
       AND c.responsavel_id IS NOT NULL
    UNION
    -- membros
    SELECT c.id, c.titulo, c.prazo, m.user_id
      FROM public.cards c
      JOIN public.card_membros m ON m.card_id = c.id
     WHERE c.tipo = 'generico'
       AND c.arquivado = false
       AND c.status <> 'concluido'
       AND c.prazo IS NOT NULL
       AND c.prazo <= CURRENT_DATE
  ),
  classificados AS (
    SELECT
      a.card_id, a.user_id, a.titulo, a.prazo,
      CASE WHEN a.prazo < CURRENT_DATE THEN 'prazo_vencido' ELSE 'prazo_hoje' END AS tipo,
      CASE
        WHEN a.prazo < CURRENT_DATE
          THEN 'Card vencido há ' || (CURRENT_DATE - a.prazo) || 'd: "' || COALESCE(a.titulo,'(sem título)') || '"'
        ELSE 'Card vence hoje: "' || COALESCE(a.titulo,'(sem título)') || '"'
      END AS texto
    FROM alvos a
  ),
  novos AS (
    INSERT INTO public.notificacoes(user_id, tipo, card_id, texto)
    SELECT c.user_id, c.tipo, c.card_id, c.texto
      FROM classificados c
     WHERE NOT EXISTS (
       SELECT 1 FROM public.notificacoes n
        WHERE n.user_id = c.user_id
          AND n.card_id = c.card_id
          AND n.tipo IN ('prazo_hoje','prazo_vencido')
          AND n.created_at > now() - interval '20 hours'
     )
    RETURNING 1
  )
  SELECT count(*) INTO v_inseridos FROM novos;
  RETURN v_inseridos;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_notificar_prazos_proximos() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_notificar_prazos_proximos() TO service_role;