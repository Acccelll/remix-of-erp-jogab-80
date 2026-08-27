-- Fecha a dualidade de "Feature Flags" do documento de system design — com
-- uma correção em relação ao que estava mapeado: investigando a fundo, o
-- Postgres `public.feature_flags` NÃO é um mirror morto do sistema de
-- feature flags de produto (esse é 100% MySQL, via api.php `featureFlags` /
-- `useFeatureFlag()` / GMFeatureFlags.tsx — confirmado, sem alteração aqui).
--
-- É uma tabela separada e funcional, com um propósito bem mais estreito:
-- 4 flags "legacy.*" seedadas uma única vez (20260629145656_...sql) para o
-- painel de cutover (H3.3/H3.4, GMCutoverIndex.tsx) sinalizar se o
-- importador legado de cada obra (Trello/Cronograma/Financeiro/Ponto) ainda
-- está ativo. Não há nenhuma escrita no app, mas a leitura funciona — não é
-- um bug silencioso como o de Aprovação Financeira.
--
-- O problema real é só de nome: "feature_flags"/"is_flag_enabled" no
-- Postgres soam como o sistema de feature flags de produto, mas são outra
-- coisa. Mesma armadilha de nomenclatura do caso "Contratos" — resolvida
-- aqui com rename, antes de virar confusão de novo.

ALTER TABLE public.feature_flags RENAME TO cutover_legacy_flags;

-- is_flag_enabled() nunca é chamada por nenhum código do frontend — o
-- painel de cutover lê a tabela direto via .from(). Dead code, remove.
DROP FUNCTION IF EXISTS public.is_flag_enabled(uuid, text);
