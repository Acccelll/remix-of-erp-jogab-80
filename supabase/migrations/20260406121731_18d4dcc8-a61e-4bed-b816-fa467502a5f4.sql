
CREATE OR REPLACE FUNCTION get_folha_rateada(p_colaborador_id TEXT, p_obra_id TEXT)
RETURNS TABLE (competencia TEXT, provento_total NUMERIC, desconto_total NUMERIC)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH dias_por_obra AS (
    SELECT
      to_char(d.dia, 'YYYY-MM') AS comp,
      mp.obra_id AS oid,
      COUNT(*)::NUMERIC AS dias
    FROM mobilizacoes_periodos mp
    CROSS JOIN LATERAL generate_series(
      mp.data_inicio,
      COALESCE(mp.data_fim, CURRENT_DATE),
      '1 day'::interval
    ) AS d(dia)
    WHERE mp.colaborador_id = p_colaborador_id
    GROUP BY comp, mp.obra_id
  ),
  dias_totais AS (
    SELECT comp, SUM(dias) AS total_dias
    FROM dias_por_obra
    GROUP BY comp
  ),
  proporcao AS (
    SELECT
      dpo.comp,
      CASE WHEN dt.total_dias > 0 THEN dpo.dias / dt.total_dias ELSE 0 END AS fator
    FROM dias_por_obra dpo
    JOIN dias_totais dt ON dt.comp = dpo.comp
    WHERE dpo.oid = p_obra_id
  )
  SELECT
    fe.competencia,
    ROUND(SUM(CASE WHEN fe.tipo = 'provento' OR fe.tipo = 'base' THEN fe.valor ELSE 0 END) * COALESCE(p.fator, 0), 2) AS provento_total,
    ROUND(SUM(CASE WHEN fe.tipo = 'desconto' THEN fe.valor ELSE 0 END) * COALESCE(p.fator, 0), 2) AS desconto_total
  FROM fopag_entries fe
  LEFT JOIN proporcao p ON p.comp = fe.competencia
  WHERE fe.colaborador_id = p_colaborador_id
  GROUP BY fe.competencia, p.fator
  ORDER BY fe.competencia;
END;
$$;
