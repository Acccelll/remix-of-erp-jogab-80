-- ============================================================
-- Persistência da matriz de permissões (PRO-031) na tabela usuarios
-- do MySQL legado (jogabcom_gestao_obras).
--
-- matriz_permissoes: JSON (rota -> {V,E,X,I,Ex}) — fonte-verdade fina
--   editada em /gm?tab=permissoes.
-- papeis_permissao: JSON ({aprovarCompras, aprovarFinanceiro, setores[]}).
-- acesso_compras: nível legado da PageKey `compras`, que não tinha
--   coluna própria (era silenciosamente descartada).
--
-- LONGTEXT em vez de JSON por compatibilidade com MySQL/MariaDB
-- antigos de hospedagem compartilhada; encode/decode fica no app.
--
-- O api.php detecta a presença destas colunas via SHOW COLUMNS e
-- degrada graciosamente se a migração ainda não foi aplicada —
-- portanto api.php novo + banco antigo (ou vice-versa) não quebram.
--
-- Aplicação: executar no phpMyAdmin/console MySQL do host jogab.com.br.
-- ============================================================

ALTER TABLE usuarios
  ADD COLUMN matriz_permissoes LONGTEXT NULL,
  ADD COLUMN papeis_permissao LONGTEXT NULL,
  ADD COLUMN acesso_compras VARCHAR(20) NOT NULL DEFAULT 'nenhum';

-- Conferência:
-- SHOW COLUMNS FROM usuarios LIKE '%permiss%';
