# Onda 3 — Escopo

## Resumo Executivo

Fronteira íntegra e camada de dados fechada e testada. Esta onda contém **8 Achados** e tem esforço relativo **Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID          | Título                                                                   | Categoria         |
| ----------- | ------------------------------------------------------------------------ | ----------------- |
| **ARC-003** | Bypass da camada de repositories (35 páginas com from() direto)          | Arquitetura       |
| **BIZ-002** | Lib bimodal pura x impura sem convenção (19 arquivos com I/O)            | Regras de Negócio |
| **DB-001**  | Fronteira PHP x Supabase sem integridade referencial (ids em text)       | Banco de Dados    |
| **EST-001** | Otimismo sem rollback nos domínios PHP (falha silenciosa)                | Estado            |
| **TST-002** | Fronteira de backend e camada de dados sem testes de integração          | Testes            |
| **ARC-008** | Query keys ad-hoc sem registro/fábrica (171 invalidações em 46 arquivos) | Arquitetura       |
| **DB-004**  | Trilho MySQL de aplicação manual sem registro de estado                  | Banco de Dados    |
| **ARC-010** | services/ vestigial; dpHoleriteRepo fora de repositories/                | Arquitetura       |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Onda 1 aprovada.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 8 Achados, marco **M4**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 2](../ONDA_02/README.md) · [Índice de Ondas](../) · [Onda 4 →](../ONDA_04/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
