# Onda 3 — Achados

## Resumo Executivo

Os **8 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 3. Nenhum outro.

## Conteúdo

| ID          | Título                                                                   | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências     | Módulo           | Origem                                                                         |
| ----------- | ------------------------------------------------------------------------ | ------ | ------ | ----- | ---- | ---------- | ---------------- | ---------------- | ------------------------------------------------------------------------------ |
| **ARC-003** | Bypass da camada de repositories (35 páginas com from() direto)          | P1     | Média  | C1    | REF  | LOTE       | ARC-001          | Transversal      | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **BIZ-002** | Lib bimodal pura x impura sem convenção (19 arquivos com I/O)            | P1     | Média  | C1    | REF  | LOTE       | ARC-001, ARC-003 | Transversal      | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)         |
| **DB-001**  | Fronteira PHP x Supabase sem integridade referencial (ids em text)       | P1     | Média  | C1    | MOD  | SEQUENCIAL | DB-005           | M1, M9, M13      | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)      |
| **EST-001** | Otimismo sem rollback nos domínios PHP (falha silenciosa)                | P1     | Média  | C1    | REF  | LOTE       | —                | M1, M9, M10, M13 | [Etapa 7](../../../GOVERNANCA/01_AUDITORIA/ETAPA_07_ESTADO_FLUXO_DADOS.md)     |
| **TST-002** | Fronteira de backend e camada de dados sem testes de integração          | P1     | Alta   | C1    | NEW  | LOTE       | ARC-003, ARC-001 | Transversal      | [Etapa 12](../../../GOVERNANCA/01_AUDITORIA/ETAPA_12_TESTABILIDADE.md)         |
| **ARC-008** | Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) | P2     | Baixa  | C2    | STD  | ISOLADA    | —                | Transversal      | [Etapa 4](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md)   |
| **DB-004**  | Trilho MySQL de aplicação manual sem registro de estado                  | P2     | Baixa  | C2    | DOC  | ISOLADA    | —                | Plataforma       | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md)      |
| **ARC-010** | services/ vestigial; dpHoleriteRepo fora de repositories/                | P3     | Baixa  | C3    | REM  | ISOLADA    | ARC-003          | Transversal      | [Etapa 4,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_04_ARQUITETURA_FRONTEND.md) |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 8 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
