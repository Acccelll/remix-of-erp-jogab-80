
CREATE UNIQUE INDEX IF NOT EXISTS obras_codigo_unique
  ON public.obras (codigo) WHERE codigo IS NOT NULL;

INSERT INTO public.clientes (nome)
SELECT DISTINCT btrim(o.cliente)
FROM public.obras o
WHERE o.cliente IS NOT NULL AND btrim(o.cliente) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE lower(btrim(c.nome)) = lower(btrim(o.cliente))
  );

UPDATE public.obras o
SET cliente_id = c.id
FROM public.clientes c
WHERE o.cliente_id IS NULL
  AND o.cliente IS NOT NULL
  AND lower(btrim(c.nome)) = lower(btrim(o.cliente));

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS data_inicio    date,
  ADD COLUMN IF NOT EXISTS due_complete   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_color    text,
  ADD COLUMN IF NOT EXISTS cover_url      text,
  ADD COLUMN IF NOT EXISTS posicao        numeric,
  ADD COLUMN IF NOT EXISTS origem_externa text,
  ADD COLUMN IF NOT EXISTS origem_url     text,
  ADD COLUMN IF NOT EXISTS origem_id      text;

CREATE INDEX IF NOT EXISTS cards_origem_externa_idx
  ON public.cards (origem_externa, origem_id) WHERE origem_externa IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.card_membros_externos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  fonte       text NOT NULL DEFAULT 'trello',
  external_id text,
  nome        text NOT NULL,
  username    text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, fonte, external_id)
);
CREATE INDEX IF NOT EXISTS card_membros_externos_card_idx
  ON public.card_membros_externos (card_id);
ALTER TABLE public.card_membros_externos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS card_membros_externos_all ON public.card_membros_externos;
CREATE POLICY card_membros_externos_all ON public.card_membros_externos
  FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.card_custom_fields (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte       text NOT NULL DEFAULT 'trello',
  external_id text,
  nome        text NOT NULL,
  tipo        text NOT NULL,
  options     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fonte, external_id)
);

CREATE TABLE IF NOT EXISTS public.card_custom_field_valores (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id      uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  field_id     uuid NOT NULL REFERENCES public.card_custom_fields(id) ON DELETE CASCADE,
  valor_texto  text,
  valor_numero numeric,
  valor_data   timestamptz,
  valor_bool   boolean,
  valor_option text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (card_id, field_id)
);
CREATE INDEX IF NOT EXISTS ccfv_card_idx ON public.card_custom_field_valores (card_id);
ALTER TABLE public.card_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_custom_field_valores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ccf_all ON public.card_custom_fields;
CREATE POLICY ccf_all ON public.card_custom_fields FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS ccfv_all ON public.card_custom_field_valores;
CREATE POLICY ccfv_all ON public.card_custom_field_valores FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.obras_upsert_lote(payload jsonb)
RETURNS TABLE (codigo text, acao text, obra_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_empresa_default uuid;
  v_item jsonb;
  v_obra_id uuid;
  v_cliente_id uuid;
  v_cliente_nome text;
  v_acao text;
BEGIN
  SELECT id INTO v_empresa_default FROM public.empresas
   WHERE razao_social = 'Empresa Principal' LIMIT 1;
  IF v_empresa_default IS NULL THEN
    SELECT id INTO v_empresa_default FROM public.empresas ORDER BY created_at LIMIT 1;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload) LOOP
    v_cliente_nome := NULLIF(btrim(v_item->>'cliente'), '');
    v_cliente_id := NULL;
    IF v_cliente_nome IS NOT NULL THEN
      SELECT c.id INTO v_cliente_id FROM public.clientes c
       WHERE lower(btrim(c.nome)) = lower(v_cliente_nome) LIMIT 1;
      IF v_cliente_id IS NULL THEN
        INSERT INTO public.clientes (nome) VALUES (v_cliente_nome) RETURNING id INTO v_cliente_id;
      END IF;
    END IF;

    SELECT o.id INTO v_obra_id FROM public.obras o
     WHERE o.codigo = (v_item->>'codigo') LIMIT 1;

    IF v_obra_id IS NULL THEN
      INSERT INTO public.obras (
        codigo, nome, cliente, cliente_id, status, ativa,
        valor_contrato, data_inicio, data_previsao_termino, data_fim,
        local, pedido_contrato, centro_custo_totvs,
        data_mobilizacao, data_desmobilizacao, empresa_id
      ) VALUES (
        v_item->>'codigo',
        COALESCE(v_item->>'nome', v_item->>'codigo'),
        v_cliente_nome,
        v_cliente_id,
        COALESCE((v_item->>'status')::public.status_obra, 'em_andamento'::public.status_obra),
        COALESCE((v_item->>'ativa')::boolean, true),
        COALESCE(NULLIF(v_item->>'valor_contrato','')::numeric, 0),
        NULLIF(v_item->>'data_inicio','')::date,
        NULLIF(v_item->>'data_previsao_termino','')::date,
        NULLIF(v_item->>'data_fim','')::date,
        v_item->>'local',
        v_item->>'pedido_contrato',
        v_item->>'centro_custo_totvs',
        NULLIF(v_item->>'data_mobilizacao',''),
        NULLIF(v_item->>'data_desmobilizacao',''),
        v_empresa_default
      ) RETURNING id INTO v_obra_id;
      v_acao := 'criada';
    ELSE
      UPDATE public.obras o SET
        nome                  = COALESCE(v_item->>'nome', o.nome),
        cliente               = COALESCE(v_cliente_nome, o.cliente),
        cliente_id            = COALESCE(v_cliente_id, o.cliente_id),
        ativa                 = COALESCE((v_item->>'ativa')::boolean, o.ativa),
        valor_contrato        = COALESCE(NULLIF(v_item->>'valor_contrato','')::numeric, o.valor_contrato),
        data_inicio           = COALESCE(NULLIF(v_item->>'data_inicio','')::date, o.data_inicio),
        data_previsao_termino = COALESCE(NULLIF(v_item->>'data_previsao_termino','')::date, o.data_previsao_termino),
        data_fim              = COALESCE(NULLIF(v_item->>'data_fim','')::date, o.data_fim),
        local                 = COALESCE(v_item->>'local', o.local),
        pedido_contrato       = COALESCE(v_item->>'pedido_contrato', o.pedido_contrato),
        centro_custo_totvs    = COALESCE(v_item->>'centro_custo_totvs', o.centro_custo_totvs),
        updated_at            = now()
      WHERE o.id = v_obra_id;
      v_acao := 'atualizada';
    END IF;

    codigo := v_item->>'codigo'; acao := v_acao; obra_id := v_obra_id;
    RETURN NEXT;
  END LOOP;
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.obras_upsert_lote(jsonb) TO authenticated, anon, service_role;
