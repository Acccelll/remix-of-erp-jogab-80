# Onda 2 — Checklist de Conclusão

## Resumo Executivo

Gate de saída da onda. **Todos** os itens devem estar marcados antes de iniciar a onda seguinte.

## Objetivo

Impedir que uma onda seja dada por encerrada sem verificação objetiva.

## Escopo

Achados, critérios de saída, regressão, governança e marco.

## Conteúdo

### 1. Achados concluídos (6)

- [ ] `SEC-001` — Auth PHP sem base criptográfica (senha em texto + token não assinado)
- [ ] `SEC-002` — RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)
- [ ] `DB-002` — Modelo de acesso RLS em dois regimes (226 políticas USING(true))
- [ ] `SEC-004` — Sessão sensível em localStorage (exposta a XSS)
- [ ] `SEC-005` — Ausência de rate limiting (brute force livre no login)
- [ ] `SEC-007` — Sem trilha de auditoria de segurança (login, negação, permissão)

### 2. Critérios de saída da onda

- [ ] Token forjado/adulterado rejeitado
- [ ] Senhas armazenadas com hash forte
- [ ] Rate limit ativo com resposta neutra
- [ ] Leitura anônima às tabelas de negócio retorna vazio
- [ ] QR público e edge functions preservados por política mínima específica
- [ ] Trilha de auditoria de segurança registrando login, negação e mudança de permissão

### 3. Regressão

- [ ] Suíte unit completa verde (baseline 421).
- [ ] E2E das jornadas críticas verde.
- [ ] Regressão específica da onda executada ([07](07_Plano_Regressao.md)).
- [ ] Nenhuma jornada crítica vermelha.

### 4. Governança

- [ ] Todo trabalho referencia um ID do Catálogo.
- [ ] Registro de desvios atualizado e revisado.
- [ ] Descobertas de Execução (D-xx) avaliadas.
- [ ] Documentação incremental atualizada.
- [ ] Sumário de uma página da onda produzido.

### 5. Marco

- [ ] Merge na linha principal com CI verde.
- [ ] Tag **M3** aplicada.
- [ ] Release publicada com os IDs concluídos.
- [ ] **Aprovação formal da onda registrada.**

### 6. Desbloqueio da próxima onda

- [ ] Condições de `NO-GO` da próxima onda verificadas (ver [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md)).

## Conclusão

Marcados todos os itens, a Onda 2 está encerrada e a Onda 3 pode iniciar.

## Referências

- [Critérios de Aceite](05_Criterios_Aceite.md) · [Stage Gate](../../00_EXECUTIVO/05_STAGE_GATE_GO_NO_GO.md) · [Checklist Final](../../04_VALIDACAO/Checklist_Final.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
