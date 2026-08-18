# Índice cronológico de migrations

> Auto-gerado por `scripts/db/gen-migrations-index.py` (DB-003 · Onda 1).
> Regeração: `python3 scripts/db/gen-migrations-index.py`.

Total: **276** migrations · janela: 2026-04-02 11:38 → 2026-08-18 19:50

| # | Data/Hora | Arquivo | Ementa (primeira linha) |
|--:|-----------|---------|-------------------------|
| 1 | 2026-04-02 11:38 | `20260402113826_93344cb2-ee09-4eb1-a2b1-8707bc9699e7.sql` | Folha de Pagamento |
| 2 | 2026-04-06 12:17 | `20260406121705_9cad2eec-8110-48ab-8483-7cc91795af73.sql` | CREATE TABLE mobilizacoes_periodos ( |
| 3 | 2026-04-06 12:17 | `20260406121731_18d4dcc8-a61e-4bed-b816-fa467502a5f4.sql` | CREATE OR REPLACE FUNCTION get_folha_rateada(p_colaborador_id TEXT, p_obra_id TEXT) |
| 4 | 2026-04-07 12:12 | `20260407121219_a8844acb-afaf-4e00-8aaf-dcc10a2989c3.sql` | Formas de pagamento |
| 5 | 2026-04-10 11:48 | `20260410114815_ab6aaca7-877c-47d9-a3d6-bdee64d96288.sql` | Obras |
| 6 | 2026-04-12 02:44 | `20260412024453_35b789ef-899f-4f68-aa4c-e859b8aef034.sql` | DROP POLICY IF EXISTS "Authenticated access solicitacoes_financeiras" ON public.solicitacoes_financeiras; |
| 7 | 2026-05-05 11:08 | `20260505110855_321188c7-5686-431a-ae1b-1b110079cedb.sql` | ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS status_especial text; |
| 8 | 2026-05-20 11:16 | `20260520111645_1ee6a461-f63c-406e-96e5-d2046ab3f8ac.sql` | CREATE TABLE public.mobilizacoes_veiculos ( |
| 9 | 2026-05-26 12:57 | `20260526125700_290bf2d3-44b5-433a-9029-06fc2d003309.sql` |  |
| 10 | 2026-05-28 12:14 | `20260528121417_76b185c0-bf46-4ecb-8bab-8483f01aa732.sql` | ALTER TABLE public.obras |
| 11 | 2026-05-29 12:43 | `20260529124341_06052018-8cf2-41a4-86a1-8d06aa1d5237.sql` | ALTER TABLE public.solicitacoes_financeiras |
| 12 | 2026-06-01 11:26 | `20260601112600_18b69922-52ae-4336-ac31-3ecc3c6ef6e7.sql` | ALTER TABLE public.patrimonios ADD COLUMN IF NOT EXISTS sujo boolean NOT NULL DEFAULT false; |
| 13 | 2026-06-02 12:27 | `20260602122727_4ca5f331-b4e7-40fc-ac9d-ea6cfcc3d6be.sql` | Coluna denormalizada de responsável atual |
| 14 | 2026-06-09 12:02 | `20260609120255_7438f495-86ee-41f5-84b6-12f73961c692.sql` | ALTER TABLE public.solicitacoes_financeiras ADD COLUMN IF NOT EXISTS pagamento_pendente boolean NOT NULL DEFAULT false; |
| 15 | 2026-06-10 13:58 | `20260610135849_2e504f00-9930-4c5b-9cce-1d695353c8bb.sql` | CREATE TABLE public.custo_colaborador_competencia ( |
| 16 | 2026-06-15 11:11 | `20260615111149_8fa89174-6a4b-42b3-8408-5be355793941.sql` | CREATE TABLE public.dp_holerite ( |
| 17 | 2026-06-16 11:26 | `20260616112645_6eef1b21-829e-434b-9782-6f4fe62b495a.sql` | ============================================================ |
| 18 | 2026-06-17 04:02 | `20260617040252_d4145033-7181-436d-acb3-3e3ab16d719c.sql` | Wave C: ajustes de schema para suportar componentes de obra portados |
| 19 | 2026-06-18 11:48 | `20260618114803_1b9affa0-7c17-4f1b-9d47-476861ce0f68.sql` | ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS owner_id uuid; |
| 20 | 2026-06-18 11:49 | `20260618114903_72b808a9-435a-4698-8b01-df958b7793ae.sql` | ALTER TABLE public.clientes |
| 21 | 2026-06-18 11:49 | `20260618114933_77dca964-50be-4d45-9cf7-b92c069d3d2d.sql` | ALTER TABLE public.obras |
| 22 | 2026-06-18 12:00 | `20260618120033_ec5596bb-5c1a-4549-9dad-d081f40b910b.sql` | ALTER TABLE public.medicoes ADD COLUMN IF NOT EXISTS data_inicio date; |
| 23 | 2026-06-18 15:19 | `20260618151913_2546ea7a-8165-4a1c-b90b-949c083d466f.sql` | Folha de Pagamento |
| 24 | 2026-06-18 15:19 | `20260618151958_d8a218a1-44ee-4451-9a6a-4ce84e9fbd80.sql` | CREATE OR REPLACE FUNCTION public.fn_importar_financeiro_snapshot( |
| 25 | 2026-06-18 15:34 | `20260618153441_b3cb2088-b74d-4f24-95d2-91ec3706c677.sql` | Análise de Ponto + Homem/Hora |
| 26 | 2026-06-18 15:42 | `20260618154238_4621c928-d59d-4911-9ed9-444eb3915181.sql` | ALTER TABLE public.ponto_registros |
| 27 | 2026-06-18 19:12 | `20260618191215_a2a2b24f-18f1-4152-93bd-ba45f0cea89a.sql` | ALTER TABLE public.clientes |
| 28 | 2026-06-18 20:03 | `20260618200333_34f0a832-ee75-44a3-a2e1-b5945d96ad69.sql` | ALTER TABLE public.dp_holerite DROP COLUMN IF EXISTS custo_total; |
| 29 | 2026-06-18 20:07 | `20260618200748_3a47b50c-0899-416e-af4e-a0655711b34f.sql` | ALTER TABLE public.custo_colaborador_competencia DROP COLUMN IF EXISTS custo_total; |
| 30 | 2026-06-18 20:20 | `20260618202019_4edfea77-8151-4e08-87ba-d499c6928a68.sql` | ALTER TABLE public.ponto_registros |
| 31 | 2026-06-20 15:55 | `20260620155523_8779ac32-ff42-4c0b-a713-bc639bb0c0ad.sql` | ============================================ |
| 32 | 2026-06-22 18:07 | `20260622180715_7720b68f-2108-4765-8f1a-9d545db99cad.sql` | Fase 1: Evolução de dívidas — matriz de referência, pendência e rollup permanente. |
| 33 | 2026-06-22 18:29 | `20260622182945_5a7732c4-9581-4963-8c60-3ece0e09b24c.sql` | ============================================================ |
| 34 | 2026-06-22 19:08 | `20260622190835_9b1289e2-cc97-4697-a6c4-c853537b3d5e.sql` | Unique key for matriz upsert (ref_lancamento + cod_natureza + cod_ccusto identifies a slice) |
| 35 | 2026-06-23 00:52 | `20260623005258_6d107d71-abf9-4a14-abba-d58222e11e32.sql` | Popula o rollup. IMPORTANTE: normaliza o valor de cada fatia para que a |
| 36 | 2026-06-23 12:19 | `20260623121912_742da031-002a-417d-ae8f-a3414645369b.sql` | ========================================================================= |
| 37 | 2026-06-23 13:05 | `20260623130538_f5d5829f-0d63-4f95-b6d9-8b096b771529.sql` | CREATE TABLE IF NOT EXISTS public.faturamento_nfse ( |
| 38 | 2026-06-23 13:27 | `20260623132737_7dd9cc12-3123-444e-a216-9224b93f711b.sql` | CREATE OR REPLACE VIEW public.vw_financeiro_obra AS |
| 39 | 2026-06-23 13:28 | `20260623132800_9c25d013-23bc-4f72-8f74-4232919efb3b.sql` | ALTER VIEW public.vw_financeiro_obra SET (security_invoker = true); |
| 40 | 2026-06-23 14:06 | `20260623140611_04ccb954-b453-4157-93f7-d8f7906a7390.sql` | GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturamento_nfse TO authenticated; |
| 41 | 2026-06-23 14:09 | `20260623140905_fb491923-ba2c-4c79-8fa2-446269b8ce21.sql` | DROP POLICY IF EXISTS fat_nfse_auth_all ON public.faturamento_nfse; |
| 42 | 2026-06-23 14:27 | `20260623142746_2034c0c0-b3e3-4474-a22a-12206ac5230c.sql` | Backfill obra_id em faturamento_nfse usando o prefixo numérico do nome da obra |
| 43 | 2026-06-23 15:12 | `20260623151244_f6f587b0-c9fc-4c32-852c-c9a30df93bc3.sql` | ALTER TABLE public.bms_previstas DROP CONSTRAINT bms_previstas_status_check; |
| 44 | 2026-06-24 14:24 | `20260624142446_0298564e-46b8-4522-a8ff-aa620ee02cbf.sql` | ===================================================================== |
| 45 | 2026-06-24 14:33 | `20260624143312_291bd2b1-91ed-4f81-812a-cdda258e6986.sql` | TODO(auth): substituir por policies por membership em card_setores quando |
| 46 | 2026-06-24 19:00 | `20260624190006_234a6070-5076-4d10-8301-9f17e7febf03.sql` | profiles: identidade ligada ao auth.users |
| 47 | 2026-06-24 19:19 | `20260624191933_bde8694c-2368-4176-9b64-61a679096fb4.sql` | cards |
| 48 | 2026-06-24 19:21 | `20260624192154_28385de8-060d-4c74-829d-0d16a85a067f.sql` | Drop old open policies |
| 49 | 2026-06-24 19:28 | `20260624192801_e6f05f19-5168-42ef-9f16-93d8eeab9a29.sql` | Lote 3: Financeiro & Comercial RLS |
| 50 | 2026-06-24 19:52 | `20260624195226_2f20b9d3-8c76-4f37-921b-22a19c3ed65f.sql` | Lote 4: RH/DP sensível — leitura company-wide; escrita restrita a GM ou setor 'rh'. |
| 51 | 2026-06-24 19:53 | `20260624195351_fe555b20-1334-4019-b511-505f18836293.sql` | audit_logs: GM-only read, no writes from clients |
| 52 | 2026-06-24 19:54 | `20260624195443_dc6d6321-a864-46ef-ab7b-5f35bc49c589.sql` |  |
| 53 | 2026-06-24 20:09 | `20260624200913_83efdee0-54a3-4657-89c7-e4a45cb2c075.sql` | DROP POLICY IF EXISTS "cards insert" ON public.cards; |
| 54 | 2026-06-24 20:12 | `20260624201241_bb9c55be-65e4-4b6e-b401-9f21bdeac752.sql` | campos que faltam no card |
| 55 | 2026-06-24 20:48 | `20260624204821_4fce6772-8957-44e7-8bd4-607ab0d42ab6.sql` | Policies de storage para o bucket privado card-anexos. |
| 56 | 2026-06-24 20:54 | `20260624205408_66ea057e-0881-401c-b8e8-00c3f3de2a29.sql` | alter table public.notificacoes replica identity full; |
| 57 | 2026-06-25 01:01 | `20260625010112_53d4dae2-3254-4624-a1f6-bf0f8135fcf5.sql` | ===================================================================== |
| 58 | 2026-06-25 01:01 | `20260625010137_be6637d8-997b-4fab-983d-f55a2f49224a.sql` | REVOKE EXECUTE ON FUNCTION public.fn_cards_automacoes() FROM PUBLIC, anon, authenticated; |
| 59 | 2026-06-25 01:02 | `20260625010228_c6f10478-4192-4cd9-acc8-f45148344d68.sql` | CREATE OR REPLACE FUNCTION public.fn_cards_automacoes() |
| 60 | 2026-06-25 11:41 | `20260625114130_7a22f5d0-4e66-48ce-9c01-f28451b3cd1a.sql` | CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions; |
| 61 | 2026-06-25 12:32 | `20260625123216_8927a1ea-1dab-45fe-bca2-fd6761d01ef1.sql` | Fase 2.1 — Orçamento: insumos, composições, orçamento por atividade |
| 62 | 2026-06-25 12:37 | `20260625123729_03cbaa34-300b-41c0-bb73-c7b6b73acbdb.sql` | Fase 2.3 — Write-back custo da atividade ← orçamento (não-invasivo) |
| 63 | 2026-06-25 13:09 | `20260625130929_0a1dc3f0-2b08-47f1-a417-62e815008a4f.sql` | CREATE TABLE IF NOT EXISTS public.obra_localizacoes ( |
| 64 | 2026-06-25 16:00 | `20260625160000_add_servico_to_leads.sql` | Add servico field to leads table for CRM opportunities |
| 65 | 2026-06-25 16:50 | `20260625165034_72d662b3-bde9-4181-96dc-7020fc914add.sql` | CREATE OR REPLACE VIEW public.vw_faturamento_nfse_orfas AS |
| 66 | 2026-06-25 17:29 | `20260625172934_cc410a36-797e-4320-a382-2a9f3d9b6efb.sql` | REVOKE EXECUTE ON FUNCTION public.fn_audit_row() FROM anon, authenticated, PUBLIC; |
| 67 | 2026-06-25 17:38 | `20260625173815_20c976a7-f464-40cb-9073-e17486c4169a.sql` | ALTER TABLE public.itens_medicao |
| 68 | 2026-06-25 18:02 | `20260625180240_14e005fa-e237-48b8-b044-5054e8424f5d.sql` | ========================================================================= |
| 69 | 2026-06-25 18:20 | `20260625182038_c703efa2-2039-488c-a3db-2231a4b04740.sql` | ========================================================================= |
| 70 | 2026-06-25 18:41 | `20260625184155_0a3987b3-de72-40bf-b517-6a61c21ee0a8.sql` | ============================================================ |
| 71 | 2026-06-25 18:57 | `20260625185733_863b298a-df80-4a39-884a-e29b7bde4706.sql` | riscos: links e auditoria |
| 72 | 2026-06-25 19:23 | `20260625192328_cfa79631-157a-4b32-b922-7d4d8ee343a1.sql` | card_membros: múltiplos membros por card (além do responsável) |
| 73 | 2026-06-25 19:29 | `20260625192947_58acbf01-8fb0-41a2-afcd-7e2434c1d9bb.sql` | CREATE TABLE IF NOT EXISTS public.card_views_salvas ( |
| 74 | 2026-06-25 19:36 | `20260625193647_707c6b18-b9e8-445d-8ca4-1dc983db9858.sql` |  |
| 75 | 2026-06-25 19:38 | `20260625193833_d7561aba-7de4-4e8d-a2e1-4c8758130be1.sql` | responsável |
| 76 | 2026-06-25 19:53 | `20260625195337_91781e22-fa36-46c0-8ed0-2865d8aa1afe.sql` | ============================================================ |
| 77 | 2026-06-25 20:11 | `20260625201140_32b6e39e-5343-43f6-bef0-1e35ea4e6d41.sql` | Agendamento de inspeções recorrentes (INSP.5b) |
| 78 | 2026-06-25 20:14 | `20260625201414_53c10f8e-7a17-44f3-8c29-fa5cfb90a645.sql` | CREATE TABLE public.inspecao_qr_alvos ( |
| 79 | 2026-06-25 20:20 | `20260625202006_1e6b2ca3-9129-4e99-9d75-a3132c30e215.sql` | Normalização de título sem depender de unaccent: lower + translate dos acentos comuns |
| 80 | 2026-06-25 20:26 | `20260625202618_960f4bb3-245c-4ce2-8771-fc550fd39294.sql` | ============= Notificações de NCs ============= |
| 81 | 2026-06-25 20:28 | `20260625202802_0c62552d-76f7-4a8c-a873-f375738fd7a8.sql` | Remove agendamento anterior se existir (idempotente) |
| 82 | 2026-06-26 14:08 | `20260626140848_9e1ab08f-877d-49ae-80d2-7d9397154a94.sql` | CREATE OR REPLACE FUNCTION public.fn_estoque_transferir( |
| 83 | 2026-06-26 14:11 | `20260626141146_872e070f-5866-4de5-b25d-388a7357067a.sql` | Identifica o papel da rodada atual: primeiro não-atendido na ordem. |
| 84 | 2026-06-26 15:14 | `20260626151447_db9a367e-8529-447d-90fb-6800f0e99550.sql` | frota_abastecimentos |
| 85 | 2026-06-26 15:19 | `20260626151956_412c4e1e-096a-4815-a56c-747d7974a13b.sql` | aditivos_contrato.contrato_id (nullable, migração suave) |
| 86 | 2026-06-27 21:17 | `20260627211724_080d81dd-da0e-48b3-a96b-d1cfc73cbbed.sql` | DROP TABLE IF EXISTS public.players CASCADE; |
| 87 | 2026-06-27 22:25 | `20260627222538_e573afb2-b62b-45ad-8659-996a6510dcb0.sql` | CREATE TABLE public.cronograma_cenarios ( |
| 88 | 2026-06-27 22:33 | `20260627223313_f9475b7f-7faa-45d0-9841-307a4c70b08b.sql` | inspecao_agendas: substitui UPDATE/DELETE totalmente abertos. |
| 89 | 2026-06-27 22:38 | `20260627223826_9d5232dd-7b60-4215-8661-8c5037e62b71.sql` | 1) Tabela de empresas |
| 90 | 2026-06-27 22:43 | `20260627224347_962f418d-1561-478d-a500-8f9c9c116472.sql` | Phase 2: Add empresa_id to obras and contratos with backfill |
| 91 | 2026-06-27 22:46 | `20260627224659_f465d06d-c6f6-4287-ab63-b90bc89202d4.sql` | Phase 3: tighten RLS on obras/contratos to filter by current_empresas() |
| 92 | 2026-06-27 23:48 | `20260627234827_9359b613-881d-4293-9576-bb6996f625ce.sql` | ============================================================================ |
| 93 | 2026-06-27 23:55 | `20260627235523_fe626e23-15e6-44ce-8c87-bdc967f7fc82.sql` | ============================================================================ |
| 94 | 2026-06-29 10:00 | `20260629100000_add_temperatura_and_prospectado_to_leads.sql` | Add temperatura and prospectado_por fields to leads table |
| 95 | 2026-06-29 10:01 | `20260629100100_add_temperatura_and_contatos_to_oportunidades.sql` | Add temperatura and contatos fields to oportunidades table |
| 96 | 2026-06-29 13:16 | `20260629131638_d486f8bc-5a93-466a-b964-c7c24383ce50.sql` | CREATE OR REPLACE FUNCTION public.emitir_oc_atomico(p_oc_id uuid) |
| 97 | 2026-06-29 13:31 | `20260629133103_70cb5aea-5485-45fa-b6b7-930c916f7022.sql` | CREATE TABLE IF NOT EXISTS public.system_events ( |
| 98 | 2026-06-29 14:05 | `20260629140529_7a8bc5b3-a821-4a24-8627-bc5c2e47f581.sql` | CREATE TABLE IF NOT EXISTS public.totvs_import_runs ( |
| 99 | 2026-06-29 14:33 | `20260629143345_713d6aa5-4ca4-4371-b920-7bcf1a255418.sql` | CREATE OR REPLACE FUNCTION public.update_updated_at_column() |
| 100 | 2026-06-29 14:34 | `20260629143402_4b0dc4e9-691d-43ad-b5c6-aaba679a1152.sql` | REVOKE EXECUTE ON FUNCTION public.is_gm_user(UUID) FROM anon; |
| 101 | 2026-06-29 14:46 | `20260629144601_80f926b0-8e3f-4962-af36-4ccc88e78740.sql` | CREATE OR REPLACE VIEW public.vw_cutover_metrics_trello AS |
| 102 | 2026-06-29 14:52 | `20260629145257_deb350fb-bd8c-4755-8a93-2aeb9ceb2209.sql` | CREATE OR REPLACE VIEW public.vw_cutover_metrics_financeiro AS |
| 103 | 2026-06-29 14:56 | `20260629145656_5a6f9057-2e72-45ce-ba3e-cbe16a96ea53.sql` | INSERT INTO public.feature_flags (flag_key, obra_id, enabled, description) VALUES |
| 104 | 2026-06-29 15:04 | `20260629150420_7cefe3be-fc13-426c-b67d-a046a06f0b23.sql` | CREATE OR REPLACE VIEW public.vw_cutover_legacy_status AS |
| 105 | 2026-06-29 15:17 | `20260629151759_bd32d017-09f0-4165-ad97-c2fd875700fa.sql` | 1) Add origem + checklist_codigo to rdo for cutover tracking & idempotency |
| 106 | 2026-06-29 15:38 | `20260629153846_6691ff1b-ff03-4edb-bbbb-bc29af4a12da.sql` | CREATE UNIQUE INDEX IF NOT EXISTS obras_codigo_unique |
| 107 | 2026-06-29 15:39 | `20260629153904_efb13956-c5f8-4a65-b9d0-178f6e0182b6.sql` | GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_membros_externos TO authenticated; |
| 108 | 2026-06-29 15:45 | `20260629154547_08bcb4f3-526a-4999-adb6-5d26e38263c9.sql` | Auto-cria profile com is_gm=true para todo usuário autenticado (modo teste). |
| 109 | 2026-06-29 15:56 | `20260629155612_dee226a4-36fd-48ea-93a4-e225f0e53c09.sql` | DROP POLICY IF EXISTS "obras select" ON public.obras; |
| 110 | 2026-06-29 22:50 | `20260629225008_d3df67b2-91cf-40e9-a016-ce90231dacef.sql` | ALTER TABLE public.mobilizacoes_periodos |
| 111 | 2026-06-30 11:05 | `20260630110515_b54787ce-00ad-4321-9a8b-d42dd2593bb8.sql` | ALTER TABLE public.cards |
| 112 | 2026-06-30 12:19 | `20260630121931_e74da603-3958-4bc8-8773-74678ee88544.sql` | ========================================================= |
| 113 | 2026-06-30 13:16 | `20260630131600_d9d65ba9-be69-4933-ba4c-1047186701de.sql` | Fase D — campos sob demanda: lembrete + local |
| 114 | 2026-06-30 13:27 | `20260630132747_176facb2-4242-419d-a8e5-336f51454f3a.sql` | ALTER TABLE public.card_comentarios |
| 115 | 2026-06-30 14:05 | `20260630140538_18dfb7e2-fcf3-4466-a725-87afa14fb24e.sql` | H1: visibilidade de seções por card (Trello "Add to card") |
| 116 | 2026-06-30 15:07 | `20260630150743_8bd6936f-3bc9-4928-a1a1-8ce5dd6b3b73.sql` | 1) Histórico em card_board_posicao |
| 117 | 2026-06-30 15:21 | `20260630152147_14901cc5-a029-46fd-a2e2-dbcb47d22bbf.sql` | notificacoes já existe (id, user_id, tipo, card_id, texto NOT NULL, mensagem, lida, created_at) |
| 118 | 2026-06-30 15:32 | `20260630153222_9305a2f0-f6cf-46c3-905b-473c2d4403fa.sql` | Criação atômica de card em quadro/lista e correção de acesso pós-criação. |
| 119 | 2026-06-30 15:35 | `20260630153554_c9d43fb2-a3c8-4d04-a2cc-99a54726b1a6.sql` | CREATE OR REPLACE FUNCTION public.criar_card_board_atomico(p_board_id uuid, p_lista_id uuid, p_titulo text, p_criado_por |
| 120 | 2026-06-30 16:51 | `20260630165124_d4658171-8c62-49b0-9313-9726bbcd0f79.sql` | CREATE OR REPLACE FUNCTION public.fn_cards_automacoes() |
| 121 | 2026-06-30 18:05 | `20260630180559_9296e33a-95ba-4569-b586-6da9dba8884e.sql` | ALTER TABLE public.board_listas ADD COLUMN IF NOT EXISTS cor TEXT NULL; |
| 122 | 2026-06-30 19:31 | `20260630193142_3ab85d44-8d90-4238-aabf-f4a99851f00b.sql` | ALTER TABLE public.board_listas |
| 123 | 2026-06-30 19:39 | `20260630193900_7f7b4108-2b1d-4a88-b24c-045141562bed.sql` | ALTER TABLE public.board_listas |
| 124 | 2026-06-30 22:32 | `20260630223241_8acdf225-eccc-4f70-b9e9-ebd3463382c9.sql` | ALTER TABLE public.obras |
| 125 | 2026-07-01 02:05 | `20260701020533_428ee7a5-276a-4942-ad44-c4c77eabb4dd.sql` | card_custom_field_valores |
| 126 | 2026-07-01 02:06 | `20260701020640_37dc2644-00d7-40f6-9b98-1bec0f5f31d7.sql` | DROP POLICY IF EXISTS "obras select" ON public.obras; |
| 127 | 2026-07-01 02:07 | `20260701020700_81856b33-d7dd-49c1-b2c7-6e2340d93174.sql` | descobrir e derrubar policies SELECT com USING true |
| 128 | 2026-07-01 02:07 | `20260701020724_c71ceadd-aa70-437a-86bd-6eabb96ea3b7.sql` |  |
| 129 | 2026-07-01 02:08 | `20260701020854_8de44b23-1117-4b6c-b2af-44e14849fc7e.sql` | ALTER VIEW public.vw_cutover_metrics_cronograma SET (security_invoker = true); |
| 130 | 2026-07-01 02:09 | `20260701020914_6f217e91-d997-4bb1-998a-4d07d5eb7c6c.sql` |  |
| 131 | 2026-07-01 02:32 | `20260701023253_64aaf1ec-39ea-49b5-9ce8-91006ee3c8d5.sql` | DROP POLICY IF EXISTS card_local_write_auth ON public.card_local; |
| 132 | 2026-07-01 02:35 | `20260701023501_d480170e-0a89-456d-95c5-fafe89077499.sql` | Helpers de autorização |
| 133 | 2026-07-01 02:37 | `20260701023758_3620473b-e1df-42d6-bddf-e67e27506641.sql` | Fase 2 / Onda C: decomposição das RPCs monolíticas financeiras mantendo contrato público. |
| 134 | 2026-07-01 02:47 | `20260701024743_00ac052a-7f25-4ac6-b085-0c79f38b93a1.sql` | CREATE INDEX IF NOT EXISTS idx_card_label_links_label ON public.card_label_links (label_id); |
| 135 | 2026-07-01 02:53 | `20260701025356_b3826a13-797f-41e3-8fa3-08422b5d6cd9.sql` | Fase 4 · Onda B: visão consolidada por obra + índices quentes de cards |
| 136 | 2026-07-01 02:56 | `20260701025642_1588c5a2-4165-4fbf-95f1-dd0ba112a9fa.sql` | DROP MATERIALIZED VIEW IF EXISTS public.mv_obra_dashboard; |
| 137 | 2026-07-01 03:02 | `20260701030214_eab63296-f621-4964-b55e-b8bc3014082a.sql` | REVOKE EXECUTE ON FUNCTION public.refresh_mv_obra_dashboard() FROM PUBLIC; |
| 138 | 2026-07-01 03:06 | `20260701030618_dd4f71cd-8faa-4540-be91-d4a1f2eb5a80.sql` | CREATE OR REPLACE FUNCTION public.has_card_access(p_card_id uuid) |
| 139 | 2026-07-01 03:08 | `20260701030805_9819792c-dc7a-4353-be71-f12bbe87b42b.sql` | CREATE OR REPLACE VIEW public.vw_mv_obra_dashboard |
| 140 | 2026-07-01 10:25 | `20260701102508_3350233f-83c8-4a2d-8257-bb3fc3b3d61a.sql` | CREATE OR REPLACE FUNCTION public.gm_query_performance(p_limit integer DEFAULT 10) |
| 141 | 2026-07-01 10:28 | `20260701102808_a5674a57-d093-4f3c-9aa1-21c331ee2490.sql` | CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid) |
| 142 | 2026-07-01 10:52 | `20260701105201_3c5033b3-ecf5-4af1-96cf-a1a228246d95.sql` | CREATE TABLE IF NOT EXISTS public.obra_membros ( |
| 143 | 2026-07-01 10:52 | `20260701105226_c5a7b2cf-f4fe-42c4-9471-90b38d08ed8f.sql` | REVOKE ALL ON FUNCTION public.current_obras() FROM PUBLIC; |
| 144 | 2026-07-01 10:53 | `20260701105307_512282f4-1a6b-4458-aedc-ff97f89f5d4c.sql` | REVOKE ALL ON FUNCTION public.current_obras() FROM anon; |
| 145 | 2026-07-01 10:56 | `20260701105622_5df9dcf3-09c4-4875-a5fa-7c9d94b5c890.sql` | Fase 2 Onda B: aplicar user_em_obra() em SELECT de tabelas com obra_id |
| 146 | 2026-07-01 11:00 | `20260701110020_05e6e9f6-721f-4c02-970e-884c5e07ae48.sql` | Compras |
| 147 | 2026-07-01 13:16 | `20260701131652_bbb4659c-b3b9-44d4-9f31-93d9601a952f.sql` | ALTER TABLE public.itens_medicao |
| 148 | 2026-07-01 17:12 | `20260701171229_3551bc60-d024-41e0-8056-1aebf6abf891.sql` | Remove políticas antigas de storage que deixavam anexos de cards acessíveis sem validação de card. |
| 149 | 2026-07-01 17:14 | `20260701171445_81ef378b-cbf1-438b-b926-8ef3e6d7b21d.sql` | Posições de cards seguem a permissão do board relacionado. |
| 150 | 2026-07-01 17:16 | `20260701171605_d5e70c17-e40d-4ed4-b66c-fd368c6b87bc.sql` | DROP POLICY IF EXISTS "solfin_select" ON public.solicitacoes_financeiras; |
| 151 | 2026-07-01 17:21 | `20260701172109_a9cdfea9-4945-4878-a2ef-7bcc444efb64.sql` |  |
| 152 | 2026-07-01 17:26 | `20260701172651_6725333d-6f81-45d1-a277-6c58c6ab17cb.sql` | REVOKE EXECUTE ON FUNCTION public.fn_auto_arquivar_concluidos() FROM authenticated, anon, PUBLIC; |
| 153 | 2026-07-01 19:32 | `20260701193238_66fd205d-bce6-4dca-989e-75e9872e388a.sql` | Adiciona guards de autorização nas 4 RPCs SECURITY DEFINER whitelisted. |
| 154 | 2026-07-01 19:46 | `20260701194635_58464de5-62b7-4200-ae98-23fbdb6f9c70.sql` | Harden internal authorization helpers |
| 155 | 2026-07-01 19:53 | `20260701195325_dd7001ec-5344-4698-8761-4ddfefc66f70.sql` | Horizonte backend: fechar 6 achados não-linter restantes (RLS amplo / PII / finanças) |
| 156 | 2026-07-01 19:56 | `20260701195631_e306c148-98a3-4676-aa21-bcff7e364f91.sql` | Hardening incremental das políticas de leitura ainda amplas apontadas pela auditoria. |
| 157 | 2026-07-01 20:31 | `20260701203144_88aa3349-51e1-4e8d-957d-e3d7db1d383c.sql` | Backend hardening: remaining broad-read policies and fragile UUID casts |
| 158 | 2026-07-01 20:33 | `20260701203343_e5bd14a5-306e-4a15-a7e0-6cb8fdcb9378.sql` | Backend hardening: authorship integrity and remaining broad policies |
| 159 | 2026-07-01 20:35 | `20260701203509_de47f643-9015-4ff6-9755-b1726b5b8861.sql` | Backend hardening: stable UUID ownership instead of free-text ownership |
| 160 | 2026-07-01 20:38 | `20260701203807_c2a57c0f-58a1-43dd-b47e-d79a5b78d655.sql` | Horizon 0 hardening continuation: replace remaining broad authenticated reads with obra/setor-scoped rules. |
| 161 | 2026-07-01 20:39 | `20260701203946_8d10409c-d42b-4a9e-95a0-28403c016138.sql` | Final pass: remove remaining direct USING true read policies where scoping is available. |
| 162 | 2026-07-01 20:41 | `20260701204103_937dd51e-54e1-4e3e-856d-5c05d460da7b.sql` | DROP POLICY IF EXISTS "board_membros_write_owner" ON public.board_membros; |
| 163 | 2026-07-01 20:43 | `20260701204308_c4a424ed-dd80-4f00-8cf0-17e3fc81fb3b.sql` | Make sensitive write coverage explicit instead of relying on broad FOR ALL policies. |
| 164 | 2026-07-01 20:44 | `20260701204420_d6c4a16c-a223-462f-9773-af98e19f3a49.sql` | safe_uuid is used inside RLS policies; grant execute so API roles can evaluate those policies. |
| 165 | 2026-07-02 11:36 | `20260702113635_31b7efaf-cc54-4e0e-96d9-e940ebee68d3.sql` | CREATE TABLE public.notificacoes ( |
| 166 | 2026-07-02 11:40 | `20260702114004_ed5a4e90-bc80-4ef0-b20a-60b37f2f5bbd.sql` | ALTER TABLE public.notificacoes ALTER COLUMN lida_por TYPE TEXT[] USING lida_por::TEXT[]; |
| 167 | 2026-07-07 11:37 | `20260707113712_a830849d-f43b-4c29-afcc-9a20a2650612.sql` | 1) Restrict SELECT on players.senha via column-level privileges |
| 168 | 2026-07-07 15:02 | `20260707150224_e4f75296-3466-4d69-a0b9-ebedbde6cbe6.sql` | Empresas e vínculos por empresa |
| 169 | 2026-07-07 15:03 | `20260707150357_617676db-d07c-45c3-b1e0-c4c69822acef.sql` | ALTER TYPE public.card_status ADD VALUE IF NOT EXISTS 'aguardando'; |
| 170 | 2026-07-07 15:05 | `20260707150519_c57cef66-e769-4020-80bf-f47a272d133e.sql` |  |
| 171 | 2026-07-07 16:58 | `20260707165858_cb55aac6-01c5-4638-8727-343a38aa5319.sql` | ALTER TABLE public.bms_previstas |
| 172 | 2026-07-07 17:08 | `20260707170827_85dd2b81-c9bc-4dd6-966f-782a7a9c03a9.sql` | CREATE TABLE IF NOT EXISTS public.obra_membros ( |
| 173 | 2026-07-11 22:40 | `20260711224020_c75ce871-9363-4398-a64f-345abcbd5915.sql` | DB-001.a — Guardrails de fronteira: formato + relatório de órfãos |
| 174 | 2026-07-13 20:12 | `20260713201214_3f369278-7185-4994-b358-91b1c224d381.sql` | ALTER TABLE public.profiles |
| 175 | 2026-07-13 23:43 | `20260713234343_fdfed511-6c41-49dd-83a6-85954eb4f4a9.sql` | ALTER TABLE public.medicoes |
| 176 | 2026-07-14 01:05 | `20260714010538_a34dcf8f-8cd0-4681-86bf-52244db19ae3.sql` | CREATE OR REPLACE FUNCTION public.user_em_obra(p_obra_id uuid) |
| 177 | 2026-07-14 01:18 | `20260714011851_02220f8a-4413-4cb3-a317-28bceaf1da4f.sql` | PRO-003 · slice-04 — Fechamento de competência DP (backend + auditoria + RLS). |
| 178 | 2026-07-14 01:20 | `20260714012044_18b14d72-c75c-44c2-bbc3-dc34579bb0be.sql` | Recria tabela matriz de rateios + função fn_importar_matriz ausentes no banco |
| 179 | 2026-07-14 01:29 | `20260714012908_5dd1f373-683c-4158-95bc-3e9892fd802a.sql` | Deriva rateios a partir da matriz previamente carregada |
| 180 | 2026-07-14 01:31 | `20260714013132_f5808f9a-1ed9-416d-bfc8-c9c9696622ca.sql` | Fallback: quando não há snapshot importado, deriva a visão diretamente da Matriz TOTVS. |
| 181 | 2026-07-14 01:31 | `20260714013148_cc670027-e5fc-4cce-891c-0f419444b35e.sql` | ALTER VIEW public.vw_financeiro_obra SET (security_invoker = on); |
| 182 | 2026-07-14 01:43 | `20260714014301_aa721267-a58f-49f0-9c62-bfb7efd1b577.sql` | também checa a competência antiga |
| 183 | 2026-07-14 02:50 | `20260714025014_c8ea6ad1-0d71-4c5f-ac29-8b9b153650bf.sql` | ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fiscalizacao'; |
| 184 | 2026-07-14 02:50 | `20260714025037_a739c18e-c47f-445e-9851-6a70b658d1f1.sql` | DROP POLICY IF EXISTS "historico_medicao_service_all" ON public.historico_medicao; |
| 185 | 2026-07-14 02:51 | `20260714025109_ad51f362-0152-4452-8b79-08e7ab2b6d38.sql` | CREATE OR REPLACE FUNCTION public.medicao_status_transition_guard() |
| 186 | 2026-07-14 12:38 | `20260714123845_7a6231b4-f403-4e19-afe2-1ff5389f3053.sql` | PRO-007.slice-03 — bootstrap idempotente + workflow de Não Conformidades |
| 187 | 2026-07-14 15:55 | `20260714155526_260a4417-40c1-41ff-8a1d-579bb1cef7ee.sql` | DB-001.c.F2.slice-01: converter responsabilidades_patrimonios.patrimonio_id (text → uuid) + FK real |
| 188 | 2026-07-14 15:58 | `20260714155857_7ce120f7-6a2a-47e7-8810-e44ab3c9f138.sql` | DB-001.c consolidação: 15 colunas de fronteira → uuid + FK real |
| 189 | 2026-07-14 16:08 | `20260714160834_c6a98c6a-b5a8-46f9-8cd7-30547212b56b.sql` | CREATE TABLE IF NOT EXISTS public.security_events ( |
| 190 | 2026-07-14 18:03 | `20260714180311_1d06cd6a-b768-4b8d-9af5-291131fdc640.sql` | CREATE OR REPLACE FUNCTION public.fn_importar_relatorio_totvs(p_periodo_ref text, p_nome_titulos text, p_lancamentos jso |
| 191 | 2026-07-14 18:06 | `20260714180624_1daa6833-8eb9-4e4e-b92b-b006b3fac7ef.sql` | CREATE TABLE public.import_validation_runs ( |
| 192 | 2026-07-14 18:13 | `20260714181333_47cd01b9-ff53-4042-8c40-197a314c6813.sql` | GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated; |
| 193 | 2026-07-14 18:19 | `20260714181906_6bec2c90-47f4-4961-8b54-48fbab123b09.sql` | Corrige privilégios explícitos necessários para acesso via Data API/PostgREST |
| 194 | 2026-07-14 18:22 | `20260714182247_90222cf1-59ef-4d96-8c6d-db7ae12dafab.sql` | Recria a estrutura ausente usada pela tela Evolução de Dívidas. |
| 195 | 2026-07-14 21:10 | `20260714211027_f9d206af-630f-4ef1-9047-96311de27be1.sql` | ALTER TABLE public.financeiro_lancamentos |
| 196 | 2026-07-14 21:21 | `20260714212102_46906a8d-4b77-4fe9-b11e-87da50de208d.sql` | DROP VIEW IF EXISTS public.vw_financeiro_obra; |
| 197 | 2026-07-15 12:03 | `20260715120336_6b1acebe-b8a5-4ebc-9d72-6e3777f80bed.sql` | 1) Coluna natureza_tipo_matriz na matriz |
| 198 | 2026-07-15 12:11 | `20260715121145_f44625f6-3038-4b6a-ac73-3c01cfbe4d01.sql` | Lacuna 2: flags de dado estimado (Matriz sem confirmação do Relatório) |
| 199 | 2026-07-15 12:16 | `20260715121630_2735f136-3828-4995-9c7d-406c95ab23f6.sql` | ========================================================================= |
| 200 | 2026-07-15 12:23 | `20260715122337_4a899932-e21a-49f4-a9ea-b22255a8e9c1.sql` | ALTER TABLE public.financeiro_lancamentos |
| 201 | 2026-07-15 12:27 | `20260715122715_e0da8e94-2ec2-4994-8cd5-8ba25afd4661.sql` | CREATE TABLE public.financeiro_previsao_carrinho ( |
| 202 | 2026-07-15 14:47 | `20260715144738_3f116365-db89-4e12-8c9b-b731e6e28611.sql` | Backfill retroativo dos lançamentos existentes |
| 203 | 2026-07-15 15:18 | `20260715151856_5f492227-6b21-4bd8-ae0e-d5b514844286.sql` | 1) Novos campos em snapshots |
| 204 | 2026-07-15 15:22 | `20260715152250_69611fa7-ab25-4e0c-a7e0-31c4a3fddb4a.sql` | Ambas as chamadas rodam na MESMA transação. Se a segunda RAISE, a primeira é revertida. |
| 205 | 2026-07-15 15:25 | `20260715152558_d2cbf35f-c46c-4aae-aeb7-d6785bd2469c.sql` | DROP FUNCTION IF EXISTS public.fn_importar_relatorio_totvs(text, text, jsonb); |
| 206 | 2026-07-15 15:39 | `20260715153935_51e7be6c-0026-4a7c-bc01-705fbd8ba2b2.sql` | from /tmp/mig.sql |
| 207 | 2026-07-16 00:00 | `20260716000000_cronograma_itens_schema_sync.sql` | Sincroniza colunas de cronograma_itens que podem faltar em bancos que não |
| 208 | 2026-07-17 00:00 | `20260717000000_audit_logins_oportunidade_historico.sql` | Migração 2026-07-17: persistência de auditoria de login, histórico do CRM |
| 209 | 2026-07-17 00:00 | `20260717000001_boards_insert_owner_policy.sql` | Kanban · corrige erro "new row violates row-level security policy for table boards" |
| 210 | 2026-07-22 11:03 | `20260722110359_cc20740b-fc28-4565-829a-79511f99f691.sql` | ============ NEW TABLES ============ |
| 211 | 2026-07-22 11:09 | `20260722110901_afc06191-3e75-4ab3-8cf9-eab11f0d2251.sql` | Helper: check if current auth user has DP/HR access via linked player |
| 212 | 2026-07-22 11:42 | `20260722114221_4de6dfe5-1f56-4b34-8426-caa64c5fbdd4.sql` | ============================================================ |
| 213 | 2026-07-23 04:08 | `20260723040844_1db3d6bb-416d-4bff-9d50-cf967f28e47c.sql` | 1) Revogar EXECUTE de anon em todas as funções SECURITY DEFINER do schema public |
| 214 | 2026-07-23 13:37 | `20260723133741_87452d20-ceaf-4e03-b513-51c7ba75db26.sql` | FK necessária para PostgREST embutir itens_medicao -> cronograma_itens |
| 215 | 2026-07-24 11:33 | `20260724113349_c1b75bae-72cf-4749-a1a8-c10326f84da1.sql` | Switch SECURITY DEFINER helper/RPC functions callable by authenticated to SECURITY INVOKER, |
| 216 | 2026-07-28 19:16 | `20260728191640_638ceb04-331b-43b5-99f3-9e21c4b1c49a.sql` | 1) Notificações: GRANTs faltando (policies já existem) |
| 217 | 2026-07-28 21:19 | `20260728211905_efe2f7cc-9fe0-41de-b8f0-bde3ab6799d1.sql` | CREATE OR REPLACE FUNCTION public.fn_atualizar_cpm(p_obra_id uuid, p_resultados jsonb) |
| 218 | 2026-07-28 21:47 | `20260728214752_272622a3-95dd-4bd9-875a-693e1a122220.sql` | P0.1 · Fundação — Antecipação de Recebíveis |
| 219 | 2026-07-29 02:45 | `20260729024521_7d0e7953-1b4b-4c4a-80cd-ca4895e298c6.sql` | Fase 1 · Antecipação de Recebíveis — Núcleo (operadores, operações, títulos, liquidações) |
| 220 | 2026-07-29 13:58 | `20260729135806_bce31e74-ad4a-4acb-80f9-f2239b531bb6.sql` | Restrict access to the private 'database_export_28_07_26' bucket to GMs only |
| 221 | 2026-07-31 19:55 | `20260731195545_8ec959af-1d0f-46e7-8409-ae09942cab7c.sql` | CREATE OR REPLACE FUNCTION public.__bootstrap_exec_ddl(p_sql text) |
| 222 | 2026-07-31 20:07 | `20260731200708_838752a6-48a7-463f-bfd2-5e80f4f5d297.sql` | GRANT EXECUTE ON FUNCTION public.__bootstrap_exec_ddl(text) TO anon; |
| 223 | 2026-07-31 20:18 | `20260731201813_e00a601a-2bad-4289-b888-77267578af88.sql` | DROP FUNCTION IF EXISTS public.__bootstrap_exec_ddl(text); |
| 224 | 2026-07-31 20:41 | `20260731204147_5da77fd4-1bd5-45b1-b562-67f844cb03c2.sql` | CREATE TABLE public.boards ( |
| 225 | 2026-07-31 20:56 | `20260731205604_8aada60d-69ea-424c-aebb-f5b465f0d2f9.sql` | ALTER TABLE public.causas_nao_conclusao |
| 226 | 2026-07-31 21:10 | `20260731211014_f0994dc7-cc44-4abb-bdad-a34021427e7a.sql` | ALTER TABLE public.compromissos_semanais |
| 227 | 2026-07-31 21:28 | `20260731212809_0cb3c37d-94a4-49e8-841e-b52445148d41.sql` | ETAPA 1 · Consolidação do Kanban genérico |
| 228 | 2026-07-31 21:48 | `20260731214830_f5ecdac8-ebf7-43bf-bc48-748d8c4b04c4.sql` | ============ ETAPA 2 · Camada de extensões e vínculos ============ |
| 229 | 2026-08-01 00:39 | `20260801003924_ed83e607-71c9-4aef-99e8-a3b9fa6b5baa.sql` | CREATE OR REPLACE FUNCTION public.kanban_entidade_info(p_entity_type text, p_entity_id uuid) |
| 230 | 2026-08-01 19:51 | `20260801195120_07397b4a-3917-402c-861b-844d21cc2891.sql` |  |
| 231 | 2026-08-03 11:26 | `20260803112615_f5232913-fc78-4be6-ac75-dcd9f2aefe6d.sql` | DROP VIEW IF EXISTS public.vw_financeiro_obra; |
| 232 | 2026-08-03 11:35 | `20260803113556_32593134-a4f2-4901-916c-706dab295124.sql` | Ponto oficial da série: um snapshot por data de referência informada. |
| 233 | 2026-08-03 11:36 | `20260803113645_6a0eaaff-f957-4041-ad3d-95077ef519da.sql` | ALTER VIEW public.vw_financeiro_obra SET (security_invoker = on); |
| 234 | 2026-08-03 11:40 | `20260803114035_ee239936-2c3f-460e-a9a6-3bab12986c9f.sql` | DROP POLICY IF EXISTS fat_nfse_write ON public.faturamento_nfse; |
| 235 | 2026-08-03 12:45 | `20260803124541_80f07f7e-9eae-4561-a29e-f88c93e61e7c.sql` | ALTER TABLE public.financeiro_matriz_rateios |
| 236 | 2026-08-03 12:49 | `20260803124947_89a9edd8-9e9c-4b31-914a-0b015228852e.sql` | CREATE OR REPLACE FUNCTION public.current_player_has_access(_module text) |
| 237 | 2026-08-03 12:50 | `20260803125049_0d52b87b-7a7f-483e-a541-d313fb275dad.sql` | ALTER TABLE public.faturamento_nfse |
| 238 | 2026-08-03 13:00 | `20260803130042_5a7ce5e0-b7b3-497c-abd2-c31687d91c15.sql` | Resolve o login do usuário autenticado (perfil ou metadados do JWT) |
| 239 | 2026-08-03 19:28 | `20260803192828_30395c8c-4461-499a-8202-6179dc606719.sql` | ALTER TABLE public.financeiro_previsao_carrinho_itens |
| 240 | 2026-08-03 22:02 | `20260803220211_79016fdf-d6f1-4c41-9a98-daba6ba7c85e.sql` | DROP VIEW IF EXISTS public.vw_financeiro_obra; |
| 241 | 2026-08-04 12:00 | `20260804120000_ponto_afd_bucket_policies.sql` | Restringe o bucket privado 'ponto-afd' a GMs. |
| 242 | 2026-08-04 12:48 | `20260804124807_485734a1-cb51-4726-b001-a75a9643778a.sql` | 1) Financeiro: restringir a authenticated |
| 243 | 2026-08-04 14:33 | `20260804143314_8fe4bc0b-b601-4f4c-bd4e-28fd56b19c66.sql` | CREATE POLICY "user_roles gm insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (private.is_current_pla |
| 244 | 2026-08-04 15:00 | `20260804150000_logistica_ativos_romaneios.sql` | ========================================================================= |
| 245 | 2026-08-05 12:00 | `20260805120000_kanban_rpcs_criar_card_e_reordenar.sql` | ========================================================================= |
| 246 | 2026-08-05 12:01 | `20260805120100_kanban_rls_e_permissoes.sql` | ========================================================================= |
| 247 | 2026-08-05 12:02 | `20260805120200_kanban_integridade_indices_realtime.sql` | ========================================================================= |
| 248 | 2026-08-06 12:26 | `20260806122656_8cdd7acd-0c9f-418f-b2ba-099dd15ab69b.sql` | 1. search_path fixo |
| 249 | 2026-08-06 12:50 | `20260806125035_6a1144f1-b8f7-4adb-94e1-4c96d6ea3efd.sql` | PRO-030: notificação dirigida por usuário — comentário avisa quem criou a solicitação |
| 250 | 2026-08-06 14:14 | `20260806141429_92c22697-27c3-4692-97a4-6e4ff01fbf52.sql` |  |
| 251 | 2026-08-07 12:00 | `20260807120000_card_secoes_visiveis_criado_por.sql` | KAN-001: reconcilia `card_secoes_visiveis.criado_por` entre o ledger e o banco vivo |
| 252 | 2026-08-10 11:09 | `20260810110931_9931a237-b168-43b9-86b6-6d9b2df28a53.sql` |  |
| 253 | 2026-08-11 11:03 | `20260811110301_e450b3c1-c68f-4c1b-b416-a984432d7bcf.sql` | CREATE OR REPLACE FUNCTION public.board_items_resumo(p_board_id uuid) |
| 254 | 2026-08-11 11:14 | `20260811111417_38b673e7-92ff-4dd3-885f-a0afe2b30740.sql` | GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_board_posicao TO authenticated; |
| 255 | 2026-08-12 12:02 | `20260812120217_9a4d9c12-da8d-4fdc-bec0-4b037b947688.sql` | CREATE POLICY "card_membros_self_delete" ON public.card_membros |
| 256 | 2026-08-13 16:15 | `20260813161500_3f2c8d41-9b57-4e6a-8c21-5d7ae0b91f34.sql` | Adiciona `previsao` (valor provisório) em solicitacoes_financeiras |
| 257 | 2026-08-14 13:00 | `20260814130000_app_role_almoxarifado_frotas.sql` | Almoxarifado e Frotas viram setores atribuíveis. |
| 258 | 2026-08-17 19:53 | `20260817195339_financeiro_titulos_core.sql` | ETAPA 1 — Núcleo operacional canônico de títulos financeiros. |
| 259 | 2026-08-17 19:57 | `20260817195758_financeiro_titulos_manual_ui_guard.sql` | Guard temporário da UI legada de "Novo título". |
| 260 | 2026-08-17 20:43 | `20260817204354_financeiro_titulos_core_hardening.sql` | Revisão GO da Etapa 1: fecha escrita direta, garante idempotência externa |
| 261 | 2026-08-17 22:19 | `20260817221932_financeiro_view_consolidada.sql` | FIN-002 — Consolidação de leitura entre o legado/snapshot TOTVS e o núcleo |
| 262 | 2026-08-18 00:06 | `20260818000615_financeiro_titulos_manual_enable.sql` | FIN-003 — Habilitação definitiva da criação manual no núcleo canônico. |
| 263 | 2026-08-18 00:08 | `20260818000839_financeiro_titulos_manual_rpc_private_impl.sql` | FIN-003 hardening — preserva as tabelas canônicas como somente leitura para |
| 264 | 2026-08-18 01:05 | `20260818010533_financeiro_rateios_integridade.sql` | ETAPA 2 — Rateios: Natureza × Centro de Custo × Obra com integridade transacional. |
| 265 | 2026-08-18 01:21 | `20260818012104_financeiro_baixas_ledger.sql` | ETAPA 3 — Ledger canônico de baixas 1:N e saldo derivado. |
| 266 | 2026-08-18 01:44 | `20260818014430_financeiro_seguranca_auditoria.sql` | ETAPA 4 — Segurança e auditoria do núcleo financeiro canônico. |
| 267 | 2026-08-18 04:03 | `20260818040310_financeiro_operacoes_estorno_edicao_cancelamento.sql` | ETAPA 6 — Operações canônicas: edição, cancelamento/reabertura e estorno imutável. |
| 268 | 2026-08-18 04:12 | `20260818041251_financeiro_auditoria_status_operacoes_fix.sql` | ETAPA 6 — Correção semântica da auditoria de status. |
| 269 | 2026-08-18 11:10 | `20260818111009_financeiro_manual_documento_v3.sql` | Ajustes pre-Etapa 8: identificacao documental obrigatoria nos titulos manuais. |
| 270 | 2026-08-18 12:09 | `20260818120907_financeiro_tipos_documento_totvs.sql` | CREATE TABLE IF NOT EXISTS public.financeiro_tipos_documento ( |
| 271 | 2026-08-18 14:27 | `20260818142706_a283402b-3b49-422d-835e-b4df6c5314f8.sql` | Fase 1 (evolução de Suprimentos): categoria/subcategoria em insumos, |
| 272 | 2026-08-18 14:50 | `20260818145035_b4a6a69d-c15c-4cd4-b54e-b45d35c956e0.sql` | Fase 2+3 (evolução de Suprimentos): Almoxarifado formal (depósitos) + |
| 273 | 2026-08-18 16:21 | `20260818162128_01eb8975-6451-4938-ad4c-64f2814f5120.sql` | Fase 4 (evolução de Suprimentos): Nota fiscal de entrada + rastreio. |
| 274 | 2026-08-18 17:33 | `20260818173328_88c15fcf-4cba-4694-a103-f2c29146c5bd.sql` | Fase 5 (evolução de Financeiro): CNAB 240 — remessa, retorno e conciliação. |
| 275 | 2026-08-18 17:36 | `20260818173634_646c20a5-418e-4454-b65e-67f4c1b69e70.sql` | Restringe o bucket privado 'cnab' (arquivos de remessa/retorno bancário) a |
| 276 | 2026-08-18 19:50 | `20260818195031_85ea9b4a-beb1-418a-b6c0-e25f07dfe70b.sql` | Corrige `fn_lancamento_solicitacao_aprovada`: o parâmetro `p_solicitacao_id` |
