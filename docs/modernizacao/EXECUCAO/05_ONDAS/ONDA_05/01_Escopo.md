# Onda 5 — Escopo

## Resumo Executivo

Validação única e regras de negócio sem duplicação. Esta onda contém **6 Achados** e tem esforço relativo **Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID          | Título                                                            | Categoria         |
| ----------- | ----------------------------------------------------------------- | ----------------- |
| **BIZ-001** | Curva S/EVM duplicada: AnaliseTab recalcula fora de lib/pmbok     | Regras de Negócio |
| **BIZ-003** | Camada de validação de domínio ausente (2 schemas zod no sistema) | Regras de Negócio |
| **DS-001**  | Ausência de arquitetura de formulários (ui/form.tsx morto)        | Design System     |
| **PRO-011** | Recebimento não gera obrigação financeira (sem three-way match)   | Produto           |
| **PRO-013** | Financeiro: sem conciliação snapshot TOTVS x lançamentos manuais  | Produto           |
| **PRO-014** | Financeiro: sem DRE/DFC gerencial formal por período              | Produto           |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Ondas 1 e 3 aprovadas.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 6 Achados, marco **M6**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 4](../ONDA_04/README.md) · [Índice de Ondas](../) · [Onda 6 →](../ONDA_06/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
