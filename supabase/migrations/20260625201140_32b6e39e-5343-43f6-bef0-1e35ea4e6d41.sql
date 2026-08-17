
-- Agendamento de inspeções recorrentes (INSP.5b)
CREATE TABLE public.inspecao_agendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo_id UUID NOT NULL REFERENCES public.inspecao_modelos(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  titulo TEXT,
  local TEXT,
  responsavel_id UUID REFERENCES auth.users(id),
  frequencia TEXT NOT NULL CHECK (frequencia IN ('diaria','semanal','quinzenal','mensal')),
  dias_semana SMALLINT[] DEFAULT NULL, -- 0=domingo..6=sábado (para semanal/quinzenal)
  dia_mes SMALLINT DEFAULT NULL,       -- 1..31 (para mensal)
  hora_alvo TIME DEFAULT '08:00',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  proxima_data DATE,
  ultima_geracao_em TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspecao_agendas TO authenticated;
GRANT ALL ON public.inspecao_agendas TO service_role;

ALTER TABLE public.inspecao_agendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read agendas"
  ON public.inspecao_agendas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can write agendas"
  ON public.inspecao_agendas FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update agendas"
  ON public.inspecao_agendas FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete agendas"
  ON public.inspecao_agendas FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_inspecao_agendas_touch
  BEFORE UPDATE ON public.inspecao_agendas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_inspecao_agendas_obra ON public.inspecao_agendas(obra_id, ativa);
CREATE INDEX idx_inspecao_agendas_proxima ON public.inspecao_agendas(proxima_data) WHERE ativa = true;

-- Função: avança proxima_data para a próxima ocorrência válida >= ref
CREATE OR REPLACE FUNCTION public.fn_inspecao_proxima_data(
  p_frequencia TEXT,
  p_dias_semana SMALLINT[],
  p_dia_mes SMALLINT,
  p_data_inicio DATE,
  p_ref DATE
) RETURNS DATE
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_base DATE := GREATEST(p_data_inicio, p_ref);
  v_d DATE;
  v_i INT := 0;
BEGIN
  IF p_frequencia = 'diaria' THEN
    RETURN v_base;
  END IF;

  IF p_frequencia IN ('semanal','quinzenal') THEN
    IF p_dias_semana IS NULL OR array_length(p_dias_semana,1) IS NULL THEN
      RETURN v_base;
    END IF;
    -- procura nos próximos 21 dias
    WHILE v_i < 21 LOOP
      v_d := v_base + v_i;
      IF EXTRACT(DOW FROM v_d)::SMALLINT = ANY(p_dias_semana) THEN
        IF p_frequencia = 'quinzenal' THEN
          -- quinzenal: aceita apenas semanas pares contando desde data_inicio
          IF ((v_d - p_data_inicio) / 7) % 2 = 0 THEN
            RETURN v_d;
          END IF;
        ELSE
          RETURN v_d;
        END IF;
      END IF;
      v_i := v_i + 1;
    END LOOP;
    RETURN v_base;
  END IF;

  IF p_frequencia = 'mensal' THEN
    IF p_dia_mes IS NULL THEN RETURN v_base; END IF;
    v_d := make_date(EXTRACT(YEAR FROM v_base)::INT, EXTRACT(MONTH FROM v_base)::INT, LEAST(p_dia_mes, 28));
    IF v_d < v_base THEN
      v_d := (v_d + INTERVAL '1 month')::DATE;
    END IF;
    RETURN v_d;
  END IF;

  RETURN v_base;
END $$;

-- Função: materializa inspeções pendentes para agendas ativas (uma por proxima_data).
-- Cria registros em public.inspecoes com status 'rascunho' (idempotente: 1 por agenda+data).
CREATE OR REPLACE FUNCTION public.fn_inspecao_materializar_pendentes(p_ate DATE DEFAULT CURRENT_DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a RECORD;
  v_count INT := 0;
  v_existe UUID;
  v_prox DATE;
BEGIN
  FOR v_a IN
    SELECT * FROM public.inspecao_agendas
    WHERE ativa = true
      AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
  LOOP
    v_prox := COALESCE(
      v_a.proxima_data,
      public.fn_inspecao_proxima_data(v_a.frequencia, v_a.dias_semana, v_a.dia_mes, v_a.data_inicio, GREATEST(v_a.data_inicio, CURRENT_DATE))
    );

    WHILE v_prox IS NOT NULL AND v_prox <= p_ate LOOP
      -- evita duplicar inspeção para a mesma agenda + data_planejada
      SELECT id INTO v_existe
        FROM public.inspecoes
       WHERE modelo_id = v_a.modelo_id
         AND obra_id = v_a.obra_id
         AND data_planejada = v_prox
         AND COALESCE(local,'') = COALESCE(v_a.local,'')
       LIMIT 1;

      IF v_existe IS NULL THEN
        INSERT INTO public.inspecoes (
          modelo_id, obra_id, local, responsavel_id, data_planejada, status, created_by
        ) VALUES (
          v_a.modelo_id, v_a.obra_id, v_a.local, v_a.responsavel_id, v_prox, 'rascunho', v_a.created_by
        );
        v_count := v_count + 1;
      END IF;

      -- avança a próxima ocorrência
      v_prox := public.fn_inspecao_proxima_data(
        v_a.frequencia, v_a.dias_semana, v_a.dia_mes, v_a.data_inicio,
        (v_prox + CASE WHEN v_a.frequencia = 'diaria' THEN 1 ELSE 1 END)::DATE
      );
    END LOOP;

    UPDATE public.inspecao_agendas
       SET proxima_data = v_prox,
           ultima_geracao_em = now()
     WHERE id = v_a.id;
  END LOOP;

  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_inspecao_materializar_pendentes(DATE) TO authenticated;
