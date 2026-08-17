ALTER TABLE public.obras
  ALTER COLUMN data_mobilizacao TYPE date USING NULLIF(data_mobilizacao,'')::date,
  ALTER COLUMN data_desmobilizacao TYPE date USING NULLIF(data_desmobilizacao,'')::date;

ALTER TABLE public.obras DROP COLUMN IF EXISTS observacao;