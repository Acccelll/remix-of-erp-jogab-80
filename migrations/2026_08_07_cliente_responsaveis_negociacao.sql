-- ============================================================
-- Migração: cliente ganha responsáveis por negociação (N usuários)
-- Data: 2026-08-07
-- Executar no banco: jogabcom_gestao_obras (MySQL)
-- ============================================================
-- Contexto: o cadastro de cliente do CRM não registrava quem responde
-- comercialmente pelo cliente. Esta tabela de junção associa N usuários
-- a um cliente ("Responsável por negociação") e passa a ser o recorte de
-- visibilidade do Funil de Vendas: fora do GM, cada usuário enxerga as
-- oportunidades dos clientes da sua carteira, mais aquelas em que ele é o
-- responsável do próprio card.
--
-- Por que tabela de junção e não coluna JSON no cliente: o filtro do funil
-- roda no WHERE do servidor (EXISTS correlacionado em `oportunidades`). O
-- MySQL do host pode não ter operadores JSON — é justamente por isso que
-- `usuarios.papeis_permissao` é LONGTEXT — então JSON_CONTAINS não é uma
-- opção segura aqui.
--
-- Degradação: o api.php detecta a ausência desta tabela
-- (`clienteResponsaveisDisponivel()`) e, sem ela, não aplica filtro algum —
-- o CRM volta ao comportamento anterior em vez de esvaziar o funil de todos.
--
-- Reversão: DROP TABLE IF EXISTS `cliente_responsaveis`;
--
-- Idempotente: CREATE TABLE IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `cliente_responsaveis` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `cliente_id` INT NOT NULL,
  `usuario_id` INT NOT NULL,
  `criado_em`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cliresp_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cliresp_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uq_cliresp` (`cliente_id`, `usuario_id`),
  KEY `idx_cliresp_usuario` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
