# Onda 2 — Escopo

## Resumo Executivo

Identidade confiável e dado fechado. Esta onda contém **6 Achados** e tem esforço relativo **Muito Grande**.

## Objetivo

Delimitar com precisão o que entra e o que fica de fora desta onda.

## Escopo

### Dentro do escopo

| ID          | Título                                                                | Categoria      |
| ----------- | --------------------------------------------------------------------- | -------------- |
| **SEC-001** | Auth PHP sem base criptográfica (senha em texto + token não assinado) | Segurança      |
| **SEC-002** | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)    | Segurança      |
| **DB-002**  | Modelo de acesso RLS em dois regimes (226 políticas USING(true))      | Banco de Dados |
| **SEC-004** | Sessão sensível em localStorage (exposta a XSS)                       | Segurança      |
| **SEC-005** | Ausência de rate limiting (brute force livre no login)                | Segurança      |
| **SEC-007** | Sem trilha de auditoria de segurança (login, negação, permissão)      | Segurança      |

### Fora do escopo

- Qualquer Achado não listado acima.
- Qualquer melhoria descoberta durante a execução (registrar como **Descoberta de Execução D-xx**).
- Alteração de prioridade, diagnóstico ou critério de aceite de qualquer Achado.

### Pré-condição de entrada

Onda 1 aprovada **+ ARC-009 entregue + TST-001.a verde + decisões D-1 e D-2 registradas**.

## Conteúdo

O escopo desta onda foi fixado pela Etapa 14 e validado pelo Stage Gate (Etapa 14.5). Ele é **fechado**: ampliá-lo exige registro de desvio e avaliação ao fim da onda.

## Conclusão

Escopo fechado, 6 Achados, marco **M3**.

## Referências

- [Achados](02_Achados.md) · [Contrato](../../00_EXECUTIVO/04_CONTRATO_EXECUCAO.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
