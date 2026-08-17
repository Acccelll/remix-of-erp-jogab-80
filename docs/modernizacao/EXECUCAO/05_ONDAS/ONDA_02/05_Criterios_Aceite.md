# Onda 2 — Critérios de Aceite

## Resumo Executivo

Uma onda só é aceita quando **todos** os critérios de saída abaixo são satisfeitos e **cada** Achado cumpre os critérios de sua ficha original.

## Objetivo

Tornar a conclusão da onda verificável, não opinativa.

## Escopo

Critérios de saída da onda e critérios globais aplicáveis a cada Achado.

## Conteúdo

### Critérios de saída da Onda 2

- [ ] Token forjado/adulterado rejeitado
- [ ] Senhas armazenadas com hash forte
- [ ] Rate limit ativo com resposta neutra
- [ ] Leitura anônima às tabelas de negócio retorna vazio
- [ ] QR público e edge functions preservados por política mínima específica
- [ ] Trilha de auditoria de segurança registrando login, negação e mudança de permissão

### Critérios globais (todo Achado desta onda)

- [ ] Referencia um **ID** do Catálogo Mestre.
- [ ] Satisfaz **integralmente** os Critérios de Aceite da ficha original ([Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md), [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)).
- [ ] **CI verde** (install + build + test + lint + typecheck).
- [ ] Suíte existente sem regressão (baseline: 421 testes verdes).
- [ ] Nenhuma alteração de comportamento não prevista na ficha.
- [ ] Documentação incremental atualizada.

### Achados e suas fichas

| ID        | Título                                                                | Ficha completa em                                                         |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `SEC-001` | Auth PHP sem base criptográfica (senha em texto + token não assinado) | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| `SEC-002` | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)    | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| `DB-002`  | Modelo de acesso RLS em dois regimes (226 políticas USING(true))      | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md) |
| `SEC-004` | Sessão sensível em localStorage (exposta a XSS)                       | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| `SEC-005` | Ausência de rate limiting (brute force livre no login)                | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| `SEC-007` | Sem trilha de auditoria de segurança (login, negação, permissão)      | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |

## Conclusão

Sem os critérios de saída, a onda não é aprovada e a seguinte não inicia.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
