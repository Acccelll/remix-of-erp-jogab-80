# Onda 5 — Achados

## Resumo Executivo

Os **6 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 5. Nenhum outro.

## Conteúdo

| ID          | Título                                                            | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências     | Módulo      | Origem                                                                      |
| ----------- | ----------------------------------------------------------------- | ------ | ------ | ----- | ---- | ---------- | ---------------- | ----------- | --------------------------------------------------------------------------- |
| **BIZ-001** | Curva S/EVM duplicada: AnaliseTab recalcula fora de lib/pmbok     | P1     | Média  | C2    | REF  | ISOLADA    | —                | M3          | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)      |
| **BIZ-003** | Camada de validação de domínio ausente (2 schemas zod no sistema) | P1     | Alta   | C1    | STD  | GLOBAL     | ARC-001          | Transversal | [Etapa 6](../../../GOVERNANCA/01_AUDITORIA/ETAPA_06_REGRAS_NEGOCIO.md)      |
| **DS-001**  | Ausência de arquitetura de formulários (ui/form.tsx morto)        | P1     | Alta   | C1    | STD  | GLOBAL     | ARC-001, BIZ-003 | Transversal | [Etapa 3,5](../../../GOVERNANCA/01_AUDITORIA/ETAPA_03_AUDITORIA_UX.md)      |
| **PRO-011** | Recebimento não gera obrigação financeira (sem three-way match)   | P1     | Alta   | C1    | NEW  | SEQUENCIAL | PRO-013          | M7, M8      | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |
| **PRO-013** | Financeiro: sem conciliação snapshot TOTVS x lançamentos manuais  | P1     | Alta   | C1    | NEW  | SEQUENCIAL | ARC-001          | M8          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |
| **PRO-014** | Financeiro: sem DRE/DFC gerencial formal por período              | P2     | Média  | C2    | NEW  | SEQUENCIAL | PRO-013          | M8          | [Etapa 2](../../../GOVERNANCA/01_AUDITORIA/ETAPA_02_AUDITORIA_FUNCIONAL.md) |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 6 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
