ALTER TABLE public.bms_previstas DROP CONSTRAINT bms_previstas_status_check;
ALTER TABLE public.bms_previstas ADD CONSTRAINT bms_previstas_status_check
  CHECK (status = ANY (ARRAY['prevista','aberta','realizada','fechada','faturada','paga','cancelada']));