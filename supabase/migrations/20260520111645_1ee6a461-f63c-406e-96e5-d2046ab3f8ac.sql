CREATE TABLE public.mobilizacoes_veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id text NOT NULL,
  obra_id text NOT NULL,
  obra_nome text,
  data_inicio date NOT NULL,
  data_fim date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_mob_veiculos_veiculo ON public.mobilizacoes_veiculos (veiculo_id);
CREATE INDEX idx_mob_veiculos_datas ON public.mobilizacoes_veiculos (data_inicio, data_fim);

ALTER TABLE public.mobilizacoes_veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to mobilizacoes_veiculos"
ON public.mobilizacoes_veiculos
FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);