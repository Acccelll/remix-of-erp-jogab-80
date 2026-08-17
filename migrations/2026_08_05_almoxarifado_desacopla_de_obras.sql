-- ============================================================
-- Migração: Suprimentos vira módulo próprio (Almoxarifado), desacoplado de Obras
-- Data: 2026-08-05
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- CONTEXTO
--
-- O item de navegação `/suprimentos` declarava `permission: "obras_div"`, então
-- `acessosDerivadosDeMatriz` colapsava Suprimentos dentro do módulo Obras:
-- conceder Suprimentos gravava `acesso_obras = 'visualizar'`.
--
-- Isso deixou de ser cosmético quando o `api.php` passou a autorizar por módulo
-- (tabela `$moduloDasRotas`): `obras_div` lê `acesso_obras` e libera as rotas
-- `medicoes`, `recebimentos`, `notas_fiscais`, `bms_previstas` e
-- `centros_custo_totvs` — ou seja, quem tinha apenas Suprimentos enxergava
-- medições e notas fiscais das obras.
--
-- Suprimentos agora tem a PageKey própria `almoxarifado`, persistida na coluna
-- JÁ EXISTENTE `usuarios.acesso_compras` (o nome da coluna não acompanha a
-- PageKey, como `rh` mora em `acesso_colaboradores` e `obras_div` em
-- `acesso_obras`). Nenhuma coluna nova é criada aqui.
--
-- POR QUE O BACKFILL É NECESSÁRIO
--
-- Usuários SEM matriz salva têm as permissões derivadas em tempo de leitura por
-- `matrizDeAcessosLegados(acessos)`, que agora consulta `acessos.almoxarifado`
-- (isto é, `acesso_compras`) para as páginas de Suprimentos. Como essa coluna
-- nunca foi preenchida — a matriz sempre derivava `compras = 'nenhum'` —, sem o
-- backfill quem enxerga Suprimentos hoje por ter Obras PERDERIA o acesso.
--
-- O UPDATE copia o nível de Obras para Almoxarifado, preservando exatamente
-- quem tem acesso hoje. A partir daí os dois módulos andam separados: retirar
-- Obras de alguém não retira mais Suprimentos, e vice-versa.
--
-- Idempotente: só toca linhas em que Almoxarifado ainda está vazio/nenhum.
-- Reexecutar não sobrescreve nada já concedido explicitamente pelo GM.
--
-- PRÉ-REQUISITO: 2026_07_16_usuarios_matriz_permissoes.sql (cria acesso_compras).
-- Sem ela o app degrada sozinho — `nivelAcessoModulo` faz Almoxarifado herdar
-- `acesso_obras` enquanto a coluna não existir —, então esta migração pode
-- esperar; mas sem ela a separação dos dois módulos não acontece de fato.
-- ============================================================

UPDATE usuarios
   SET acesso_compras = acesso_obras
 WHERE acesso_compras IS NULL
    OR TRIM(acesso_compras) = ''
    OR LOWER(TRIM(acesso_compras)) = 'nenhum';

-- Conferência sugerida (não altera dados): quem ficou com cada nível.
-- SELECT acesso_obras, acesso_compras, COUNT(*) AS usuarios
--   FROM usuarios GROUP BY acesso_obras, acesso_compras ORDER BY 3 DESC;
