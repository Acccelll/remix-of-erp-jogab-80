-- DB-001.c consolidação: 15 colunas de fronteira → uuid + FK real
DROP VIEW IF EXISTS public.vw_db001_fronteira_orfaos;

ALTER TABLE public.colaboradores                  DROP CONSTRAINT IF EXISTS db001_colaboradores_obra_atual_id_fmt;
ALTER TABLE public.patrimonios                    DROP CONSTRAINT IF EXISTS db001_patrimonios_obra_atual_id_fmt;
ALTER TABLE public.patrimonios                    DROP CONSTRAINT IF EXISTS db001_patrimonios_responsavel_id_fmt;
ALTER TABLE public.veiculos                       DROP CONSTRAINT IF EXISTS db001_veiculos_obra_atual_id_fmt;
ALTER TABLE public.mobilizacoes_periodos          DROP CONSTRAINT IF EXISTS db001_mobilizacoes_periodos_colaborador_id_fmt;
ALTER TABLE public.mobilizacoes_periodos          DROP CONSTRAINT IF EXISTS db001_mobilizacoes_periodos_obra_id_fmt;
ALTER TABLE public.mobilizacoes_veiculos          DROP CONSTRAINT IF EXISTS db001_mobilizacoes_veiculos_veiculo_id_fmt;
ALTER TABLE public.mobilizacoes_veiculos          DROP CONSTRAINT IF EXISTS db001_mobilizacoes_veiculos_obra_id_fmt;
ALTER TABLE public.responsabilidades_patrimonios  DROP CONSTRAINT IF EXISTS db001_responsabilidades_patrimonios_colaborador_id_fmt;
ALTER TABLE public.dp_holerite                    DROP CONSTRAINT IF EXISTS db001_dp_holerite_colaborador_id_fmt;
ALTER TABLE public.fopag_entries                  DROP CONSTRAINT IF EXISTS db001_fopag_entries_colaborador_id_fmt;
ALTER TABLE public.historico_salarial             DROP CONSTRAINT IF EXISTS db001_historico_salarial_colaborador_id_fmt;
ALTER TABLE public.custo_colaborador_competencia  DROP CONSTRAINT IF EXISTS db001_custo_colaborador_competencia_colaborador_id_fmt;
ALTER TABLE public.decimo_terceiro                DROP CONSTRAINT IF EXISTS db001_decimo_terceiro_colaborador_id_fmt;
ALTER TABLE public.horas_extras                   DROP CONSTRAINT IF EXISTS db001_horas_extras_colaborador_id_fmt;
ALTER TABLE public.horas_extras                   DROP CONSTRAINT IF EXISTS db001_horas_extras_obra_id_fmt;
ALTER TABLE public.provisoes                      DROP CONSTRAINT IF EXISTS db001_provisoes_colaborador_id_fmt;

ALTER TABLE public.colaboradores                  ALTER COLUMN obra_atual_id  TYPE uuid USING NULLIF(obra_atual_id,'')::uuid;
ALTER TABLE public.patrimonios                    ALTER COLUMN obra_atual_id  TYPE uuid USING NULLIF(obra_atual_id,'')::uuid;
ALTER TABLE public.patrimonios                    ALTER COLUMN responsavel_id TYPE uuid USING NULLIF(responsavel_id,'')::uuid;
ALTER TABLE public.veiculos                       ALTER COLUMN obra_atual_id  TYPE uuid USING NULLIF(obra_atual_id,'')::uuid;
ALTER TABLE public.mobilizacoes_periodos          ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.mobilizacoes_periodos          ALTER COLUMN obra_id        TYPE uuid USING obra_id::uuid;
ALTER TABLE public.mobilizacoes_veiculos          ALTER COLUMN veiculo_id     TYPE uuid USING veiculo_id::uuid;
ALTER TABLE public.mobilizacoes_veiculos          ALTER COLUMN obra_id        TYPE uuid USING obra_id::uuid;
ALTER TABLE public.responsabilidades_patrimonios  ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.dp_holerite                    ALTER COLUMN colaborador_id TYPE uuid USING NULLIF(colaborador_id,'')::uuid;
ALTER TABLE public.fopag_entries                  ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.historico_salarial             ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.custo_colaborador_competencia  ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.decimo_terceiro                ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.horas_extras                   ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;
ALTER TABLE public.horas_extras                   ALTER COLUMN obra_id        TYPE uuid USING NULLIF(obra_id,'')::uuid;
ALTER TABLE public.provisoes                      ALTER COLUMN colaborador_id TYPE uuid USING colaborador_id::uuid;

