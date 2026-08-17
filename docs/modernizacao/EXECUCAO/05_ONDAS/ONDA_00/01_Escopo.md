# Onda 0 — Escopo

## Resumo Executivo

Parar a exposição e ligar as luzes antes de tocar arquitetura. Esta onda contém **8 Achados** e tem esforço relativo **Pequena**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID          | Título                                                                   | Categoria |
| ----------- | ------------------------------------------------------------------------ | --------- |
| **SEC-003** | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto | Segurança |
| **EST-002** | Escopo multiempresa não flui para os dados (filtro não filtra)           | Estado    |
| **OPS-001** | Ausência de CI (gate de qualidade antes do deploy)                       | Operação  |
| **OPS-002** | Error tracking desligado na prática (Sentry não instalado)               | Operação  |
| **OPS-006** | Backup do host MySQL e rollback de schema não evidenciados               | Operação  |
| **TST-001** | Ausência de testes E2E dos fluxos críticos de negócio                    | Testes    |
| **UX-004**  | Escopo multiempresa silencioso (sem sinalização por tela)                | UX        |
| **TST-004** | Ausência de medição de cobertura                                         | Testes    |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Nenhuma.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 8 Achados, marco **M1**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** — · [Índice de Ondas](../) · [Onda 1 →](../ONDA_01/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
