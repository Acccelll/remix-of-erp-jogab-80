# RB-01 — Falha em edge function

**Severidade padrão:** S2 (S1 se o fluxo bloqueado for autenticação,
pagamento ou geração de PDF de RDO/inspeção assinada).

## Sintoma

- Erro `5xx` persistente em uma rota `/functions/v1/<nome>`.
- Toast "Falha ao processar" em telas que dependem da função.
- Log de aplicação com `FunctionsHttpError` / `FunctionsFetchError`.

## Diagnóstico

1. Reproduzir no ambiente `preview` a mesma chamada com a mesma
   payload (Console → Network → copiar como fetch).
2. Ler os logs da função no painel de backend do projeto (últimos
   30 min, filtrando por `level = error`).
3. Categorizar:
   - **Deploy quebrado** — stack trace já no boot da função.
   - **Timeout** — `WORKER_LIMIT` ou `deadline exceeded`.
   - **Erro de negócio** — 4xx com corpo JSON estruturado.
   - **Credencial expirada** — 401/403 do serviço externo.

## Ação

| Categoria | Ação imediata |
| --- | --- |
| Deploy quebrado | Redeploy da versão anterior (git revert do último PR que tocou `supabase/functions/<nome>`). |
| Timeout | Reduzir batch/página do consumidor; abrir OPS ticket para investigar consulta lenta. |
| Erro de negócio | Corrigir o cliente que envia payload inválido; não mexer na função. |
| Credencial expirada | Rotacionar secret via `secrets--set_secret`; redeploy da função. |

## Verificação

- Repetir a chamada original do passo 1: esperar `2xx`.
- Confirmar no log estruturado que a última execução tem
  `status = success` e `duration_ms` dentro do baseline (< 3× média
  histórica).

## Pós-incidente

- Registrar timestamps + PR/commit da correção no bloco Histórico.
- Se a raiz foi ausência de teste, abrir Achado `QC-XXX` referenciando
  este runbook.

## Histórico

_(vazio — anexar entradas por incidente)_
