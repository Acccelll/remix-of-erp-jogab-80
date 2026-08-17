# RB-03 — Fila de notificações parada

**Severidade padrão:** S3 (usuários deixam de receber lembretes).

## Sintoma

- Sino sem novas notificações há mais de 30 min em contas com
  eventos esperados (vencimento hoje, preventiva vencida, etc.).
- Central de notificações mostra "0 novas" mesmo com dados que
  deveriam gerar evento.

## Diagnóstico

1. Confirmar que o usuário tem preferência ativa em
   `notificacao_preferencias` (RB-04 se retornar `permission denied`).
2. Ler `notificacoes` filtrando `criado_em >= now() - interval '1 hour'`.
3. Se vazio: geração não está rodando. Investigar cron/edge function
   emissora (`notificacoes_emitir_*`).
4. Se cheio mas sino vazio: consumidor não está lendo — validar
   filtros locais (`STORAGE_KEYS.notifBellTiposOcultos`).

## Ação

| Causa | Ação |
| --- | --- |
| Cron parado | Redeploy da função geradora; forçar 1 execução manual via `supabase--curl_edge_functions`. |
| Filtro local escondendo tudo | Orientar usuário a limpar filtros; abrir bug se filtro não desliga. |
| RLS negando leitura | Ver RB-04. |

## Verificação

- Emissão manual gera pelo menos 1 registro em `notificacoes` para
  contas com evento pendente.
- Sino do usuário afetado mostra a nova notificação após F5.

## Pós-incidente

- Se cron falhou silenciosamente, abrir Achado `OPS-XXX` cobrando
  monitor específico (dependência de OPS-004).

## Histórico

_(vazio)_
