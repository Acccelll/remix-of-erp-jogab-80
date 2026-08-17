INSERT INTO public.feature_flags (flag_key, obra_id, enabled, description) VALUES
  ('legacy.trello_import', NULL, true, 'H3.4 — Importador legado do Trello (Quadro Geral). Desligar por obra após cutover.'),
  ('legacy.cronograma_import', NULL, true, 'H3.4 — Importador legado de cronograma (Prevision/MS Project). Desligar por obra após cutover.'),
  ('legacy.financeiro_import', NULL, true, 'H3.4 — Importador de relatório TOTVS no Financeiro. Desligar por obra após estabilizar snapshot automático.'),
  ('legacy.ponto_import', NULL, true, 'H3.4 — Importador legado de ponto (Checklist Fácil). Desligar por obra após cutover.')
ON CONFLICT (flag_key, obra_id) DO NOTHING;