ALTER TABLE public.colaboradores ADD CONSTRAINT fk_colaboradores_obra_atual FOREIGN KEY (obra_atual_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.colaboradores VALIDATE CONSTRAINT fk_colaboradores_obra_atual;
ALTER TABLE public.patrimonios ADD CONSTRAINT fk_patrimonios_obra_atual FOREIGN KEY (obra_atual_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.patrimonios VALIDATE CONSTRAINT fk_patrimonios_obra_atual;
ALTER TABLE public.patrimonios ADD CONSTRAINT fk_patrimonios_responsavel FOREIGN KEY (responsavel_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.patrimonios VALIDATE CONSTRAINT fk_patrimonios_responsavel;
ALTER TABLE public.veiculos ADD CONSTRAINT fk_veiculos_obra_atual FOREIGN KEY (obra_atual_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.veiculos VALIDATE CONSTRAINT fk_veiculos_obra_atual;

ALTER TABLE public.mobilizacoes_periodos ADD CONSTRAINT fk_mob_periodos_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.mobilizacoes_periodos VALIDATE CONSTRAINT fk_mob_periodos_colaborador;
ALTER TABLE public.mobilizacoes_periodos ADD CONSTRAINT fk_mob_periodos_obra FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.mobilizacoes_periodos VALIDATE CONSTRAINT fk_mob_periodos_obra;
ALTER TABLE public.mobilizacoes_veiculos ADD CONSTRAINT fk_mob_veiculos_veiculo FOREIGN KEY (veiculo_id) REFERENCES public.veiculos(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.mobilizacoes_veiculos VALIDATE CONSTRAINT fk_mob_veiculos_veiculo;
ALTER TABLE public.mobilizacoes_veiculos ADD CONSTRAINT fk_mob_veiculos_obra FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.mobilizacoes_veiculos VALIDATE CONSTRAINT fk_mob_veiculos_obra;

ALTER TABLE public.responsabilidades_patrimonios ADD CONSTRAINT fk_resp_pat_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.responsabilidades_patrimonios VALIDATE CONSTRAINT fk_resp_pat_colaborador;
ALTER TABLE public.dp_holerite ADD CONSTRAINT fk_dp_holerite_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.dp_holerite VALIDATE CONSTRAINT fk_dp_holerite_colaborador;
ALTER TABLE public.fopag_entries ADD CONSTRAINT fk_fopag_entries_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.fopag_entries VALIDATE CONSTRAINT fk_fopag_entries_colaborador;
ALTER TABLE public.historico_salarial ADD CONSTRAINT fk_hist_salarial_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.historico_salarial VALIDATE CONSTRAINT fk_hist_salarial_colaborador;
ALTER TABLE public.custo_colaborador_competencia ADD CONSTRAINT fk_custo_colab_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.custo_colaborador_competencia VALIDATE CONSTRAINT fk_custo_colab_colaborador;
ALTER TABLE public.decimo_terceiro ADD CONSTRAINT fk_decimo_terceiro_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.decimo_terceiro VALIDATE CONSTRAINT fk_decimo_terceiro_colaborador;
ALTER TABLE public.horas_extras ADD CONSTRAINT fk_horas_extras_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.horas_extras VALIDATE CONSTRAINT fk_horas_extras_colaborador;
ALTER TABLE public.horas_extras ADD CONSTRAINT fk_horas_extras_obra FOREIGN KEY (obra_id) REFERENCES public.obras(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;
ALTER TABLE public.horas_extras VALIDATE CONSTRAINT fk_horas_extras_obra;
ALTER TABLE public.provisoes ADD CONSTRAINT fk_provisoes_colaborador FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
ALTER TABLE public.provisoes VALIDATE CONSTRAINT fk_provisoes_colaborador;

CREATE OR REPLACE VIEW public.vw_db001_fronteira_orfaos
WITH (security_invoker = true) AS
SELECT NULL::text AS tabela, NULL::text AS coluna, NULL::text AS tabela_referencia, NULL::text AS valor, 0::bigint AS total
WHERE FALSE;
GRANT SELECT ON public.vw_db001_fronteira_orfaos TO authenticated, service_role;