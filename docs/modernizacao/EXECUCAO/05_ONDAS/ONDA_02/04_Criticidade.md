# Onda 2 — Criticidade

## Resumo Executivo

Distribuição da criticidade de negócio: **C0**: 3 · **C1**: 2 · **C2**: 1.

## Objetivo

Indicar onde um erro de execução custa mais caro.

## Escopo

Criticidade de negócio (C0–C3) dos Achados desta onda.

## Conteúdo

### C0 — 3 achado(s)

| ID        | Título                                                                | Prioridade | Módulo      |
| --------- | --------------------------------------------------------------------- | ---------- | ----------- |
| `SEC-001` | Auth PHP sem base criptográfica (senha em texto + token não assinado) | P0         | Transversal |
| `SEC-002` | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)    | P0         | Transversal |
| `DB-002`  | Modelo de acesso RLS em dois regimes (226 políticas USING(true))      | P1         | Transversal |

### C1 — 2 achado(s)

| ID        | Título                                                 | Prioridade | Módulo      |
| --------- | ------------------------------------------------------ | ---------- | ----------- |
| `SEC-004` | Sessão sensível em localStorage (exposta a XSS)        | P1         | Transversal |
| `SEC-005` | Ausência de rate limiting (brute force livre no login) | P1         | Plataforma  |

### C2 — 1 achado(s)

| ID        | Título                                                           | Prioridade | Módulo |
| --------- | ---------------------------------------------------------------- | ---------- | ------ |
| `SEC-007` | Sem trilha de auditoria de segurança (login, negação, permissão) | P2         | M14    |

### Como usar

- **C0** exige caracterização E2E prévia e rollback ensaiado.
- **C1** exige validação por lote e revisão de regressão.
- **C2/C3** seguem o fluxo normal de CI e revisão.

## Conclusão

Esta onda contém Achados C0 — nenhum deles pode ser executado sem rede de testes.

## Referências

- [Taxonomia](../../../GOVERNANCA/06_REFERENCIA/Taxonomia_Prioridades.md) · [Riscos](08_Riscos.md) · [Plano de Regressão](07_Plano_Regressao.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
