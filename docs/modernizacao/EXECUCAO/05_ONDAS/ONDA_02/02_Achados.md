# Onda 2 — Achados

## Resumo Executivo

Os **6 Achados** desta onda, com todos os campos de classificação. A ficha completa de cada um está na etapa de origem.

## Objetivo

Fornecer a lista executável da onda.

## Escopo

Todos os Achados atribuídos à Onda 2. Nenhum outro.

## Conteúdo

| ID          | Título                                                                | Prior. | Compl. | Crit. | Tipo | Estratégia | Dependências     | Módulo      | Origem                                                                    |
| ----------- | --------------------------------------------------------------------- | ------ | ------ | ----- | ---- | ---------- | ---------------- | ----------- | ------------------------------------------------------------------------- |
| **SEC-001** | Auth PHP sem base criptográfica (senha em texto + token não assinado) | P0     | Alta   | C0    | REF  | SEQUENCIAL | SEC-003, TST-001 | Transversal | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| **SEC-002** | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)    | P0     | Alta   | C0    | STD  | MIGRAÇÃO   | SEC-001, ARC-009 | Transversal | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| **DB-002**  | Modelo de acesso RLS em dois regimes (226 políticas USING(true))      | P1     | Alta   | C0    | STD  | MIGRAÇÃO   | ARC-009, SEC-001 | Transversal | [Etapa 8](../../../GOVERNANCA/01_AUDITORIA/ETAPA_08_ARQUITETURA_DADOS.md) |
| **SEC-004** | Sessão sensível em localStorage (exposta a XSS)                       | P1     | Média  | C1    | REF  | SEQUENCIAL | SEC-001          | Transversal | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| **SEC-005** | Ausência de rate limiting (brute force livre no login)                | P1     | Baixa  | C1    | NEW  | ISOLADA    | SEC-001          | Plataforma  | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |
| **SEC-007** | Sem trilha de auditoria de segurança (login, negação, permissão)      | P2     | Média  | C2    | NEW  | ISOLADA    | SEC-001, SEC-005 | M14         | [Etapa 11](../../../GOVERNANCA/01_AUDITORIA/ETAPA_11_SEGURANCA.md)        |

### Onde encontrar a ficha completa

Cada Achado tem, em sua **etapa de origem**, a ficha com: Evidências, Diagnóstico, Impacto, Objetivo Arquitetural, Áreas Impactadas, Risco de Regressão, Validação Recomendada e **Critérios de Aceite**. A coluna _Origem_ acima leva diretamente ao documento.

## Conclusão

Executar exclusivamente estes 6 IDs, respeitando a ordem do [Plano de Execução](06_Plano_Execucao.md).

## Referências

- [Catálogo Mestre](../../02_CATALOGO/Catalogo_Mestre.md) · [Critérios de Aceite](05_Criterios_Aceite.md) · [Dependências](03_Dependencias.md)

---

**Navegação:** [← Onda 1](../ONDA_01/README.md) · [Índice de Ondas](../) · [Onda 3 →](../ONDA_03/README.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
