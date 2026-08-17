
ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS prazo_padrao_pagamento text,
  ADD COLUMN IF NOT EXISTS dia_fixo_pagamento_1 text,
  ADD COLUMN IF NOT EXISTS dia_fixo_pagamento_2 text,
  ADD COLUMN IF NOT EXISTS data_corte_medicao_1 text,
  ADD COLUMN IF NOT EXISTS data_corte_medicao_2 text,
  ADD COLUMN IF NOT EXISTS observacao text;
