# 01 — Visão Geral da Modernização

## Resumo Executivo

O Planifik é um ERP de construção e montagem industrial (React 18 + TypeScript + Vite + Supabase) que convive com um **backend PHP legado**. Treze etapas de auditoria técnica identificaram **107 Achados**. Uma conclusão atravessa todas as etapas: **fundação boa, adoção parcial** — o produto quase sempre construiu o mecanismo certo e o aplicou pela metade.

## Objetivo

Apresentar o sistema, o diagnóstico consolidado e o sentido da modernização.

## Escopo

Contexto do produto, causa-raiz, distribuição dos achados, riscos e oportunidades.

## Conteúdo

### O produto

15 módulos (M1–M15) cobrindo o ciclo completo de uma construtora: CRM → Contrato → Obra → Planejamento (CPM/EVM + Last Planner) → Execução (RDO, inspeções) → Suprimentos → Medição/Faturamento → Financeiro → Custos de pessoal. Módulos de engenharia com profundidade de software vertical especializado; módulos administrativos com profundidade de bom sistema interno.

### A causa-raiz recorrente

**A fronteira dupla de backend.** Domínios do PHP legado vivem num _god-context_ imperativo; domínios do Supabase seguem uma receita moderna (lib pura testada → repositories → TanStack Query). Essa fronteira explica achados de arquitetura, estado, dados, segurança, testes e operação — e, na Etapa 11, deixa de ser custo de manutenção para virar **superfície de exposição**.

### Distribuição dos Achados

| Categoria           | Achados |
| ------------------- | ------- |
| Produto             | 31      |
| Design System       | 16      |
| Arquitetura         | 11      |
| UX                  | 10      |
| Segurança           | 7       |
| Operação            | 7       |
| Banco de Dados      | 6       |
| Regras de Negócio   | 4       |
| Qualidade de Código | 4       |
| Performance         | 4       |
| Testes              | 4       |
| Estado              | 3       |

**Por prioridade:** P0 **4** · P1 **42** · P2 **38** · P3 **23** — total **107**.

### Os 4 Achados P0

| ID      | Título                                                                   | Categoria   | Onda |
| ------- | ------------------------------------------------------------------------ | ----------- | ---- |
| ARC-001 | Tipagem Supabase desligada (any) sobre tipos gerados defasados           | Arquitetura | 1    |
| SEC-001 | Auth PHP sem base criptográfica (senha em texto + token não assinado)    | Segurança   | 2    |
| SEC-002 | RLS permissivo: 226 políticas USING(true) TO anon (absorve DB-002)       | Segurança   | 2    |
| SEC-003 | Segredos versionáveis (senha MySQL no código) e CORS com fallback aberto | Segurança   | 0    |

### Principais riscos

1. **Exposição de dados** — autenticação forjável, RLS permissivo, segredo no código.
2. **Cirurgias sem rede de testes** — as áreas de maior mudança têm cobertura zero.
3. **Perda de dados-mestre** — backup do host MySQL não evidenciado.
4. **Migração travada no god-context** — 86 consumidores acoplados.

### Principais oportunidades

- Cada P0 de segurança **acelera** a migração PHP→Supabase já planejada.
- A lib de negócio testada (421 testes verdes) prova que o time sabe fazer certo.
- Os mecanismos certos já existem (RLS rico, Sentry, feature flags, telemetria de p95): falta **ligá-los e estendê-los**.

## Conclusão

O Planifik é um produto funcionalmente forte, travado por dívidas **concentradas e endereçáveis** — não por defeitos difusos. O que o separa de um ERP comercializável não é reescrita: é **terminar de aplicar o que já foi projetado**.

## Referências

- [Roadmap Executivo](02_ROADMAP_EXECUTIVO.md) · [Auditoria completa](../01_AUDITORIA/) · [Catálogo Mestre](../../EXECUCAO/02_CATALOGO/Catalogo_Mestre.md)

---

_Pacote Oficial de Governança da Modernização — Planifik. Documento derivado exclusivamente da Auditoria Técnica (Etapas 1–14.5). Nenhum conteúdo fictício; nenhum Achado criado nesta fase._
