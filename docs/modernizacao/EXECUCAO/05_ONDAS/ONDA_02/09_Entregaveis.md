# Onda 2 — Entregáveis

## Resumo Executivo

O que fica pronto e verificável ao fim da onda.

## Objetivo

Tornar tangível o resultado da onda.

## Escopo

Entregas técnicas, documentais e de marco.

## Conteúdo

### Entregas

- Autenticação com hash e token verificável
- Rate limiting
- Regime único de RLS documentado por tabela
- Sessão resistente a XSS
- Trilha de segurança consultável

### Achados concluídos

| ID        | Título                                                                |
| --------- | --------------------------------------------------------------------- |
| `SEC-001` | Auth PHP sem base criptográfica (senha em texto + token não assinado) |
| `SEC-002` | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)    |
| `DB-002`  | Modelo de acesso RLS em dois regimes (226 políticas USING(true))      |
| `SEC-004` | Sessão sensível em localStorage (exposta a XSS)                       |
| `SEC-005` | Ausência de rate limiting (brute force livre no login)                |
| `SEC-007` | Sem trilha de auditoria de segurança (login, negação, permissão)      |

### Artefatos de governança

- Sumário de uma página da onda (IDs concluídos, desvios, decisões, pendências).
- Registro de desvios atualizado.
- Documentação incremental das convenções produzidas.
- Tag **M3** e release com os IDs nas notas.

## Conclusão

Marco **M3 — Segurança consolidada** alcançado.

## Referências

- [Checklist de Conclusão](10_Checklist_Conclusao.md) · [Roadmap](../../../GOVERNANCA/00_EXECUTIVO/02_ROADMAP_EXECUTIVO.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
