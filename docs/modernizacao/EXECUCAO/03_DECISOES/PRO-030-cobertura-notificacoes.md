# PRO-030 — Matriz de cobertura da Central de Notificações

> **Status:** inventário (slice-01). Decide o escopo mínimo antes de implementar novos emissores.
> **Fonte única:** `criarNotificacao` em `src/lib/notificacoes/index.ts` (persistência via `notificacoesRepo`).
> **Escopos suportados hoje:** `compras`, `financeiro` (`RoleScope`).

## 1. Emissores existentes

| # | Origem | Evento (`tipo`) | Escopo | Observação |
|---|---|---|---|---|
| 1 | `pages/AprovacaoFinanceira.tsx:428` | `solicitacao_criada` | financeiro | Compras cria solicitação → notifica financeiro |
| 2 | `pages/AprovacaoFinanceira.tsx:500` | `solicitacao_aprovada` | compras | Financeiro aprova → notifica compras |
| 3 | `pages/AprovacaoFinanceira.tsx:534` | `solicitacao_reprovada` | compras | Financeiro reprova → notifica compras |
| 4 | `pages/AprovacaoFinanceira.tsx:589` | `solicitacao_comentario` | ambos | Comentário no fluxo → notifica contraparte |

**Diagnóstico:** cobertura restrita a um único fluxo (aprovação financeira). Nenhum outro módulo emite notificações persistentes hoje.

## 2. Eventos elegíveis para cobertura mínima

Critério: eventos que já possuem trigger no código (mutação de estado) e um destinatário natural.

| # | Módulo | Evento candidato | Escopo destino | Emissor existe? | Trigger no código |
|---|---|---|---|---|---|
| A | Qualidade | `nc_criada` | responsável NC | ❌ | `useNCPendentes`, criação de NC |
| B | Qualidade | `nc_reinspecao_pendente` | responsável NC | ❌ | closeout PRO-007 |
| C | Contratos | `contrato_vencendo` | compras | ❌ (banner ok) | `useContratosVencendo` — hoje só banner in-app |
| D | Contratos | `contrato_reajuste` | compras/financeiro | ❌ | `useContratosVencendo` |
| E | Suprimentos | `cotacao_vencedora` | compras | ❌ | fluxo cotação → OC (PRO-009) |
| F | Suprimentos | `oc_aprovada` | financeiro | ❌ | módulo OC |
| G | Frotas | `preventiva_vencendo` | responsável frota | ❌ | `usePreventivasFrota` |
| H | Documentos | `documento_a_vencer` | RH/responsável | ❌ | ControleVencimentos |
| I | Obra | `medicao_pendente_aprovacao` | responsável obra | ❌ | PRO-016 (não iniciado) |
| J | Board | `card_prazo_estourado` | responsável card | ❌ | política `notificacoesPolicy` existe mas não persiste |

## 3. Lacunas de plataforma

1. **Escopo por usuário:** `RoleScope` é grosso (compras/financeiro). Eventos como NC/frota/documento precisam de destinatário por `user_id` ou por papel funcional. Requer estender `role_scope` para union maior **ou** aceitar `target_role`/`target_user_id`.
2. **Deduplicação:** sem chave idempotente. Executar `useContratosVencendo` toda sessão emitiria N notificações por contrato. Precisa de `dedupe_key` (ex.: `contrato:{id}:venc:{dataAlvo}`) e upsert.
3. **TTL/expiração:** notificações "a vencer" ficam obsoletas quando a data passa. Precisa `expires_at` ou coleta assíncrona.
4. **Cobertura mobile:** hoje só `NotificationBell`. Sem push, sem e-mail. Fora do escopo mínimo.

## 4. Cobertura mínima proposta para Onda 7

Escopo enxuto — só o que já tem trigger no código e destinatário claro sem alterar schema:

- **A `nc_criada`** — emissor no ponto de criação de NC (escopo: papel qualidade, mapeado para `compras` por proximidade operacional até termos escopo qualidade).
- **G `preventiva_vencendo`** — emissor em `usePreventivasFrota`, uma vez por veículo/dia (dedupe em memória com `Set` por sessão).
- **C `contrato_vencendo`** — emissor único ao entrar em faixa `urgente` (≤7d), dedupe por `contrato:{id}:{termino}` guardado em `localStorage` (chave `planifik:notif:contratos-vencendo`).

Demais eventos (B, D, E, F, H, I, J) permanecem out-of-scope até:
- Extensão de `RoleScope` (**bloqueia B, H**), ou
- Fluxos ainda não implementados (**bloqueia E, F, I**), ou
- Persistência de dedupe/idempotência (**bloqueia D, J**).

## 5. Contrato de execução

Antes do slice-02 (implementação dos 3 emissores mínimos):

1. Adicionar campo opcional `dedupe_key` a `criarNotificacao` (client-side, checa se já existe antes de inserir) — **sem migração**.
2. Não alterar `notificacoesRepo` além do necessário para o filtro por `dedupe_key`.
3. Cada emissor novo entrega:
   - trigger localizado (linha do disparo),
   - chave de dedupe estável,
   - teste unitário do dedupe.

## 6. Decisão pendente para GM

- **Ampliar `RoleScope`** para incluir `qualidade`, `rh`, `frotas`, `obra` — decisão de arquitetura fora do slice mínimo. Registrar como bloqueio de `PRO-030.slice-03+`.
